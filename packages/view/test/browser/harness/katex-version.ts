// The installed KaTeX's version, read from its package.json, for the browser tests that speak of it
// (latex-public-api, task 3.2): no test names the version as a literal.

import { readFileSync } from "node:fs";
import { LATEX_SOURCES } from "./latex-sources.ts";

export const KATEX_VERSION: string = (
  JSON.parse(
    readFileSync(Bun.resolveSync("katex/package.json", LATEX_SOURCES.widgets), "utf8"),
  ) as { version: string }
).version;
