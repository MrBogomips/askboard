// The session process as the entry point composes it, driven in process over an in-memory
// transport, with a recorder script as BROWSER (task 7.2), for session-process.test.ts and the push
// delivery tests beside it. Each test file makes its own throwaway project; each session gets its
// own session folder under a short runtime folder, and a notifier recorder first on PATH, so that
// an ask shows no real notification and the test reads what would have been shown (task 5.4). A
// test may give ask-core's clock, which runs the grace timer (ask-lifecycle).

import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CLAUDE_CODE_CLIENT_NAME,
  CLAUDE_CODE_MINIMUM,
  sessionFilePath,
  sessionFolder,
} from "@askboard/contract";
import type { Clock } from "@askboard/core";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import type { ExitSignal, SessionProcess } from "../src/mcp-tools/index.ts";
import { startSessionProcess } from "../src/session-process.ts";
import { removeViews, writeView } from "./board-host/helpers.ts";
import { notifierRecorders } from "./notifier-recorders.ts";

/** The Claude Code PID the in-process sessions say they run under: it names their session file. */
export const KEY = 48_213;

export type ClientIdentity = {
  readonly name: string;
  readonly version: string;
  readonly negotiation?: "auto" | "legacy";
};

/** A Claude Code at the minimum version, so no unknown-version diagnostic joins stderr. */
export const CLAUDE_CODE: ClientIdentity = {
  name: CLAUDE_CODE_CLIENT_NAME,
  version: CLAUDE_CODE_MINIMUM,
};

const uid = process.getuid?.() ?? 0;

/** The file's text, once it exists. */
export const waitForFile = async (path: string) => {
  for (let tries = 0; tries < 200 && !existsSync(path); tries += 1) await Bun.sleep(10);
  return readFileSync(path, "utf8");
};

/** A test file's throwaway project, its recorders and its sessions, and their removal. */
export const composedSessions = () => {
  const folder = mkdtempSync(join(tmpdir(), "askboard-session-"));
  const runtimes: string[] = [];
  const project = join(folder, "project");
  Bun.spawnSync(["git", "init", "--quiet", project]);
  Bun.spawnSync(["git", "-C", project, "config", "user.name", "Paola Greco"]);

  /** A script for BROWSER that writes its arguments to `record`. */
  const recorder = (name: string) => {
    const record = join(folder, `${name}.txt`);
    const script = join(folder, `${name}.sh`);
    writeFileSync(
      script,
      `#!/bin/sh\nprintf '%s\\n' "$@" > '${record}.part'\nmv '${record}.part' '${record}'\n`,
    );
    chmodSync(script, 0o755);
    return { script, record };
  };

  /** Starts a composed session process and connects a client to it. */
  const start = async (
    env: Readonly<Record<string, string>>,
    view: string = writeView(),
    client: ClientIdentity = CLAUDE_CODE,
    clock?: Clock,
  ) => {
    const runtime = mkdtempSync("/tmp/abs-");
    runtimes.push(runtime);
    const notifier = notifierRecorders(join(runtime, "notifier"));
    const handlers = new Map<ExitSignal, () => void>();
    const exits: number[] = [];
    const running: SessionProcess = {
      onSignal: (signal, handler) => handlers.set(signal, handler),
      exit: (code) => exits.push(code),
    };
    const stderr: string[] = [];
    const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
    const session = startSessionProcess({
      env: {
        PATH: `${notifier.folder}:${process.env.PATH ?? ""}`,
        CLAUDE_PROJECT_DIR: project,
        XDG_RUNTIME_DIR: runtime,
        ...env,
      },
      platform: process.platform,
      cwd: folder,
      view,
      version: "0.0.0-test",
      process: running,
      pid: process.pid,
      parentPid: KEY,
      uid,
      stderr: (line) => stderr.push(line),
      transport: serverEnd,
      ...(clock ? { clock } : {}),
    });
    const connected = new Client(
      { name: client.name, version: client.version },
      { versionNegotiation: { mode: client.negotiation ?? "legacy" } },
    );
    await connected.connect(clientEnd);
    const callRaw = (name: string, args: Record<string, unknown>, meta?: Record<string, unknown>) =>
      connected.callTool({ name, arguments: args, ...(meta === undefined ? {} : { _meta: meta }) });
    const call = async (
      name: string,
      args: Record<string, unknown>,
      meta?: Record<string, unknown>,
    ) => {
      const result = await callRaw(name, args, meta);
      const [content] = result.content as { text: string }[];
      return JSON.parse(content?.text ?? "{}");
    };
    const sessionFolderOf = sessionFolder({ env: { XDG_RUNTIME_DIR: runtime }, uid });
    return {
      client: connected,
      call,
      callRaw,
      session,
      exits,
      stderr,
      emit: (signal: ExitSignal) => handlers.get(signal)?.(),
      /** Each notification the session showed, through the recorders on PATH. */
      notified: notifier.notified,
      sessionFolder: sessionFolderOf,
      sessionFile: sessionFilePath(sessionFolderOf, KEY),
    };
  };

  /** Removes the project, the recorders, the runtime folders and the view builds. */
  const remove = (): void => {
    rmSync(folder, { recursive: true, force: true });
    for (const runtime of runtimes.splice(0)) rmSync(runtime, { recursive: true, force: true });
    removeViews();
  };

  return { project, recorder, start, remove };
};
