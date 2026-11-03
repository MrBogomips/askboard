// The Gantt frame's chrome (DESIGN.md Base controls, Widget frame; Widgets, Gantt; EXPERIENCE
// Change highlight): the toolbar row on `muted`, `spacing.toolbar-row` high, whose counter on the
// right reads "Changes vs agent's original · none yet", then "Your changes: N" after the
// `change` dot (EXPERIENCE State Patterns, Widget); and the legend under the body: task, critical
// path and "your change" (colour page). A plan's toolbar holds its zoom on the left
// (`zoom.tsx`), a second Tab stop before the grid; a standalone Gantt's holds only the counter.

import { changeCounter } from "./model/marks.ts";
import { ZoomControl, type ZoomProps } from "./zoom.tsx";

export const Toolbar = ({
  count,
  zoom,
}: {
  readonly count: number;
  /** A plan's zoom; undefined for a Gantt with its own tasks, which shows the week. */
  readonly zoom: ZoomProps | undefined;
}) => (
  <div
    className={`flex h-[32px] items-center gap-2 rounded-t-md border-b border-border bg-muted px-2 ${zoom === undefined ? "justify-end" : "justify-between"}`}
  >
    {zoom === undefined ? null : <ZoomControl {...zoom} />}
    <span
      data-gantt-counter=""
      className="flex shrink-0 items-center gap-[6px] text-control text-foreground-secondary"
    >
      {count > 0 ? (
        <span aria-hidden="true" className="size-[8px] shrink-0 rounded-full bg-change" />
      ) : null}
      {changeCounter(count)}
    </span>
  </div>
);

const Swatch = ({ className }: { readonly className: string }) => (
  <span aria-hidden="true" className={`inline-block ${className}`} />
);

export const Legend = () => (
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
