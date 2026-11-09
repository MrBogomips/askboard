// The Chart's block (view-and-widgets spec: Chart drawing, Highlighting data points, A Chart at the
// keyboard, A Chart's points read aloud, Charts to read and read-only charts): the title above, the
// canvas as the one Tab stop, the counter under it, and a polite live region that reads each point.
// The highlighted points are the item's result, or none; nothing is highlighted until the user
// highlights a point (AD-10). A chart to read or a disabled one highlights nothing and still reads.

import type { ChartPoint, ChartProps, Locale } from "@askboard/contract";
import { type Say, useReadyAfterLayout, useTheme } from "@askboard/view/catalog";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pressOfEvent } from "../shared/key-press.ts";
import { useCanvas } from "./canvas.ts";
import { CHART, COUNTER, HIDDEN, PLOT, TITLE } from "./classes.ts";
import { PLOT_HEIGHT } from "./layout.ts";
import {
  chartKeyAction,
  firstPoint,
  isHighlighted,
  move,
  pointAt,
  resultOf,
  toggle,
} from "./model.ts";
import { type ChartTokens, chartOption } from "./option.ts";
import { counterText, pointReading } from "./reading.ts";
import { chartTokens } from "./theme.ts";

type Props = {
  readonly props: ChartProps;
  readonly itemId: string;
  readonly labelledBy: string;
  readonly highlighted: readonly ChartPoint[];
  readonly locale: Locale;
  readonly say: Say;
  readonly disabled: boolean;
  readonly ready: () => void;
  readonly onResult: (result: unknown) => void;
};

// The box's width as it stands: undefined until measured, then each size the observer reports.
const useWidth = (element: React.RefObject<HTMLDivElement | null>): number | undefined => {
  const [width, setWidth] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const target = element.current;
    if (target === null) return;
    setWidth(Math.floor(target.clientWidth));
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [element]);
  return width;
};

// The indexes the library names a point by: its series' and its category's position.
const indexesOf = (props: ChartProps, point: ChartPoint): readonly [number, number] => [
  props.series.findIndex(({ id }) => id === point.series),
  props.categories.findIndex(({ id }) => id === point.category),
];

export const ChartWidget = ({
  props,
  itemId,
  labelledBy,
  highlighted,
  locale,
  say,
  disabled,
  ready,
  onResult,
}: Props) => {
  const host = useRef<HTMLDivElement | null>(null);
  const width = useWidth(host);
  const theme = useTheme();
  const [tokens, setTokens] = useState<ChartTokens | undefined>(undefined);
  const [current, setCurrent] = useState<ChartPoint | undefined>(undefined);
  const [reading, setReading] = useState("");
  const [drawn, setDrawn] = useState(false);

  // The tokens in the theme in effect, read again on each switch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new theme is a new read.
  useLayoutEffect(() => {
    if (host.current !== null) setTokens(chartTokens(host.current));
  }, [theme]);

  const takesHighlights = props.highlights !== "none" && !disabled;
  const option = useMemo(
    () =>
      tokens === undefined || width === undefined || width <= 0
        ? undefined
        : chartOption({
            props,
            highlighted,
            tokens,
            locale,
            box: { width, height: PLOT_HEIGHT },
            disabled: !takesHighlights,
          }),
    [props, highlighted, tokens, locale, width, takesHighlights],
  );

  const announce = useCallback(
    (point: ChartPoint, isOn: boolean) =>
      setReading(pointReading(props, point, { locale, say, highlighted: isOn })),
    [props, locale, say],
  );

  const flip = useCallback(
    (point: ChartPoint) => {
      if (!takesHighlights) return;
      const on = isHighlighted(highlighted, point);
      onResult(resultOf(toggle(highlighted, point, props.highlights), props));
      announce(point, !on);
    },
    [takesHighlights, highlighted, props, onResult, announce],
  );

  const { showTip, hideTip } = useCanvas(
    host,
    option,
    { width: width ?? 0, height: PLOT_HEIGHT },
    {
      click: (seriesIndex, dataIndex) => {
        const point = pointAt(props, seriesIndex, dataIndex);
        if (point === undefined) return;
        setCurrent(point);
        flip(point);
      },
      drawn: () => setDrawn(true),
    },
  );

  // The current point shows its tooltip, again after each redraw (a new option clears it).
  // biome-ignore lint/correctness/useExhaustiveDependencies: a redraw is a new option.
  useEffect(() => {
    if (current !== undefined) showTip(...indexesOf(props, current));
  }, [current, option, props, showTip]);

  useReadyAfterLayout(ready, width === 0 || drawn);

  const arrive = (point: ChartPoint | undefined) => {
    setCurrent(point);
    if (point !== undefined) announce(point, isHighlighted(highlighted, point));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A key with a modifier, or one the chart does not take, keeps its default.
    const action = chartKeyAction(pressOfEvent(event));
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "move") arrive(move(current, action.key, props));
    else if (current !== undefined) flip(current);
  };

  const titleId = `${itemId}:title`;
  const hintId = `${itemId}:hint`;
  return (
    <div className={CHART} data-chart-widget="">
      {props.title === undefined ? null : (
        <p id={titleId} className={TITLE} data-chart-title="">
          {props.title}
        </p>
      )}
      <div
        ref={host}
        className={PLOT}
        data-chart=""
        role="application"
        aria-roledescription={say("chart.role")}
        aria-labelledby={props.title === undefined ? labelledBy : titleId}
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the chart is one composite widget (role application) and the one Tab stop, which reads and moves by keys itself (NFR-12).
        tabIndex={0}
        onFocus={() => arrive(firstPoint(props))}
        onBlur={() => {
          setCurrent(undefined);
          hideTip();
        }}
        onKeyDown={onKeyDown}
      />
      <p id={hintId} className={HIDDEN}>
        {say("chart.hint")}
      </p>
      <p className={HIDDEN} aria-live="polite" data-chart-live="">
        {reading}
      </p>
      {props.highlights === "none" ? null : (
        <p className={COUNTER} data-chart-counter="">
          {counterText(highlighted.length, say)}
        </p>
      )}
    </div>
  );
};
