// Notifier recorders for the session processes the tests start (task 5.4): first on PATH, they
// stand in for `osascript` and `notify-send`, so that an ask shows no real notification, and record
// what would have been shown. Shared by the composed sessions and the conformance suite.

import { chmodSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// What `notify-send --help` lists where it supports actions.
const NOTIFY_SEND_HELP = "  -A, --action=[NAME=]Text...       Specifies the actions to display";

/**
 * A folder of notifier recorders, `osascript` and `notify-send`, each writing its name and its
 * arguments to a file of its own; `notify-send --help` lists `--action`.
 */
export const notifierRecorders = (into: string) => {
  mkdirSync(into, { recursive: true });
  for (const command of ["osascript", "notify-send"]) {
    writeFileSync(
      join(into, command),
      [
        "#!/bin/sh",
        `if [ "$1" = "--help" ]; then printf '%s\\n' '${NOTIFY_SEND_HELP}'; exit 0; fi`,
        `printf '%s\\n' '${command}' "$@" > '${into}/notified.'$$.part`,
        `mv '${into}/notified.'$$.part '${into}/notified.'$$.txt`,
        "",
      ].join("\n"),
    );
    chmodSync(join(into, command), 0o755);
  }
  /** Each notification shown: the notifier's name, then its arguments. */
  const notified = (): string[][] =>
    readdirSync(into)
      .filter((name) => name.startsWith("notified.") && name.endsWith(".txt"))
      .map((name) => readFileSync(join(into, name), "utf8").split("\n").slice(0, -1));
  return { folder: into, notified };
};
