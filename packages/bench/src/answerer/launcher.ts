// `browser.sh`, the BROWSER of an AskBoard run: E1's notifier starts BROWSER as one command with the
// link as its only argument (E1 design decision 6), so the script execs the board answerer with the
// case's paths baked in (early-benchmark design decision 5).

import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const BOARD_ANSWERER = fileURLToPath(new URL("./board-main.ts", import.meta.url));

export const quote = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

export type LauncherPaths = { readonly plan: string; readonly records: string };

export const browserScript = (paths: LauncherPaths, runtime: string = process.execPath): string => {
  const command = [runtime, BOARD_ANSWERER, "--plan", paths.plan, "--records", paths.records];
  return [
    "#!/bin/sh",
    "# BROWSER for one benchmark run: the scripted board answerer, once per board.",
    `exec ${command.map(quote).join(" ")} "$1"`,
    "",
  ].join("\n");
};

export const writeBrowserLauncher = (
  dir: string,
  paths: LauncherPaths,
  runtime: string = process.execPath,
): string => {
  const path = join(dir, "browser.sh");
  writeFileSync(path, browserScript(paths, runtime));
  chmodSync(path, 0o755);
  return path;
};
