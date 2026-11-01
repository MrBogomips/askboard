// The session process as the mod's tests see it: a session file in the fake file system, and a
// local API that answers the fake `$.http.fetch` over the session's socket, or the process client
// the fake `$.process.run` stands for. Every request is recorded; the polls answer what the test
// queues; any route can be refused with a status or made unreachable.

import {
  type AnswerEvent,
  LOCAL_API_HOST,
  LOCAL_API_VERSION,
  type PendingAsk,
  type PolledAsk,
  type PollResponse,
  SESSION_FILE_FORMAT,
  SESSION_TOKEN_HEADER,
  type SessionFile,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
} from "@askboard/contract";
import type { HttpInit, HttpResponse, ProcessRunResult } from "../src/mod-api.ts";
import type { Fake } from "./fake-mod-api.ts";

export const EPOCH = "k3x9";
export const MAIN_ASK = "order-db-choice-x7k2";
export const SUB_ASK = "retry-policy-q3m8";
export const SUB_AGENT = "a3f9c1d27b8e4f60";

/** The session folder the fake's environment and uid give. */
export const folderOf = (fake: Fake): string =>
  sessionFolder({ env: { XDG_RUNTIME_DIR: "/run/user/501" }, uid: fake.uid });

/** A valid session file of `fake`'s Claude Code process, with `changes` over it. */
export const sessionOf = (fake: Fake, changes: Partial<SessionFile> = {}): SessionFile => ({
  format: SESSION_FILE_FORMAT,
  key: fake.pid,
  pid: 48250,
  epoch: EPOCH,
  apiAddress: socketPathFor(folderOf(fake), fake.pid),
  sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A",
  projectDir: "/project",
  startedAt: "2026-10-31T09:40:02.117Z",
  ...changes,
});

/** Writes a session file (or any value) where the mod looks for it, in a private folder. */
export const writeSessionFile = (fake: Fake, value: unknown): string => {
  const folder = folderOf(fake);
  const path = sessionFilePath(folder, fake.pid);
  fake.dirs.add(folder);
  fake.files.set(path, typeof value === "string" ? value : JSON.stringify(value));
  return path;
};

/** The answer to the first question of an ask, logged with `seq`. */
export const answerAt = (seq: number, choice = "PostgreSQL", epoch = EPOCH): AnswerEvent => ({
  cursor: `${epoch}.${seq}`,
  type: "answer",
  itemId: "database",
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-31T09:41:27Z",
  choice: [choice],
});

/** A poll's entry for `askId` with these events, its cursor the last one's. */
export const entryOf = (
  askId: string,
  events: readonly AnswerEvent[],
  agentId?: string,
): PolledAsk => ({
  askId,
  ...(agentId === undefined ? {} : { agent_id: agentId }),
  state: "answered",
  cursor: events.at(-1)?.cursor ?? `${EPOCH}.0`,
  events,
});

export const pendingOf = (askId: string, changes: Partial<PendingAsk> = {}): PendingAsk => ({
  askId,
  title: "Which database should the orders service use?",
  label: "Main agent",
  openQuestions: 1,
  link: `http://127.0.0.1:47213/b/${askId}?t=pV3xK9qLmT2wR7nB4cYh8A`,
  ...changes,
});

export const pollOf = (
  asks: readonly PolledAsk[],
  pending: readonly PendingAsk[] = [],
  changes: Partial<PollResponse> = {},
): PollResponse => ({ version: LOCAL_API_VERSION, epoch: EPOCH, asks, pending, ...changes });

export type Received = {
  readonly via: "fetch" | "client";
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
};

const ACK = JSON.stringify({ version: LOCAL_API_VERSION });

/** A local API answering for `session` through the fake's fetch and process client. */
export const fakeLocalApi = (fake: Fake, session: SessionFile) => {
  const requests: Received[] = [];
  /** The answers to the next polls; the last one repeats. */
  let polls: unknown[] = [pollOf([])];
  /** Routes refused with a status, by path. */
  const refuse = new Map<string, number>();
  /** Routes that cannot be reached: the fetch rejects, the client exits 1. */
  const unreachable = new Set<string>();

  const answer = (
    via: Received["via"],
    method: string,
    target: string,
    body: string | undefined,
  ): { readonly status: number; readonly text: string } | undefined => {
    const path = target.split("?")[0] ?? target;
    requests.push({
      via,
      method,
      path: target,
      ...(body === undefined ? {} : { body: JSON.parse(body) }),
    });
    if (unreachable.has(path)) return undefined;
    const refused = refuse.get(path);
    if (refused !== undefined) return { status: refused, text: "refused\n" };
    if (method === "GET" && path === "/v1/mod/poll") {
      const next = polls.length > 1 ? polls.shift() : polls[0];
      return { status: 200, text: typeof next === "string" ? next : JSON.stringify(next) };
    }
    if (method === "POST") return { status: 200, text: ACK };
    return { status: 404, text: "no route\n" };
  };

  const fetch = async (url: string, init?: HttpInit): Promise<HttpResponse> => {
    const parsed = new URL(url);
    if (parsed.host !== LOCAL_API_HOST || init?.socketPath !== session.apiAddress) {
      throw new Error(`connect ENOENT ${init?.socketPath ?? url}`);
    }
    const token = init?.headers?.[SESSION_TOKEN_HEADER];
    const target = `${parsed.pathname}${parsed.search}`;
    if (token !== session.sessionToken) {
      requests.push({ via: "fetch", method: init?.method ?? "GET", path: target });
      return { status: 403, ok: false, headers: {}, text: "token\n" };
    }
    const given = answer("fetch", init?.method ?? "GET", target, init?.body);
    if (given === undefined) throw new Error(`connect ECONNREFUSED ${session.apiAddress}`);
    return {
      status: given.status,
      ok: given.status >= 200 && given.status < 300,
      headers: { "content-type": "application/json" },
      text: given.text,
    };
  };

  /** The client mode's outcome for `client <path> [<body>]`, by its exit codes. */
  const client = async (args: readonly string[]): Promise<ProcessRunResult> => {
    const [target = "", body] = args;
    const method = body === undefined ? "GET" : "POST";
    const given = answer("client", method, target, body);
    if (given === undefined) {
      return { exitCode: 1, stdout: "", stderr: "askboard client: unreachable\n" };
    }
    if (given.status === 200) return { exitCode: 0, stdout: given.text, stderr: "" };
    return {
      exitCode: 3,
      stdout: `${JSON.stringify({ status: given.status })}\n`,
      stderr: `askboard client: the local API answered ${given.status}\n`,
    };
  };

  fake.handlers.fetch = fetch;

  return {
    session,
    requests,
    refuse,
    unreachable,
    client,
    /** Queues the answers to the next polls; the last one repeats. */
    answerPolls: (...answers: readonly unknown[]) => {
      polls = [...answers];
    },
    paths: () => requests.map((request) => `${request.method} ${request.path}`),
    bodiesTo: (path: string) =>
      requests.filter((request) => request.path === path).map((request) => request.body),
  };
};

/** A session file in place and a local API answering for it. */
export const runningSession = (fake: Fake, changes: Partial<SessionFile> = {}) => {
  const session = sessionOf(fake, changes);
  writeSessionFile(fake, session);
  return fakeLocalApi(fake, session);
};
