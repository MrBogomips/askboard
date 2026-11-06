// A Gantt row's height from the density token the view's root holds (review F-23).

import { ROW_HEIGHT } from "./layout.ts";

/** A token's computed value as pixels: "40px" is 40; anything else, which is no height, is the compact one. */
export const rowHeightOf = (value: string): number => {
  const pixels = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value);
  const height = pixels?.[1] === undefined ? Number.NaN : Number(pixels[1]);
  return height > 0 ? height : ROW_HEIGHT;
};
