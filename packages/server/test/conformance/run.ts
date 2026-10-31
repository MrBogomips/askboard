// The end-to-end conformance suite's runner (task 9.2, design decision 11): checks what the suite
// needs, then runs `conformance.e2e.ts` and the ask lifecycle's `lifecycle.e2e.ts` (ask-lifecycle,
// task 7.2) with the session process on one runtime. The suite drives the built bundle, so it stays
// out of `bun run check`, which builds nothing: its file names match no test pattern, and only this
// runner names them.
//
// The session process is `dist/askboard.mjs` in place, serving the real `dist/view/`, and the plain
// choice and the ask with areas are answered on the real board page in Playwright's Chromium: run
// `bun run build` first, and install the engine with `playwright install chromium`.
//
// Usage: bun packages/server/test/conformance/run.ts --runtime bun|node
//   --runtime  the runtime of the session process: Bun (this one), or Node 24.22.1 or later found
//              on PATH from the repository root.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { meetsNodeFloor, parseOptions, type RunOptions } from "./options.ts";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const SUITES = [
  "./packages/server/test/conformance/conformance.e2e.ts",
  "./packages/server/test/conformance/lifecycle.e2e.ts",
];

// The runtime's executable: Bun is this process; Node is the one the repository's PATH gives, its
// real path, since a version manager's shim chooses by the working folder.
const runtimeOf = (runtime: RunOptions["runtime"]): { path: string } | { error: string } => {
  if (runtime === "bun") return { path: process.execPath };
  const probe = Bun.spawnSync(["node", "-p", "process.execPath + ' ' + process.version"], {
    cwd: ROOT,
  });
  const [path = "", version = ""] = probe.stdout.toString().trim().split(" ");
  if (probe.exitCode !== 0 || path === "") return { error: "node is not on PATH" };
  if (!meetsNodeFloor(version)) return { error: `node ${version} is below 24.22.1 (AD-19)` };
  return { path };
};

// What the suite needs before it starts, or why it cannot run here.
const missing = (): string | undefined => {
  if (!existsSync(join(ROOT, "dist", "askboard.mjs"))) {
    return "dist/askboard.mjs is missing: run bun run build:server first";
  }
  if (!existsSync(join(ROOT, "dist", "view", "manifest.json"))) {
    return "dist/view/manifest.json is missing: run bun run build:view first";
  }
  if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) {
    return "this is a container, where AskBoard shows no board (AD-18): run the suite on the host";
  }
  return undefined;
};

export const main = async (
  args: readonly string[],
  log: (line: string) => void = console.error,
): Promise<number> => {
  const options = parseOptions(args);
  if ("error" in options) {
    log(options.error);
    return 2;
  }
  const problem = missing();
  const runtime = runtimeOf(options.runtime);
  if (problem !== undefined || "error" in runtime) {
    log(`conformance: ${problem ?? ("error" in runtime ? runtime.error : "")}`);
    return 2;
  }
  log(`conformance: the session process on ${options.runtime} (${runtime.path})`);
  const suite = Bun.spawn([process.execPath, "test", ...SUITES, "--timeout", "60000"], {
    cwd: ROOT,
    stdio: ["inherit", "inherit", "inherit"],
    env: {
      ...process.env,
      ASKBOARD_CONFORMANCE_RUNTIME: runtime.path,
    },
  });
  return await suite.exited;
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}
