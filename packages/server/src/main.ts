// The session process entry point (design decision 9; AD-1 as amended by E1): Claude Code starts it
// over stdio, one per session (AD-2). Built into `dist/askboard.mjs`, it finds the view build in
// `view/` beside itself, and runs on Bun and on Node 24.22.1 or later through Node's API only
// (AD-19). Nothing imports this file.

import { fileURLToPath } from "node:url";
import { VIEW_DIRECTORY } from "@askboard/contract";
import serverPackage from "../package.json" with { type: "json" };
import { processOf } from "./mcp-tools/index.ts";
import { startSessionProcess } from "./session-process.ts";

startSessionProcess({
  env: process.env,
  platform: process.platform,
  cwd: process.cwd(),
  view: fileURLToPath(new URL(`./${VIEW_DIRECTORY}/`, import.meta.url)),
  version: serverPackage.version,
  process: processOf(process),
  stderr: (line) => process.stderr.write(`${line}\n`),
});
