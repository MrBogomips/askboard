// The Gantt's model and the board's graph are plain ECMAScript pure functions (design decision 8,
// AD-13): no `Date`, no DOM, no React, no Node or Bun API, and imports only of `contract`,
// `compute` and their own folders, besides the port's types (`BoardContent`), which an
// `import type` from `@askboard/view/catalog` brings in and the build erases. The import check
// enforces the packages; this, the globals.

import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const FOLDERS = [
  import.meta.dir,
  join(import.meta.dir, "../../board-graph"),
  // The dates and the time scale the Gantt shares with the Timeline stay pure.
  join(import.meta.dir, "../../shared/time"),
];

const sources = FOLDERS.flatMap((folder) =>
  readdirSync(folder)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(folder, name)),
);

const FORBIDDEN =
  /\b(Date|window|document|navigator|globalThis|process|Bun|require|setTimeout|setInterval|requestAnimationFrame|localStorage|fetch|Math\.random)\b/;
const IMPORT = /^import( type\s)?[^"]*"([^"]+)"/gm;
const ALLOWED = /^(@askboard\/contract|@askboard\/compute|\.\/|\.\.\/)/;
// Only `import type`: under `verbatimModuleSyntax`, `import { type X }` keeps the module import.
const TYPES_ONLY = /^@askboard\/view\/catalog$/;

const allowed = (typeOnly: boolean, specifier: string): boolean =>
  ALLOWED.test(specifier) || (typeOnly && TYPES_ONLY.test(specifier));

describe("the Gantt's model", () => {
  test("has its sources where the scan looks", () => {
    expect(sources.length).toBeGreaterThanOrEqual(10);
  });

  test.each(sources)(
    "%s names no global outside ECMAScript and imports only the model's units",
    async (path) => {
      const text = await Bun.file(path).text();
      const code = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(FORBIDDEN.exec(code)?.[0]).toBeUndefined();
      for (const [, typeOnly, specifier] of code.matchAll(IMPORT)) {
        expect({
          specifier,
          allowed: allowed(typeOnly !== undefined, specifier as string),
        }).toEqual({
          specifier,
          allowed: true,
        });
      }
    },
  );
});
