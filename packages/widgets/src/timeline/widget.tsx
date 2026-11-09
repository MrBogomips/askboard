// The Timeline's frame (view-and-widgets spec: Timeline layout, Timeline moves by drag, Timeline at
// the keyboard, LaTeX, Kanban and Timeline read-only; design decision 10): a toolbar row, the fixed
// column of lane labels, and the chart in a region that scrolls sideways. The props shown are the
// draft's, else the agent's; it opens at the finest zoom at which the sent span fits the chart's
// region, taken once. The entries are one Tab stop whose Up, Down, Home and End keys move the
// current entry; the toolbar, "Move earlier", "Move later", "Move to lane…" and the counter, is
// another. A drop or a tool reports the whole edited props and keeps the moved entry current; the
// drag, the current entry and the preview are the component's own state and never go in the draft,
// and nothing reaches the draft before the drop. Nothing here holds the props (AD-9).

import type { TimelineProps } from "@askboard/contract";
import { keyPressOf, useLocale, useStrings } from "@askboard/view/catalog";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useElementWidth } from "../gantt/use-element-width.ts";
import { FRAME } from "../shared/move-classes.ts";
import { MoveToolbar } from "../shared/move-toolbar.tsx";
import { usePointerDrag } from "../shared/pointer-drag.ts";
import type { PointerDrag } from "../shared/pointer-travel.ts";
import type { Zoom } from "../shared/time/scale.ts";
import { TimelineChart } from "./chart.tsx";
import { BODY, SCROLLER } from "./classes.ts";
import { afterDrop, previewOf } from "./drop.ts";
import { otherLanes, timelineKeyOf, timelineTools } from "./keys.ts";
import { LaneLabels } from "./lanes.tsx";
import { laneAt, layoutOf, openingZoomOf, spanOf } from "./layout.ts";
import { dropOf, moveBy, movedOf, moveToLane, neighbour, orderOf, stepOf } from "./model.ts";
import { counterText, entryName } from "./text.ts";

export const TimelineWidget = ({
  sent,
  shown,
  labelledBy,
  disabled,
  onChange,
}: {
  /** The agent's props, checked. */
  readonly sent: TimelineProps;
  /** The props to show: the draft's, else the agent's. */
  readonly shown: TimelineProps;
  /** The ID of the question's text, which names the chart. */
  readonly labelledBy: string;
  /** The question is answered, being sent or locked: the Timeline changes nothing. */
  readonly disabled: boolean;
  /** The user's next props. */
  readonly onChange: (next: TimelineProps) => void;
}) => {
  const text = useStrings();
  const locale = useLocale();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const entries = useRef(new Map<string, SVGGElement>());
  // Where the press went down in the chart, from its top: the lane under the pointer at the drop.
  const pressedY = useRef(0);
  const width = useElementWidth(scroller);
  // The zoom the Timeline opened at, taken once, as the Gantt's plan takes its own.
  const [opened, setOpened] = useState<Zoom | undefined>(undefined);
  useLayoutEffect(() => {
    if (opened === undefined && width !== undefined) setOpened(openingZoomOf(sent, width));
  }, [opened, width, sent]);
  const zoom = opened ?? "week";
  const span = useMemo(() => spanOf(sent, shown), [sent, shown]);
  const layout = useMemo(() => layoutOf(shown, span, zoom), [shown, span, zoom]);
  const order = useMemo(() => orderOf(shown), [shown]);
  const lanes = useMemo(() => new Map(shown.lanes.map(({ id, label }) => [id, label])), [shown]);
  const names = useMemo(
    () =>
      new Map(
        shown.entries.map((entry) => [
          entry.id,
          entryName(entry, lanes.get(entry.lane) ?? "", locale, text),
        ]),
      ),
    [shown, lanes, locale, text],
  );
  const moved = useMemo(() => new Set(movedOf(sent, shown)), [sent, shown]);
  const current = chosen !== undefined && order.includes(chosen) ? chosen : undefined;
  const stop = current ?? order[0];
  const tools = timelineTools(shown, current, disabled, zoom);

  const onDrop = useCallback(
    ({ id, dx, dy }: PointerDrag<"move">) => {
      const lane = laneAt(layout, pressedY.current + dy);
      const next = afterDrop(shown, id, dropOf({ dx, dy, laneAt: lane }, zoom));
      setChosen(id);
      if (next !== undefined) onChange(next);
    },
    [layout, shown, zoom, onChange],
  );
  const { drag, press, move, release, cancel } = usePointerDrag<"move">(onDrop, !disabled);
  const shifted =
    drag === undefined
      ? undefined
      : {
          id: drag.id,
          ...previewOf(
            layout,
            drag.id,
            dropOf(
              { dx: drag.dx, dy: drag.dy, laneAt: laneAt(layout, pressedY.current + drag.dy) },
              zoom,
            ),
            zoom,
          ),
        };

  const onPress = (id: string, event: PointerEvent<SVGGElement>): void => {
    const top = svg.current?.getBoundingClientRect().top ?? 0;
    pressedY.current = event.clientY - top;
    press(id, "move", event);
  };

  const step = (sign: -1 | 1): void => {
    if (current === undefined) return;
    const next = moveBy(shown, current, sign * stepOf(zoom));
    if (next !== shown) onChange(next);
  };

  const toLane = (laneId: string): void => {
    if (current === undefined) return;
    const next = moveToLane(shown, current, laneId);
    if (next !== shown) onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>): void => {
    const key = timelineKeyOf(keyPressOf(event));
    const from = current ?? stop;
    if (key === undefined || from === undefined) return;
    const next = neighbour(order, from, key);
    if (next === undefined) return;
    event.preventDefault();
    setChosen(next);
    entries.current.get(next)?.focus();
  };

  return (
    <div className={FRAME} data-timeline="">
      <MoveToolbar
        widget="timeline"
        name={text("timeline.tools")}
        tools={[
          {
            key: "earlier",
            label: text("timeline.moveEarlier"),
            enabled: tools.earlier,
            run: () => step(-1),
          },
          {
            key: "later",
            label: text("timeline.moveLater"),
            enabled: tools.later,
            run: () => step(1),
          },
          {
            key: "lane",
            label: text("timeline.moveToLane"),
            enabled: tools.lane,
            menu: { options: otherLanes(shown, current), onChoose: toLane },
          },
        ]}
        counter={counterText(moved.size, text)}
        changed={moved.size > 0}
      />
      <div className={BODY}>
        <LaneLabels layout={layout} />
        <div ref={scroller} tabIndex={-1} className={SCROLLER}>
          <TimelineChart
            svg={svg}
            props={shown}
            layout={layout}
            span={span}
            zoom={zoom}
            labelledBy={labelledBy}
            names={names}
            moved={moved}
            current={current}
            stop={stop}
            shifted={shifted}
            editable={!disabled}
            entryRef={(id, node) => {
              if (node === null) entries.current.delete(id);
              else entries.current.set(id, node);
            }}
            onKeyDown={onKeyDown}
            onCurrent={setChosen}
            onPress={onPress}
            onMove={move}
            onRelease={release}
            onCancel={cancel}
          />
        </div>
      </div>
    </div>
  );
};
