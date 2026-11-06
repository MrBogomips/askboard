// The Gantt frame's chrome (DESIGN.md Base controls, Widget frame; Widgets, Gantt; EXPERIENCE
// Change highlight): the toolbar row on `muted`, `spacing.toolbar-row` high, whose counter on the
// right reads "No changes", then "Your changes: N" after the `change` dot, and in a plan
// "· M follow from the WBS" (`model/counter.ts`; EXPERIENCE State Patterns, Widget); and the legend
// under the body: task, critical path, "your change" and, once one is drawn, "agent's plan"
// (colour page). A plan's toolbar holds its zoom on the left
// (`zoom.tsx`), a second Tab stop before the grid; a standalone Gantt's holds only the counter.

import { useStrings } from "@askboard/view/catalog";
import { counterText } from "./model/counter.ts";
import { ZoomControl, type ZoomProps } from "./zoom.tsx";

export const Toolbar = ({
  count,
  derived,
  zoom,
}: {
  readonly count: number;
  /** The tasks of a plan that follow its Tree; 0 for a Gantt with its own tasks. */
  readonly derived: number;
  /** A plan's zoom; undefined for a Gantt with its own tasks, which shows the week. */
  readonly zoom: ZoomProps | undefined;
}) => {
  const text = useStrings();
  return (
    <div
      className={`flex h-[32px] items-center gap-2 rounded-t-md border-b border-border bg-muted px-2 ${zoom === undefined ? "justify-end" : "justify-between"}`}
    >
      {zoom === undefined ? null : <ZoomControl {...zoom} />}
      <span
        data-gantt-counter=""
        title={counterText(count, derived, text)}
        className="flex min-w-0 items-center gap-[6px] text-control text-foreground-secondary"
      >
        {count > 0 ? (
          <span aria-hidden="true" className="size-[8px] shrink-0 rounded-full bg-change" />
        ) : null}
        <span className="min-w-0 truncate">{counterText(count, derived, text)}</span>
      </span>
    </div>
  );
};

const Swatch = ({ className }: { readonly className: string }) => (
  <span aria-hidden="true" className={`inline-block ${className}`} />
);

export const Legend = ({ baseline }: { readonly baseline: boolean }) => {
  const text = useStrings();
  return (
    <div className="flex items-center gap-4 border-t border-border px-2 py-1.5 text-badge text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Swatch className="h-[8px] w-[16px] bg-gantt-bar" />
        {text("gantt.legend.task")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch className="h-[8px] w-[16px] bg-critical" />
        {text("gantt.legend.critical")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch className="mx-0.5 h-[6px] w-[12px] outline-2 outline-offset-1 outline-change" />
        {text("gantt.legend.change")}
      </span>
      {baseline ? (
        <span data-gantt-legend-baseline="" className="inline-flex items-center gap-1.5">
          <Swatch className="h-0 w-[16px] border-t-2 border-dashed border-border-strong" />
          {text("gantt.legend.baseline")}
        </span>
      ) : null}
    </div>
  );
};
