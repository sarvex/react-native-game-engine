import { Subject, CompositeDisposable } from "rxjs";
import { Observable } from 'rxjs/Observable';

export default ({ triggerPressEventBefore = 200, triggerLongPressEventAfter = 700 }) => {
	return touches => {
		let touchStart = new Subject();
		let touchMove = new Subject();
		let touchEnd = new Subject();

		let touchPress = touchStart.mergeMap(e =>
			touchEnd
				.first(x => x.identifier === e.identifier)
				.timeout(triggerPressEventBefore, Observable.empty())
		);

		let longTouch = touchStart.mergeMap(e =>
			Observable
				.return(e)
				.delay(triggerLongPressEventAfter)
				.takeUntil(
					touchMove
						.merge(touchEnd)
						.first(x => x.identifier === e.identifier)
				)
		);

		let touchStartComposite = new CompositeDisposable();
		let touchMoveComposite = new CompositeDisposable();
		let touchEndComposite = new CompositeDisposable();
		let touchPressComposite = new CompositeDisposable();
		let longTouchComposite = new CompositeDisposable();

		touchStartComposite.add(
			touchStart
				.groupBy(e => e.identifier)
				.map(group => {
					return group.map(e => {
						touches.push({
							id: group.key,
							type: "start",
							event: e
						});
					});
				})
				.subscribe(group => {
					touchStartComposite.add(group.subscribe());
				})
		);

		touchMoveComposite.add(
			Observable
				.merge(
					touchStart.map(x => Object.assign(x, { type: "start" })),
					touchMove.map(x => Object.assign(x, { type: "move" })),
					touchEnd.map(x => Object.assign(x, { type: "end" }))
				)
				.groupBy(e => e.identifier)
				.map(group => {
					return group.pairwise().map(([e1, e2]) => {
						if (e1.type !== "end" && e2.type === "move") {
							touches.push({
								id: group.key,
								type: "move",
								event: e2,
								delta: {
									locationX: e2.locationX - e1.locationX,
									locationY: e2.locationY - e1.locationY,
									pageX: e2.pageX - e1.pageX,
									pageY: e2.pageY - e1.pageY,
									timestamp: e2.timestamp - e1.timestamp
								}
							});
						}
					});
				})
				.subscribe(group => {
					touchMoveComposite.add(group.subscribe());
				})
		);

		touchEndComposite.add(
			touchEnd
				.groupBy(e => e.identifier)
				.map(group => {
					return group.map(e => {
						touches.push({ id: group.key, type: "end", event: e });
					});
				})
				.subscribe(group => {
					touchEndComposite.add(group.subscribe());
				})
		);

		touchPressComposite.add(
			touchPress
				.groupBy(e => e.identifier)
				.map(group => {
					return group.map(e => {
						touches.push({
							id: group.key,
							type: "press",
							event: e
						});
					});
				})
				.subscribe(group => {
					touchPressComposite.add(group.subscribe());
				})
		);

		longTouchComposite.add(
			longTouch
				.groupBy(e => e.identifier)
				.map(group => {
					return group.map(e => {
						touches.push({
							id: group.key,
							type: "long-press",
							event: e
						});
					});
				})
				.subscribe(group => {
					longTouchComposite.add(group.subscribe());
				})
		);

		return {
			process(type, event) {
				switch (type) {
					case "start":
						touchStart.onNext(event);
						break;
					case "move":
						touchMove.onNext(event);
						break;
					case "end":
						touchEnd.onNext(event);
						break;
				}
			},
			end() {
				touchStart.dispose();
				touchMove.dispose();
				touchEnd.dispose();

				touchStartComposite.dispose();
				touchMoveComposite.dispose();
				touchEndComposite.dispose();
				touchPressComposite.dispose();
				longTouchComposite.dispose();
			}
		};
	};
};
