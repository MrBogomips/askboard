// The widgets' new models are plain ECMAScript pure functions (latex-kanban-timeline, design
// decisions 7, 9 and 10; AD-1): no `Date`, no DOM, no React, no Node or Bun API, and imports only of
// `contract`, the shared time code, the Gantt's layout constants and their own folder; the LaTeX's
// `render.ts` is the one place KaTeX is imported, and is not scanned. The import check enforces the
// packages; this, the globals.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const SOURCES = [
  "timeline/layout.ts",
  "timeline/model.ts",
  "kanban/model.ts",
  "latex/model.ts",
].map((path) => join(import.meta.dir, "..", path));

const FORBIDDEN =
  /\b(Date|window|document|navigator|globalThis|process|Bun|require|setTimeout|setInterval|requestAnimationFrame|localStorage|fetch|Math\.random)\b/;
const IMPORT = /^import( type\s)?[^"]*"([^"]+)"/gm;
const ALLOWED = /^(@askboard\/contract|\.\/|\.\.\/shared\/time\/|\.\.\/gantt\/model\/layout\.ts)/;

describe("the Kanban's, the LaTeX's and the Timeline's models", () => {
  test.each(SOURCES)(
    "%s names no global outside ECMAScript and imports only its units",
    async (path) => {
      const text = await Bun.file(path).text();
      const code = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(FORBIDDEN.exec(code)?.[0]).toBeUndefined();
      const specifiers = [...code.matchAll(IMPORT)].map(([, , specifier]) => specifier as string);
      expect(specifiers.length).toBeGreaterThan(0);
      expect(specifiers.filter((specifier) => !ALLOWED.test(specifier))).toEqual([]);
    },
  );
});
