import { describe, expect, test } from "bun:test";
import { PALETTES } from "@askboard/contract";
import { paletteOfStyle, paletteStylePath } from "./palettes.ts";

// The shell's palette sheets (palettes, task 2.4, design decision D4): one file per palette besides
// Carta, named by the palette, which the build writes and `assemble` filters by.

describe("a palette's stylesheet path", () => {
  test("is chunks/shell-palette-<name>.css, and reads back to its name", () => {
    expect(paletteStylePath("nordico")).toBe("chunks/shell-palette-nordico.css");
    for (const name of PALETTES) expect(paletteOfStyle(paletteStylePath(name))).toBe(name);
  });

  test("any other path is no palette's", () => {
    for (const path of [
      "chunks/shell.css",
      "chunks/shell-palette-inchiostro.css",
      "chunks/shell-palette-.css",
      "chunks/shell-palette-nordico.css.map",
      "shell-palette-nordico.css",
      "chunks/shell-palette-../nordico.css",
      "chunks/shell-palette-constructor.css",
    ]) {
      expect(paletteOfStyle(path)).toBeUndefined();
    }
  });

  test("a name the contract does not list has no path", () => {
    expect(() => paletteStylePath("inchiostro" as never)).toThrow("inchiostro");
  });
});
