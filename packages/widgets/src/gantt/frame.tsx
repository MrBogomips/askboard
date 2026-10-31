// The Gantt's widget frame (design decision 9; DESIGN.md Base controls, Widget frame, and Widgets,
// Gantt): a bordered box holding the body, the grid on the left and the chart on the right in a
// region that scrolls sideways, then the legend under them: task, critical path and "your change"
// (colour page). The scrolling region keeps out of the Tab order, so that the grid stays the
// Gantt's one Tab stop: the grid carries every keyboard path.

import { Chart, type ChartProps } from "./chart.tsx";
import { Grid, type GridProps } from "./grid.tsx";

const Swatch = ({ className }: { readonly className: string }) => (
  <span aria-hidden="true" className={`inline-block ${className}`} />
);

const Legend = () => (
  <div className="flex items-center gap-4 border-t border-border px-2 py-1.5 text-badge text-muted-foreground">
    <span className="inline-flex items-center gap-1.5">
      <Swatch className="h-[8px] w-[16px] bg-gantt-bar" />
      task
    </span>
    <span className="inline-flex items-center gap-1.5">
      <Swatch className="h-[8px] w-[16px] bg-critical" />
      critical path
    </span>
    <span className="inline-flex items-center gap-1.5">
      <Swatch className="mx-0.5 h-[6px] w-[12px] outline-2 outline-offset-1 outline-change" />
      your change
    </span>
  </div>
);

export type FrameProps = GridProps & ChartProps;

export const GanttFrame = (props: FrameProps) => (
  <div className="flex flex-col rounded-md border border-border bg-card">
    <div className="flex">
      <div className="w-[480px] shrink-0 border-r border-border">
        <Grid questionId={props.questionId} rows={props.rows} schedules={props.schedules} />
      </div>
      <div tabIndex={-1} className="min-w-0 flex-1 overflow-x-auto outline-none">
        <Chart
          itemId={props.itemId}
          rows={props.rows}
          schedules={props.schedules}
          layout={props.layout}
          span={props.span}
          zoom={props.zoom}
        />
      </div>
    </div>
    <Legend />
  </div>
);
