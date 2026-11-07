// What a pointer and a thumb put into the draft (view-and-widgets spec: Scale as a slider, Scale as
// a rating; design decision 8). Pure. Every value is snapped to a step of the contract's grid
// before it becomes a result, so that the result passes the contract's check whatever rounding
// the slider library does of its own.

import type { ScaleProps, ScaleResult } from "@askboard/contract";
import { ratingValues, resultOf, snap } from "./model.ts";

/** The pointer's place on the track, 0 at its start and 1 at its end; 0 for a track with no width. */
export const trackFraction = (clientX: number, left: number, width: number): number =>
  width <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - left) / width));

/** The result of the slider's thumbs, each snapped to a step; throws on a count the props do not take. */
export const sliderChange = (props: ScaleProps, values: readonly number[]): ScaleResult =>
  resultOf(
    props,
    values.map((value) => snap(props, value)),
  );

/**
 * The result of pressing the rating's toggle `index` (its place among the steps, as text), or none
 * for the empty value a pressed toggle pressed again reports and for a place the scale lacks.
 */
export const ratingChange = (props: ScaleProps, index: string): ScaleResult | undefined => {
  const value = /^\d+$/.test(index) ? ratingValues(props)[Number(index)] : undefined;
  return value === undefined ? undefined : { value };
};
