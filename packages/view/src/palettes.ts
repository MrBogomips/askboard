// The shell's palette stylesheets (palettes, design decision D4): the view build writes each named
// palette's CSS as its own file beside the shell's styles, and `assemble` keeps, for a Snapshot, the
// one its record names. A plain module (no DOM, Node or Bun API): the build and `assemble` share it,
// so the file's name has one definition.

import { PALETTES, type Palette } from "@askboard/contract";

const PREFIX = "chunks/shell-palette-";
const SUFFIX = ".css";

/** The path of a palette's stylesheet in the view build's folder; Carta's CSS is the shell's own. */
export const paletteStylePath = (name: Palette): string => {
  if (!PALETTES.includes(name)) throw new Error(`"${name}" is not a palette the contract names`);
  return `${PREFIX}${name}${SUFFIX}`;
};

/** The palette a stylesheet path belongs to, or undefined for any other path. */
export const paletteOfStyle = (path: string): Palette | undefined =>
  PALETTES.find((name) => path === `${PREFIX}${name}${SUFFIX}`);
