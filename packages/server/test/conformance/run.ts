// The end-to-end conformance suite's runner (task 9.2, design decision 11): checks what the suite
// needs, then runs `conformance.e2e.ts` with the session process on one runtime. The suite drives
// the built bundle, so it stays out of `bun run check`, which builds nothing: its file name matches
// no test pattern, and only this runner names it.
//
// Usage: bun packages/server/test/conformance/run.ts --runtime bun|node [--view dist|fixture]
//   --runtime  the runtime of the session process: Bun (this one), or Node 24.22.1 or later found
//              on PATH from the repository root.
//   --view     dist (default): `dist/askboard.mjs` in place, serving the real `dist/view/`;
//              fixture: a copy of the bundle beside Track 0's fixture view build, until the real
//              view build is merged.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { meetsNodeFloor, parseOptions, type RunOptions } from "./options.ts";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const SUITE = "./packages/server/test/conformance/conformance.e2e.ts";

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
const missing = (options: RunOptions): string | undefined => {
  if (!existsSync(join(ROOT, "dist", "askboard.mjs"))) {
    return "dist/askboard.mjs is missing: run bun run build:server first";
  }
  if (options.view === "dist" && !existsSync(join(ROOT, "dist", "view", "manifest.json"))) {
    return "dist/view/manifest.json is missing: run bun run build:view first, or pass --view fixture";
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
  const problem = missing(options);
  const runtime = runtimeOf(options.runtime);
  if (problem !== undefined || "error" in runtime) {
    log(`conformance: ${problem ?? ("error" in runtime ? runtime.error : "")}`);
    return 2;
  }
  log(
    `conformance: the session process on ${options.runtime} (${runtime.path}), ${options.view} view`,
  );
  const suite = Bun.spawn([process.execPath, "test", SUITE, "--timeout", "60000"], {
    cwd: ROOT,
    stdio: ["inherit", "inherit", "inherit"],
    env: {
      ...process.env,
      ASKBOARD_CONFORMANCE_RUNTIME: runtime.path,
      ASKBOARD_CONFORMANCE_VIEW: options.view,
    },
  });
  return await suite.exited;
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}
