// A Gantt plan's zoom (design decisions 9 and 10; DESIGN.md Base controls, Segmented control, and
// Molecules, Gantt plan; EXPERIENCE Base controls, Segmented control): "Day | Week | Month" (labels
// provisional), a segmented control on Radix Toggle Group, single selection whose options are
// radios. It keeps Radix's toggle-group keys: one Tab stop, the chosen zoom when the focus comes
// in, the arrow keys, Home and End moving among the options, wrapping, and Space or Enter choosing
// one. The focus moves by the model's toolbar keys (`model/keys.ts`, `model/focus.ts`) rather than
// Radix's roving focus, whose group is a Tab stop of its own: Firefox's Shift+Tab lands on it, and
// it hands the focus back to the chosen option, so the focus never left backwards. Choosing the
// zoom shown keeps it: a toggle group would turn it off. The zoom is view state: it rescales the
// chart and reaches no draft, and a read-only Gantt keeps it (AD-10).

import { ToggleGroup } from "radix-ui";
import { type FocusEvent, type KeyboardEvent, useRef, useState } from "react";
import { keyPressOf } from "./key-press.ts";
import { nextTool, toolTabStop } from "./model/focus.ts";
import { toolbarKeyMove } from "./model/keys.ts";
import { isZoom, ZOOMS, type Zoom } from "./model/scale.ts";

const LABELS: Readonly<Record<Zoom, string>> = { day: "Day", week: "Week", month: "Month" };

/** Every zoom may be chosen, whether or not the Gantt takes edits. */
const ENABLED: readonly boolean[] = ZOOMS.map(() => true);

/**
 * The segmented control's one look (`view/src/styles/segment.css`, review F-17): a sunken track and
 * its segments, the chosen one underlined in `primary`. The names repeat `shell/segment-classes.ts`,
 * which a widget cannot import (AD-1); a test holds the two together.
 */
const TRACK = "askboard-segments";
const SEGMENT = "askboard-segment";

export type ZoomProps = {
  readonly zoom: Zoom;
  readonly onZoom: (zoom: Zoom) => void;
};

export const ZoomControl = ({ zoom, onZoom }: ZoomProps) => {
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  // The option the focus is on while it is in the control: the Tab stop follows it, so that
  // Shift+Tab leaves; once the focus has left, the stop is the chosen zoom again.
  const [focused, setFocused] = useState<number | undefined>(undefined);
  const stop = toolTabStop(ENABLED, focused ?? ZOOMS.indexOf(zoom));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const press = keyPressOf(event);
    const move = press === undefined ? undefined : toolbarKeyMove(press);
    if (move === undefined || focused === undefined) return;
    event.preventDefault();
    options.current[nextTool(ENABLED, focused, move)]?.focus();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const to = event.relatedTarget;
    if (!(to instanceof Node && event.currentTarget.contains(to))) setFocused(undefined);
  };
  return (
    <ToggleGroup.Root
      type="single"
      value={zoom}
      onValueChange={(next) => {
        if (isZoom(next)) onZoom(next);
      }}
      rovingFocus={false}
      aria-label="Zoom"
      className={TRACK}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      {ZOOMS.map((option, at) => (
        <ToggleGroup.Item
          key={option}
          ref={(button) => {
            options.current[at] = button;
          }}
          value={option}
          tabIndex={at === stop ? 0 : -1}
          onFocus={() => setFocused(at)}
          className={SEGMENT}
        >
          {LABELS[option]}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
};
