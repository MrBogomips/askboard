// The `Notices` port: a new ask's system notification (design decision 9; FR-23, AD-8). The notifier
// starts with an argument vector, never through a shell, and any script it runs is AskBoard's
// constant text; agent text reaches it only as plain arguments, after one that is not an option.
//
// - macOS: `osascript` with the script below, then `AskBoard`, the title and the body. Clicking the
//   notification opens no board (FR-23): the terminal link does.
// - Linux, with `notify-send` on `PATH`: its help is read once; when it lists `--action`, the
//   notification offers the default action and waits, and a `default` line on its stdout opens the
//   board with E1's opener.
// - WSL, and any other platform: no notification yet.
//
// A missing notifier writes one diagnostic, and one that fails is reported once, after which the
// session shows no more notifications; either way the ask is unaffected. The notifier's children
// still running are killed at exit.

import { spawn as spawnProcess } from "node:child_process";
import type { Notice, Notices } from "@askboard/core";
import { type Environment, isWsl } from "./detect.ts";
import { type NoticeText, noticeText } from "./notice-text.ts";
import { onPathOf } from "./on-path.ts";

/** The AppleScript `osascript` runs, one `-e` each: it reads the title and body from `argv`. */
export const OSASCRIPT_SCRIPT = [
  "on run argv",
  "display notification (item 3 of argv) with title (item 2 of argv)",
  "end run",
] as const;

/** How long `notify-send --help` may take before it counts as listing no `--action`. */
export const NOTIFY_SEND_HELP_TIMEOUT_MS = 2_000;

const APP_NAME = "AskBoard";
const DEFAULT_ACTION = "default";
const NOTIFY_SEND = "notify-send";
const MISSING_NOTIFY_SEND = "no system notification: notify-send is not on PATH";

/** One started notifier process, as the notices use it. */
export type NoticeProcess = {
  /** Each line of its stdout, when it is piped. */
  onLine(listener: (line: string) => void): void;
  /** It could not start, or failed. */
  onError(listener: (error: Error) => void): void;
  /** It exited, with its code, or null when a signal ended it. */
  onExit(listener: (code: number | null) => void): void;
  /** It exited and its output has ended: every line has been given. */
  onClose(listener: () => void): void;
  kill(): void;
};

/** Starts a command with an argument vector, never through a shell. */
export type NoticeSpawn = (
  command: string,
  args: readonly string[],
  options: { readonly env: Environment; readonly stdout: "pipe" | "ignore" },
) => NoticeProcess;

export type NoticesOptions = {
  /** `process.platform`. */
  readonly platform: string;
  /** The session process's environment: `PATH` and WSL's variables. */
  readonly env: Environment;
  /** The session project root's folder name, which each notification names. */
  readonly project: string;
  /** E1's opener: the notification's default action opens the board with it. */
  readonly open: (link: string) => void;
  /** A notifier that could not start, or failed. */
  readonly report: (error: unknown) => void;
  /** AskBoard's own fixed text, such as a missing notifier. */
  readonly diagnose: (text: string) => void;
  readonly onPath?: (command: string) => boolean;
  readonly spawn?: NoticeSpawn;
  /** `NOTIFY_SEND_HELP_TIMEOUT_MS` unless given. */
  readonly helpTimeoutMs?: number;
};

/** The `Notices` port, with what ends it at exit. */
export type SystemNotices = Notices & {
  /** Kills the notifier's children still running; no notification starts afterwards. */
  close(): void;
};

/** A notifier exited with a code other than 0. */
export class NotifierExitError extends Error {
  override readonly name = "NotifierExitError";
  readonly code: string;

  constructor(command: string, code: number) {
    super(`${command} exited with code ${code}`);
    this.code = `EXIT_${code}`;
  }
}

type Plan =
  | { readonly kind: "osascript" }
  | { readonly kind: "notify-send"; readonly actions: boolean }
  | { readonly kind: "none" };

/** `osascript`'s arguments: the constant script, then `AskBoard`, so no later one is an option. */
export const osascriptArgs = ({ title, body }: NoticeText): string[] => [
  ...OSASCRIPT_SCRIPT.flatMap((line) => ["-e", line]),
  APP_NAME,
  title,
  body,
];

// The body may hold markup where the notification server supports it: agent text shows as text.
const markupEscaped = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** `notify-send`'s arguments, with the default action and the wait where it supports them. */
export const notifySendArgs = ({ title, body }: NoticeText, actions: boolean): string[] => [
  `--app-name=${APP_NAME}`,
  ...(actions ? [`--action=${DEFAULT_ACTION}=Open`, "--wait"] : []),
  "--",
  title,
  markupEscaped(body),
];

type ChildLike = {
  readonly stdout: {
    setEncoding(encoding: "utf8"): unknown;
    on(event: "data", listener: (chunk: string) => void): unknown;
    on(event: "end", listener: () => void): unknown;
  } | null;
  on(event: "error" | "exit" | "close", listener: (value: unknown) => void): unknown;
  kill(signal: "SIGTERM"): unknown;
};

// Node's `spawn` behind `NoticeSpawn`. The assertion is for the test program, which loads two
// versions of Node's types whose merged `ChildProcess` loses its event methods.
const systemSpawn: NoticeSpawn = (command, args, { env, stdout }) => {
  const child = spawnProcess(command, [...args], {
    shell: false,
    env: env as Record<string, string>,
    stdio: ["ignore", stdout, "ignore"],
  }) as unknown as ChildLike;
  return {
    onLine: (listener) => {
      let rest = "";
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        const lines = `${rest}${chunk}`.split("\n");
        rest = lines.pop() ?? "";
        for (const line of lines) listener(line);
      });
      // A last line with no newline is a line too.
      child.stdout?.on("end", () => {
        if (rest !== "") listener(rest);
        rest = "";
      });
    },
    onError: (listener) => child.on("error", (error) => listener(error as Error)),
    onExit: (listener) => child.on("exit", (code) => listener(code as number | null)),
    // Node's `close` comes once the process has exited and its output streams have ended.
    onClose: (listener) => child.on("close", () => listener()),
    kill: () => child.kill("SIGTERM"),
  };
};

/** The `Notices` port over this machine's notifier. */
export const createNotices = (options: NoticesOptions): SystemNotices => {
  const { platform, env, project, open, report, diagnose } = options;
  const spawn = options.spawn ?? systemSpawn;
  const onPath = options.onPath ?? onPathOf(env);
  const helpTimeoutMs = options.helpTimeoutMs ?? NOTIFY_SEND_HELP_TIMEOUT_MS;
  const children = new Set<NoticeProcess>();
  let closed = false;
  let failed = false;

  // The notifier's first failure is reported, and ends notifications for the session: one that
  // fails once is broken for every ask, and would otherwise report on each.
  const fail = (failure: unknown): void => {
    if (failed || closed) return;
    failed = true;
    report(failure);
  };

  // Starts a notifier and keeps it until it ends; a failure is reported once for the session.
  const start = (
    command: string,
    args: readonly string[],
    stdout: "pipe" | "ignore",
  ): NoticeProcess => {
    const child = spawn(command, args, { env, stdout });
    children.add(child);
    let ended = false;
    const end = (failure?: unknown) => {
      if (ended) return;
      ended = true;
      children.delete(child);
      if (failure !== undefined) fail(failure);
    };
    child.onError((error) => end(error));
    child.onExit((code) =>
      end(code === null || code === 0 ? undefined : new NotifierExitError(command, code)),
    );
    return child;
  };

  // Whether `notify-send --help` lists `--action`, read to the end of its output, which can come
  // after its exit; a help that fails or takes too long does not.
  const helpListsActions = (): Promise<boolean> =>
    new Promise((resolve) => {
      let listed = false;
      const child = spawn(NOTIFY_SEND, ["--help"], { env, stdout: "pipe" });
      children.add(child);
      const done = (actions: boolean) => {
        clearTimeout(timer);
        children.delete(child);
        resolve(actions);
      };
      const timer = setTimeout(() => {
        child.kill();
        done(false);
      }, helpTimeoutMs);
      child.onLine((line) => {
        if (/--action\b/.test(line)) listed = true;
      });
      child.onError(() => done(false));
      child.onClose(() => done(listed));
    });

  const resolvePlan = async (): Promise<Plan> => {
    if (platform === "darwin") return { kind: "osascript" };
    if (platform !== "linux" || isWsl(env)) return { kind: "none" };
    if (!onPath(NOTIFY_SEND)) {
      diagnose(MISSING_NOTIFY_SEND);
      return { kind: "none" };
    }
    return { kind: "notify-send", actions: await helpListsActions() };
  };
  let planned: Promise<Plan> | undefined;

  const show = (plan: Plan, text: NoticeText, link: string): void => {
    if (closed || failed || plan.kind === "none") return;
    if (plan.kind === "osascript") {
      start("osascript", osascriptArgs(text), "ignore");
      return;
    }
    const child = start(
      NOTIFY_SEND,
      notifySendArgs(text, plan.actions),
      plan.actions ? "pipe" : "ignore",
    );
    if (!plan.actions) return;
    let opened = false;
    child.onLine((line) => {
      if (opened || line.trim() !== DEFAULT_ACTION) return;
      opened = true;
      open(link);
    });
  };

  return {
    notify: (notice: Notice) => {
      if (closed || failed) return;
      const text = noticeText(notice, project);
      planned ??= resolvePlan();
      planned.then((plan) => show(plan, text, notice.link)).catch(fail);
    },
    close: () => {
      closed = true;
      for (const child of children) child.kill();
      children.clear();
    },
  };
};
