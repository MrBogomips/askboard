// The installed KaTeX's version, read from its package.json, for the tests that speak of it
// (latex-public-api, task 3.2): no test names the version as a literal. A KaTeX bump needs one
// edit, the key and text of its entry in `tools/font-licences.json`, after the fonts' name tables
// are read again (AD-19); the tests that check the table fail until it is made.

import { readFileSync } from "node:fs";
import { resolveFromWidgets } from "./paths.ts";

export const KATEX_VERSION: string = (
  JSON.parse(readFileSync(resolveFromWidgets("katex/package.json"), "utf8")) as { version: string }
).version;
