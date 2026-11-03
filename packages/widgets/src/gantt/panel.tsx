// A task's predecessors panel (design decision 9; proposal, open question 9; EXPERIENCE Widgets,
// Gantt): an inline panel under the task's "Depends on" cell, laid over the rows below so that the
// grid's rows stay beside the chart's, listing every other task with a Radix Checkbox, in a plan
// every other leaf of its Tree, a package the user added there included; a task that would close a
// cycle or break a limit is disabled, its reason beside it. After them, each predecessor the task
// held that names no other task, labelled with its ID and saying so, for the user to uncheck (task
// 9.3). The text beside a box describes it. The first box takes the focus when it opens; the up
// and down arrows move between the boxes, Space checks or unchecks, and "Done" or Enter commits,
// Escape restores. The focus stays in the panel while it is open: a box the pointer checks takes
// it, since WebKit focuses no button on a click, and a press anywhere else in the panel leaves it
// where it is. Task names are agent strings, shown as text.

import type { GanttProps } from "@askboard/contract";
import { Checkbox } from "radix-ui";
import { type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { keyPressOf } from "./key-press.ts";
import { panelBoxes } from "./model/predecessors.ts";
import type { GanttRow } from "./model/tasks.ts";
import type { Panel } from "./panel-state.ts";

const PANEL =
  "absolute top-full right-0 z-20 mt-0.5 flex w-[300px] flex-col gap-2 rounded-md border " +
  "border-border bg-popover p-2 text-left font-sans text-body text-popover-foreground shadow-md";

/** The empty mark, ringed in the input colour and in primary once checked, as Choice's. */
const BOX =
  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md border border-input " +
  "bg-card data-[state=checked]:border-primary disabled:opacity-50 focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring";

/** `button-secondary`, with the focus ring. */
const DONE =
  "h-[28px] rounded-md border border-border bg-muted px-3 text-control text-foreground " +
  "hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

const boxId = (itemId: string, taskId: string, other: string) =>
  `${itemId}:${taskId}:panel:${other}`;

type PanelProps = {
  readonly itemId: string;
  readonly row: GanttRow;
  /** The Gantt as it stands, and its rows, which the boxes are checked against. */
  readonly current: GanttProps;
  readonly rows: readonly GanttRow[];
  readonly panel: Panel;
  readonly onToggle: (taskId: string, checked: boolean) => void;
  readonly onDone: () => void;
  readonly onCancel: () => void;
};

export const PredecessorsPanel = (props: PanelProps) => {
  const { itemId, row, panel } = props;
  const boxes = panelBoxes(props.current, props.rows, row.id, panel.held, panel.opened);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useLayoutEffect(() => {
    refs.current.find((box) => box !== null && !box.disabled)?.focus();
  }, []);
  // The up and down arrows move between the enabled boxes, with no wrap.
  const moveFrom = (target: EventTarget, step: number) => {
    const enabled = refs.current.filter(
      (box): box is HTMLButtonElement => box !== null && !box.disabled,
    );
    const at = enabled.indexOf(target as HTMLButtonElement);
    enabled[Math.min(enabled.length - 1, Math.max(0, at + step))]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    const press = keyPressOf(event);
    if (press === undefined || press.altKey || press.ctrlKey || press.metaKey || press.shiftKey) {
      return;
    }
    if (press.key === "Enter") props.onDone();
    else if (press.key === "Escape") props.onCancel();
    else if (press.key === "ArrowDown") moveFrom(event.target, 1);
    else if (press.key === "ArrowUp") moveFrom(event.target, -1);
    // Nothing to delete in the panel: no "go back" either.
    else if (press.key !== "Backspace" && press.key !== "Delete") return;
    event.preventDefault();
  };
  return (
    <fieldset
      aria-label={`Depends on, ${row.label}`}
      data-gantt-panel={row.id}
      className={PANEL}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => event.preventDefault()}
    >
      <ul className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
        {boxes.map((box, index) => {
          const id = boxId(itemId, row.id, box.id);
          // A disabled box says why; a box for an ID that names no other task says so.
          const text = box.reason ?? box.note;
          return (
            <li key={box.id} className="flex items-start gap-2">
              <Checkbox.Root
                id={id}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                checked={box.checked}
                disabled={box.reason !== undefined}
                aria-describedby={text === undefined ? undefined : `${id}:why`}
                onCheckedChange={(checked) => props.onToggle(box.id, checked === true)}
                onClick={(event) => event.currentTarget.focus()}
                className={BOX}
              >
                <Checkbox.Indicator className="size-2 bg-primary" />
              </Checkbox.Root>
              <span className="flex min-w-0 flex-col">
                <label htmlFor={id} className="truncate">
                  {box.label}
                </label>
                {text === undefined ? null : (
                  <span id={`${id}:why`} className="text-badge text-muted-foreground">
                    {text}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={props.onDone} className={DONE}>
          Done
        </button>
      </div>
    </fieldset>
  );
};
