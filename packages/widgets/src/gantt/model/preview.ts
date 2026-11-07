// What a bar looks like while the pointer drags it (design decision 9; EXPERIENCE Widgets, Gantt):
// moved, at the day `drag.ts` says it would land on, so that it snaps to working days and stops at
// the earliest start before the drop; resized, to the nearest day under its end, keeping its first
// day. Only the drop changes the draft: the graph is rebuilt then, never while the pointer moves,
// so a moved bar keeps its width until the graph gives the new one. Plain numbers.

import { PIXELS_PER_DAY, xOf, type Zoom } from "../../shared/time/scale.ts";
import type { Move } from "./drag.ts";
import type { BarBox } from "./layout.ts";

/** The bar at the day it would land on; the same box while the press is still a click. */
export const movedBox = (box: BarBox, landing: Move, origin: string, zoom: Zoom): BarBox =>
  landing.kind === "click" ? box : Object.freeze({ ...box, x: xOf(landing.start, origin, zoom) });

/** The bar with its end moved by `dx` pixels, to the nearest day, never before its first day. */
export const resizedBox = (box: BarBox, dx: number, zoom: Zoom): BarBox => {
  const perDay = PIXELS_PER_DAY[zoom];
  const days = Math.round(box.width / perDay) + Math.round(dx / perDay);
  return Object.freeze({ ...box, width: Math.max(1, days) * perDay });
};
