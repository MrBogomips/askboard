// The editor launch (excerpts, design decision 5, Editor launch; proposal A4 and B17): "Open in
// editor" starts the configured command as an argument vector, never through a shell (AD-8), with
// `{file}` and `{line}` replaced, the file being ask-core's confined real path resolved again at
// the click and the line an integer; at most once per ask per second. Diagnostics name the
// outcome, never the vector.

import { spawn as spawnProcess } from "node:child_process";
import type { EditorOutcome } from "@askboard/contract";
import type { EditorLaunchTarget } from "@askboard/core";

/** The editor command, an argument vector whose first element is the program (excerpts, A4). */
export type EditorCommand = readonly [string, ...string[]];

/** A second launch for one ask within this many milliseconds is `busy` (proposal B17). */
export const EDITOR_LAUNCH_INTERVAL_MS = 1_000;

/** The part of a started editor the launch uses. */
export type StartedEditor = {
  once(event: "spawn", listener: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  unref(): unknown;
};

/** `child_process.spawn`, narrowed to what the launch passes. */
export type EditorSpawn = (
  program: string,
  args: readonly string[],
  options: { shell: false; detached: true; stdio: "ignore" },
) => StartedEditor;

export type EditorLaunchDeps = {
  /** The command, read at each launch; none means `no-editor`. */
  readonly command: () => EditorCommand | undefined;
  /** Where a failed start goes, as its outcome and error code only. */
  readonly report: (error: unknown) => void;
  /** Node's `spawn` unless given. */
  readonly spawn?: EditorSpawn;
  /** A monotonic clock in milliseconds; `performance.now` unless given. */
  readonly now?: () => number;
};

/** The editor did not start: the message names the outcome and the error code, never the vector. */
export class EditorLaunchError extends Error {
  override readonly name = "EditorLaunchError";
  readonly code = "EDITOR_LAUNCH_FAILED";
}

const PLACEHOLDER = /\{(file|line)\}/g;

/**
 * The argument vector for `file` at `line`: `{file}` and `{line}` replaced wherever they occur in
 * an argument, and nothing else; with no `{file}` in the command, the file is appended.
 */
export const editorArguments = (
  command: EditorCommand,
  file: string,
  line: number,
): EditorCommand => {
  const expand = (arg: string): string =>
    arg.replace(PLACEHOLDER, (_, name: string) => (name === "file" ? file : String(line)));
  const [program, ...args] = command;
  const expanded = args.map(expand);
  if (!command.some((arg) => arg.includes("{file}"))) expanded.push(file);
  return [expand(program), ...expanded];
};

// What board-host starts an editor on: an absolute path and a line from 1, whatever gave them.
const launchable = ({ file, line }: EditorLaunchTarget): boolean =>
  file.startsWith("/") && Number.isSafeInteger(line) && line >= 1;

// A start error's code, such as ENOENT, when it has one: its message and fields name the vector.
const codeOf = (error: unknown): string => {
  const code = (error as { readonly code?: unknown } | undefined)?.code;
  return typeof code === "string" && /^E[A-Z0-9_]+$/.test(code) ? ` (${code})` : "";
};

// Node's `spawn`, narrowed to the launch's use, as the notifier's opener narrows it.
const systemSpawn = spawnProcess as unknown as EditorSpawn;

/** "Open in editor" for every board of the session process. */
export class EditorLaunch {
  readonly #command: () => EditorCommand | undefined;
  readonly #report: (error: unknown) => void;
  readonly #spawn: EditorSpawn;
  readonly #now: () => number;
  // When each ask last passed the busy check; entries older than the interval are dropped.
  readonly #last = new Map<string, number>();

  constructor(deps: EditorLaunchDeps) {
    this.#command = deps.command;
    this.#report = deps.report;
    this.#spawn = deps.spawn ?? systemSpawn;
    this.#now = deps.now ?? (() => performance.now());
  }

  /**
   * Opens the editor on the item `target` gives, in the order of design decision 5: no command is
   * `no-editor`; a launch for the ask within a second is `busy`; no target is `unavailable`; then
   * the start, `opened` or `failed`.
   */
  async open(
    askId: string,
    target: () => Promise<EditorLaunchTarget | undefined>,
  ): Promise<EditorOutcome> {
    const command = this.#command();
    if (command === undefined) return "no-editor";
    if (this.#busy(askId)) return "busy";
    const found = await target();
    if (found === undefined || !launchable(found)) return "unavailable";
    return this.#start(editorArguments(command, found.file, found.line));
  }

  // Whether the ask passed this check within the interval; if not, it counts from now, so a click
  // while the first launch reads its target is busy too.
  #busy(askId: string): boolean {
    const now = this.#now();
    for (const [id, at] of this.#last) {
      if (now - at >= EDITOR_LAUNCH_INTERVAL_MS) this.#last.delete(id);
    }
    if (this.#last.has(askId)) return true;
    this.#last.set(askId, now);
    return false;
  }

  // Starts the editor detached and unreferenced, so it outlives the session process: `opened` once
  // the system started it, `failed` when it could not or `spawn` refused the vector.
  #start([program, ...args]: EditorCommand): Promise<EditorOutcome> {
    return new Promise((settle) => {
      const failed = (error: unknown): void => {
        this.#report(new EditorLaunchError(`The editor could not start${codeOf(error)}`));
        settle("failed");
      };
      try {
        const started = this.#spawn(program, args, {
          shell: false,
          detached: true,
          stdio: "ignore",
        });
        started.once("spawn", () => settle("opened"));
        started.on("error", failed);
        started.unref();
      } catch (error) {
        failed(error);
      }
    });
  }
}
