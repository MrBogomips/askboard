// The end-to-end conformance suite's runner (task 9.2, design decision 11): checks what the suite
// needs, then runs it with the session process on one runtime, in each of AD-1's configurations
// (push delivery, task 9.5), one `bun test` each, and says how each went:
// - mod and hooks: `mod-and-hooks.e2e.ts`, the built mod in the stand-in mod host and the hooks;
// - mod disabled: E1's suite, `conformance.e2e.ts`, with its cases with hooks, the ask
//   lifecycle's, `lifecycle.e2e.ts` (ask-lifecycle, task 7.2), and `mod-disabled.e2e.ts`;
// - hooks disabled: E1's and the ask lifecycle's suites with the stand-in mod host beside every
//   session process;
// - in each, the configuration's scenarios, `settings.e2e.ts` (settings-languages, task 4.5).
// The suite drives the built bundle, so it stays out of `bun run check`, which builds nothing:
// its file names match no test pattern, and only this runner names them.
//
// The session process is `dist/askboard.mjs` in place, serving the real `dist/view/`, and the plain
// choice and the ask with areas are answered on the real board page in Playwright's Chromium: run
// `bun run build` first, which also builds the mod, `hooks/askboard-mod.js`, and install the engine
// with `playwright install chromium`.
//
// Usage: bun packages/server/test/conformance/run.ts --runtime bun|node [--configuration <name>]
//   --runtime        the runtime of the session process and the hooks: Bun (this one), or Node
//                    24.22.1 or later found on PATH from the repository root.
//   --configuration  mod-and-hooks, mod-disabled or hooks-disabled: that one alone; all three in
//                    that order when none is named.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { type Configuration, meetsNodeFloor, parseOptions, type RunOptions } from "./options.ts";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");
const SUITE = "./packages/server/test/conformance";

/** The suite's files in each configuration. */
const FILES: Readonly<Record<Configuration, readonly string[]>> = {
  "mod-and-hooks": ["mod-and-hooks.e2e.ts", "settings.e2e.ts", "snapshot.e2e.ts"],
  "mod-disabled": [
    "conformance.e2e.ts",
    "lifecycle.e2e.ts",
    "mod-disabled.e2e.ts",
    "settings.e2e.ts",
    "snapshot.e2e.ts",
  ],
  "hooks-disabled": [
    "conformance.e2e.ts",
    "lifecycle.e2e.ts",
    "settings.e2e.ts",
    "snapshot.e2e.ts",
  ],
};

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
  if (!existsSync(join(ROOT, "hooks", "askboard-mod.js"))) {
    return "hooks/askboard-mod.js is missing: run bun run build:mod first";
  }
  if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) {
    return "this is a container, where AskBoard shows no board (AD-18): run the suite on the host";
  }
  return undefined;
};

const runConfiguration = async (
  configuration: Configuration,
  runtime: string,
): Promise<{ code: number; seconds: number }> => {
  const started = performance.now();
  const files = FILES[configuration].map((file) => `${SUITE}/${file}`);
  const suite = Bun.spawn([process.execPath, "test", ...files, "--timeout", "60000"], {
    cwd: ROOT,
    stdio: ["inherit", "inherit", "inherit"],
    env: {
      ...process.env,
      ASKBOARD_CONFORMANCE_RUNTIME: runtime,
      ASKBOARD_CONFORMANCE_CONFIGURATION: configuration,
    },
  });
  const code = await suite.exited;
  return { code, seconds: (performance.now() - started) / 1000 };
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
  const outcomes: string[] = [];
  let failed = 0;
  for (const configuration of options.configurations) {
    log(
      `conformance: ${configuration}, the session process on ${options.runtime} (${runtime.path})`,
    );
    const { code, seconds } = await runConfiguration(configuration, runtime.path);
    if (code !== 0) failed += 1;
    outcomes.push(
      `${configuration} ${code === 0 ? "passed" : "failed"} in ${seconds.toFixed(1)} s`,
    );
  }
  log(`conformance on ${options.runtime}: ${outcomes.join("; ")}`);
  return failed === 0 ? 0 : 1;
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}
