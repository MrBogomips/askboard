// The Gantt frame's chrome (DESIGN.md Base controls, Widget frame; Widgets, Gantt; EXPERIENCE
// Change highlight): the toolbar row on `muted`, `spacing.toolbar-row` high, whose counter on the
// right reads "No changes", then "Your changes: N" after the `change` dot, and in a plan
// "· M follow from the WBS" (`model/counter.ts`; EXPERIENCE State Patterns, Widget); and the legend
// under the body: task, critical path, "your change" and, once one is drawn, "Baseline"
// (colour page). A plan's toolbar holds its zoom on the left
// (`zoom.tsx`), a second Tab stop before the grid; a standalone Gantt's holds only the counter.

import { type StringKey, useStrings } from "@askboard/view/catalog";
import { Switch } from "radix-ui";
import { useRef } from "react";
import { keyPressOf } from "./key-press.ts";
import { counterText } from "./model/counter.ts";
import { switchKeyMove } from "./model/keys.ts";
import { type LegendEntry, legendEntries } from "./model/legend.ts";
import { ZoomControl, type ZoomProps } from "./zoom.tsx";

/** The "Critical path" switch's state: on when the Gantt opens, view state only (decision 8). */
export type CriticalSwitch = {
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
};

/**
 * The switch in the toolbar: a Radix Switch with its label. After a plan's zoom, the left arrow
 * and Home take the focus back to the zoom's last option, so that the arrow keys reach it.
 */
const CriticalToggle = ({
  itemId,
  critical,
  onBefore,
}: {
  readonly itemId: string;
  readonly critical: CriticalSwitch;
  readonly onBefore: (() => void) | undefined;
}) => {
  const text = useStrings();
  const id = `${itemId}-critical-switch`;
  return (
    <span className="flex items-center gap-1.5 text-control text-foreground-secondary">
      <Switch.Root
        id={id}
        checked={critical.on}
        onCheckedChange={critical.onChange}
        data-gantt-critical-switch=""
        className="relative h-[16px] w-[28px] shrink-0 rounded-full border border-border-strong bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary"
        onKeyDown={(event) => {
          const press = keyPressOf(event);
          if (onBefore === undefined || press === undefined || switchKeyMove(press) === undefined) {
            return;
          }
          event.preventDefault();
          onBefore();
        }}
      >
        <Switch.Thumb className="block size-[10px] translate-x-[2px] rounded-full bg-foreground-secondary transition-transform data-[state=checked]:translate-x-[14px] data-[state=checked]:bg-primary-foreground" />
      </Switch.Root>
      <label htmlFor={id}>{text("gantt.critical.switch")}</label>
    </span>
  );
};

export const Toolbar = ({
  itemId,
  count,
  derived,
  zoom,
  critical,
}: {
  readonly itemId: string;
  readonly count: number;
  /** The tasks of a plan that follow its Tree; 0 for a Gantt with its own tasks. */
  readonly derived: number;
  /** A plan's zoom; undefined for a Gantt with its own tasks, which shows the week. */
  readonly zoom: ZoomProps | undefined;
  readonly critical: CriticalSwitch;
}) => {
  const text = useStrings();
  // The zoom's options, which the switch's arrow keys and the zoom's last option reach each other by.
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const focusLastZoom = () => options.current.findLast((option) => option !== null)?.focus();
  return (
    <div className="flex h-[32px] items-center justify-between gap-2 rounded-t-md border-b border-border bg-muted px-2">
      <span className="flex min-w-0 items-center gap-3">
        {zoom === undefined ? null : (
          <ZoomControl
            {...zoom}
            options={options}
            onAfter={() => document.getElementById(`${itemId}-critical-switch`)?.focus()}
          />
        )}
        <CriticalToggle
          itemId={itemId}
          critical={critical}
          onBefore={zoom === undefined ? undefined : focusLastZoom}
        />
      </span>
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

const LEGEND: Readonly<Record<LegendEntry, { readonly key: StringKey; readonly swatch: string }>> =
  {
    task: { key: "gantt.legend.task", swatch: "h-[8px] w-[16px] bg-gantt-bar" },
    critical: { key: "gantt.legend.critical", swatch: "h-[8px] w-[16px] bg-critical" },
    change: {
      key: "gantt.legend.change",
      swatch: "mx-0.5 h-[6px] w-[12px] outline-2 outline-offset-1 outline-change",
    },
    baseline: {
      key: "gantt.legend.baseline",
      swatch: "h-0 w-[16px] border-t-2 border-dashed border-border-strong",
    },
  };

export const Legend = ({
  baseline,
  highlight,
}: {
  readonly baseline: boolean;
  /** Whether the critical path is highlighted: its entry shows only then. */
  readonly highlight: boolean;
}) => {
  const text = useStrings();
  return (
    <div className="flex items-center gap-4 border-t border-border px-2 py-1.5 text-badge text-muted-foreground">
      {legendEntries(highlight, baseline).map((entry) => (
        <span
          key={entry}
          data-gantt-legend-baseline={entry === "baseline" ? "" : undefined}
          data-gantt-legend={entry}
          className="inline-flex items-center gap-1.5"
        >
          <Swatch className={LEGEND[entry].swatch} />
          {text(LEGEND[entry].key)}
        </span>
      ))}
    </div>
  );
};
