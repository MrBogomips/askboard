import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

type Bar = { label: string; value: number };

const barsOf = (value: unknown): Bar[] =>
  Array.isArray(value) ? value.filter((b): b is Bar => typeof b?.label === "string" && typeof b?.value === "number") : [];

// Chart (EXPERIENCE.md, Components) on ECharts with the canvas renderer, colours from the
// tokens. A click on a bar picks it: the item's value in the draft record. ECharts' animation is
// off so the first frame is the final one.
const Chart = ({ item, draft, emit, ready }: ItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const bars = useMemo(() => barsOf(item.props?.bars), [item.props?.bars]);
  const rich = item.props?.richTooltip === true;
  useEffect(() => {
    if (!ref.current) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(`--${name}`).trim();
    const chart = echarts.init(ref.current, null, { renderer: "canvas" });
    // Registered before `setOption`, which may render and finish at once.
    chart.on("finished", () => setDone(true));
    chart.setOption({
      animation: false,
      grid: { left: 40, right: 16, top: 16, bottom: 32 },
      // ECharts writes an HTML tooltip as markup with `style` attributes; `richText` draws it
      // on the canvas instead (`props.richTooltip`, the measured change).
      tooltip: { trigger: "item", ...(rich ? { renderMode: "richText" } : {}) },
      xAxis: { type: "category", data: bars.map((b) => b.label), axisLabel: { color: token("muted-foreground") } },
      yAxis: { type: "value", axisLabel: { color: token("muted-foreground") } },
      series: [
        {
          type: "bar",
          data: bars.map((b) => ({
            value: b.value,
            itemStyle: { color: b.label === draft ? token("change") : token("primary") },
          })),
        },
      ],
    });
    chart.on("click", (event) => emit({ type: "draft.set", id: item.id, value: bars[event.dataIndex]?.label ?? null }));
    return () => chart.dispose();
  }, [bars, draft, emit, item.id, rich]);
  useReadyAfterLayout(ready, done);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-label uppercase text-muted-foreground">{text(item.props?.label)}</figcaption>
      <div ref={ref} className="h-64 w-[480px]" data-chart={item.id} />
    </figure>
  );
};

register("Chart", Chart);
