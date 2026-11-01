// Whether a model request carried an appended row (AD-4; mod spec, "An event is pushed once";
// design decision 7, Turn tracking, review fix of 2026-11-01; findings O7, D6): counted in requests,
// never by clock times. A row is in every request of its agent that starts after its append
// resolved, except a turn's first request, which the engine fixes when the turn starts
// (`d-esc2-312`): a row appended before that request is carried only from the turn's second.

import type { Appended } from "./memory.ts";

/** The request a row appended before a turn's first one is carried from. */
const SECOND_REQUEST = 2;

/** The first request of the turn that carries a row whose append resolved after `steps` of them. */
export const carriedFrom = (steps: number): number => (steps === 0 ? SECOND_REQUEST : steps + 1);

/** Whether one of the turn's `steps` requests so far carried the row. */
export const isCarried = (row: Appended, steps: number): boolean => steps >= row.carriedFrom;
