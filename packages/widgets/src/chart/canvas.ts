// The chart library's canvas (design decision 4): one `echarts` instance per Chart, made when the
// box first has a width, resized and given the option again whenever either changes, disposed with
// the component. The library holds only the modules the Chart uses: the three charts, the grid,
// tooltip and legend and the canvas renderer.

import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { type ECharts, type EChartsCoreOption, init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ChartBox } from "./layout.ts";
import type { ChartOption } from "./option.ts";

use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

/** What the canvas tells the component. */
export type CanvasEvents = {
  /** A click on a point: the series' and the data's index. */
  readonly click: (seriesIndex: number, dataIndex: number) => void;
  /** The canvas has drawn. */
  readonly drawn: () => void;
};

type ClickParams = {
  readonly componentType?: string;
  readonly seriesIndex?: number;
  readonly dataIndex?: number;
};

/**
 * Draws `option` into `host` once `option` is given and the box has a width; returns what shows
 * and hides the tooltip of a point by its indexes.
 */
export const useCanvas = (
  host: RefObject<HTMLDivElement | null>,
  option: ChartOption | undefined,
  box: ChartBox,
  events: CanvasEvents,
) => {
  const chart = useRef<ECharts | undefined>(undefined);
  const latest = useRef(events);
  useLayoutEffect(() => {
    latest.current = events;
  });

  useEffect(() => {
    const element = host.current;
    if (element === null || option === undefined || box.width <= 0) return;
    const size = { width: box.width, height: box.height };
    let drawing = chart.current;
    if (drawing === undefined) {
      drawing = init(element, null, { renderer: "canvas", ...size });
      drawing.on("click", (params: ClickParams) => {
        if (params.componentType !== "series") return;
        latest.current.click(params.seriesIndex ?? -1, params.dataIndex ?? -1);
      });
      drawing.on("finished", () => latest.current.drawn());
      chart.current = drawing;
    } else {
      drawing.resize(size);
    }
    drawing.setOption(option as EChartsCoreOption, { notMerge: true });
  }, [host, option, box.width, box.height]);

  useEffect(
    () => () => {
      chart.current?.dispose();
      chart.current = undefined;
    },
    [],
  );

  const showTip = useCallback((seriesIndex: number, dataIndex: number) => {
    chart.current?.dispatchAction({ type: "showTip", seriesIndex, dataIndex });
  }, []);
  const hideTip = useCallback(() => {
    chart.current?.dispatchAction({ type: "hideTip" });
  }, []);
  return { showTip, hideTip };
};
