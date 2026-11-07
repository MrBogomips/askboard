// The session process as the entry point starts it (design decision 9): Claude Code's stdio, this
// process's identity and environment, and the view build in `view/` beside the bundle (AD-2,
// AD-19).

import { fileURLToPath } from "node:url";
import { VIEW_DIRECTORY } from "@askboard/contract";
import serverPackage from "../package.json" with { type: "json" };
import { callerFolder } from "./caller-folder.ts";
import { processOf } from "./mcp-tools/index.ts";
import { startSessionProcess } from "./session-process.ts";

/** Starts the session process of the bundle at `bundleUrl`, the entry point's `import.meta.url`. */
export const startEntryPoint = (bundleUrl: string): void => {
  startSessionProcess({
    env: process.env,
    platform: process.platform,
    cwd: callerFolder(process.env, process.cwd()),
    view: fileURLToPath(new URL(`./${VIEW_DIRECTORY}/`, bundleUrl)),
    version: serverPackage.version,
    process: processOf(process),
    pid: process.pid,
    parentPid: process.ppid,
    // NFR-7: macOS and Linux, where every process has a user ID.
    uid: process.getuid?.() ?? 0,
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
};
