// Test helpers for the local API: a session folder under a short temporary folder, the local API
// around the real ask-core with fake ports and the real record table, and raw requests over its
// Unix socket that set any header.

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { join } from "node:path";
import {
  LOCAL_API_HOST,
  SESSION_TOKEN_HEADER,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
} from "@askboard/contract";
import { AskCore, type Origin } from "@askboard/core";
import {
  createLocalApi,
  type LocalApi,
  type LocalApiOptions,
  RecordTable,
} from "../../../src/board-host/index.ts";
import { runtimeClock } from "../helpers.ts";

const roots: string[] = [];

/**
 * A runtime folder under `/tmp`, short enough for any socket path, as `XDG_RUNTIME_DIR`: the
 * session folder is `<it>/askboard`.
 */
export const runtimeFolder = () => {
  const root = mkdtempSync("/tmp/abt-");
  roots.push(root);
  const env = { XDG_RUNTIME_DIR: root };
  const folder = sessionFolder({ env, uid: process.getuid?.() ?? 0 });
  return { root, env, folder };
};

/** Removes the folders `runtimeFolder` made. */
export const removeRuntimeFolders = (): void => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
};

/** The PID of a process that has exited: no process holds it, barring reuse. */
export const deadPid = (): number => {
  const child = Bun.spawnSync(["true"]);
  return child.pid;
};

export const TOKEN = "Hc4nQ8vLw2Zr7TxB5mKp9A";
export const KEY = 48_213;
export const PID = 48_250;
export const PROJECT = "/Users/paola/src/order-service";
export const LINK = (askId: string) => `http://127.0.0.1:47213/b/${askId}?t=pV3xK9qLmT2wR7nB4cYh8A`;

/** The origin every `ask` binding gets: no git run in these tests. */
export const originFor = (agentId?: string, agentType?: string): Origin => ({
  label: agentId === undefined ? "Main agent" : `Subagent ${agentType ?? ""}`.trim(),
  cwd: PROJECT,
  root: PROJECT,
  branch: "main",
  worktree: "order-service",
});

export type TestApi = {
  readonly api: LocalApi;
  readonly core: AskCore;
  readonly records: RecordTable;
  readonly env: Readonly<Record<string, string>>;
  readonly folder: string;
  readonly file: string;
  readonly socket: string;
  readonly diagnosed: string[];
  readonly reported: unknown[];
  readonly opened: string[];
  /** Advances the record table's clock. */
  advance(ms: number): void;
};

export type TestApiOptions = Partial<
  Pick<LocalApiOptions, "key" | "pid" | "platform" | "alive" | "showable" | "rule">
> & {
  /** The session project root; `PROJECT` unless given, none when null. */
  readonly projectRoot?: string | null;
  readonly env?: Readonly<Record<string, string>>;
  /** The session token; `TOKEN` unless given. */
  readonly token?: string;
};

/** The local API of a session whose ask-core has fake ports, not started. */
export const testApi = (options: TestApiOptions = {}): TestApi => {
  const runtime = options.env === undefined ? runtimeFolder() : undefined;
  const env = options.env ?? runtime?.env ?? {};
  const uid = process.getuid?.() ?? 0;
  const key = options.key ?? KEY;
  let now = 0;
  const records = new RecordTable({
    now: () => now,
    originOf: async (record) => originFor(record.agent_id, record.agent_type),
  });
  const opened: string[] = [];
  const reported: unknown[] = [];
  const diagnosed: string[] = [];
  const core = new AskCore({
    randomness: { bytes: (count) => new Uint8Array(count).fill(7) },
    showing: { check: async () => ({ showable: true }), open: (link) => opened.push(link) },
    address: { link: async (askId) => LINK(askId) },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    report: (error) => reported.push(error),
    records,
    clock: runtimeClock,
  });
  const api = createLocalApi({
    core: () => core,
    records,
    env,
    uid,
    key,
    pid: options.pid ?? PID,
    platform: options.platform ?? process.platform,
    ...(options.projectRoot === null ? {} : { projectRoot: options.projectRoot ?? PROJECT }),
    showable: options.showable ?? (async () => true),
    report: (error) => reported.push(error),
    diagnose: (text) => diagnosed.push(text),
    token: () => options.token ?? TOKEN,
    alive: options.alive ?? ((pid) => pid === (options.pid ?? PID)),
    ...(options.rule === undefined ? {} : { rule: options.rule }),
  });
  const folder = sessionFolder({ env, uid });
  return {
    api,
    core,
    records,
    env,
    folder,
    file: sessionFilePath(folder, key),
    socket: socketPathFor(folder, key),
    diagnosed,
    reported,
    opened,
    advance: (ms) => {
      now += ms;
    },
  };
};

export type Answer = {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly text: string;
  json(): unknown;
};

export type RequestOptions = {
  readonly method?: string;
  /** The session token; `null` sends no token header. */
  readonly token?: string | null;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /** A body sent as is, in place of `body`'s JSON. */
  readonly raw?: string | Buffer;
};

/** One request over the socket, answered or failed. */
export const localRequest = (
  socket: string,
  path: string,
  options: RequestOptions = {},
): Promise<Answer> =>
  new Promise((resolve, reject) => {
    const raw =
      options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    const headers: Record<string, string> = { Host: LOCAL_API_HOST, ...options.headers };
    const token = options.token === undefined ? TOKEN : options.token;
    if (token !== null) headers[SESSION_TOKEN_HEADER] = token;
    if (raw !== undefined) headers["Content-Length"] = String(Buffer.byteLength(raw));
    const sent = httpRequest(
      { socketPath: socket, path, method: options.method ?? "GET", headers },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            text,
            json: () => JSON.parse(text),
          });
        });
        response.on("error", reject);
      },
    );
    sent.on("error", reject);
    sent.end(raw);
  });

/** A POST of a JSON body. */
export const post = (socket: string, path: string, body: unknown, options: RequestOptions = {}) =>
  localRequest(socket, path, { ...options, method: "POST", body });

/** The session folder's entries, sorted; none when it does not exist. */
export const entriesOf = (folder: string): string[] => {
  try {
    return readdirSync(folder).sort();
  } catch {
    return [];
  }
};

export const fileIn = (folder: string, name: string) => join(folder, name);
