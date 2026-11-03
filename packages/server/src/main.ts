// The executable's entry point (design decisions 6 and 9; AD-1 as amended by E1 and push
// delivery, AD-19). Built into `dist/askboard.mjs`, it runs on Bun and on Node 24.22.1 or later
// through Node's API only. Nothing imports this file. By its arguments:
// - `hook <event>`: the hook of that event, for Claude Code's settings hooks; exits 0.
// - `client <path> [<JSON body>]`: one local API request to the session process of the parent
//   Claude Code process, for the mod's fallback.
// - anything else: the session process, which Claude Code starts over stdio, one per session
//   (AD-2), finding the view build in `view/` beside the bundle. It is loaded only then, so the
//   hook and client modes evaluate none of its units, and open no port and write no file.

import { clientProcess, hookProcess } from "@askboard/hooks";

const [mode, ...rest] = process.argv.slice(2);

if (mode === "hook") {
  await hookProcess(rest[0], process);
} else if (mode === "client") {
  await clientProcess(rest, process);
} else {
  const { startEntryPoint } = await import("./session-entry.ts");
  startEntryPoint(import.meta.url);
}
