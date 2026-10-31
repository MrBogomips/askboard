// The Gantt's model and the board's graph are plain ECMAScript pure functions (design decision 8,
// AD-13): no `Date`, no DOM, no React, no Node or Bun API, and imports only of `contract`,
// `compute` and their own folders. The import check enforces the packages; this, the globals.

import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const FOLDERS = [import.meta.dir, join(import.meta.dir, "../../graph")];

const sources = FOLDERS.flatMap((folder) =>
  readdirSync(folder)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(folder, name)),
);

const FORBIDDEN =
  /\b(Date|window|document|navigator|globalThis|process|Bun|require|setTimeout|setInterval|requestAnimationFrame|localStorage|fetch|Math\.random)\b/;
const IMPORT = /^import[^"]*"([^"]+)"/gm;
const ALLOWED = /^(@askboard\/contract|@askboard\/compute|\.\/|\.\.\/)/;

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
      for (const [, specifier] of code.matchAll(IMPORT)) {
        expect({ specifier, allowed: ALLOWED.test(specifier as string) }).toEqual({
          specifier,
          allowed: true,
        });
      }
    },
  );
});
