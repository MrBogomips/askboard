import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The shared pieces name no widget type in their code (design decision 7), so that the Image
// annotation and later annotating widgets import them unmoved. Comments cite the change that made
// them and the widgets that use them, so only code lines are read.
const here = import.meta.dir;
const NAMES = [
  "document-review",
  "document review",
  "documentreview",
  "image-annotation",
  "image annotation",
  "imageannotation",
  "diagram",
  "diff-review",
  "diff review",
];

describe("the shared annotation pieces", () => {
  const files = readdirSync(here).filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"));

  test("the folder holds the pieces and their tests", () => {
    for (const piece of ["pin.tsx", "card.tsx", "list.tsx", "index.ts", "classes.ts"]) {
      expect(files).toContain(piece);
    }
  });

  const codeOf = (name: string): string =>
    readFileSync(join(here, name), "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join("\n")
      .toLowerCase();

  test("no source names a widget type", () => {
    const sources = files.filter((name) => !name.includes(".test."));
    for (const name of sources) {
      const source = codeOf(name);
      for (const type of NAMES) expect([name, source.includes(type)]).toEqual([name, false]);
    }
  });

  test("the grep sees what it should: a line of code naming one is found", () => {
    expect(codeOf("names-no-type.test.ts")).toContain("document-review");
  });
});
