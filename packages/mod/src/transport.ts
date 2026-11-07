// How the mod reaches the local API (AD-5, AD-11; design decisions 2 and 7; mod spec, "When
// `$.http.fetch` is refused"): HTTP over the session's Unix socket with `$.http.fetch`, the session
// token on every request. A request whose fetch fails goes through the AskBoard bundle run as a local
// API client by `$.process.run` (finding criterion 11). The client finds the session file by its own
// parent's PID, Claude Code's, so the token never appears on its command line.
//
// The mod API gives a refusal no error of its own, so a refusal is told by its effect: a fetch
// rejects while the client, run for the same request, reaches the session process. After three
// requests in a row to one session process (its `pid` and `epoch`) refused so, every request goes
// through the client for the rest of the session (an organization's policy, or a policy mod that
// hooks fetch): polls, delivery reports and the hello. A fetch that succeeds starts the count over,
// and so does a new session process, so one transient socket error, such as a session process
// restarting, never pins the client. While neither reaches the session process, the client is tried
// again at the next poll, never twice in one (review fix, 2026-11-01).

import { LOCAL_API_HOST, SESSION_TOKEN_HEADER, type SessionFile } from "@askboard/contract";
import { debug } from "./diagnostics.ts";
import type { Memory } from "./memory.ts";
import type { HttpResponse, ModApi } from "./mod-api.ts";

/**
 * The start script in client mode, under the plugin root: `client <path> [<JSON body>]` follows. It
 * is the script the server entry and the hooks run (plugin-release, design decision 1), which runs
 * the bundle on Node and refuses an unusable Node with exit 1, which `viaClient` reads as failed.
 * E11 replaces it with the launcher.
 */
export const clientCommand = (pluginRoot: string): readonly string[] => [
  "sh",
  `${pluginRoot}/scripts/askboard`,
  "client",
];

/** The client mode's exit codes (packages/hooks/src/client.ts). */
const CLIENT_EXIT = { answered: 0, refused: 3 } as const;

/** How long one client run may take: a process start and one request of at most 2 s. */
const CLIENT_TIMEOUT_MS = 5_000;

/** How many requests in a row, refused by fetch and answered by the client, pin the client. */
const REFUSALS_TO_PIN = 3;

export type LocalApiRequest = {
  readonly method: "GET" | "POST";
  /** The route's path, with its query. */
  readonly path: string;
  readonly body?: object;
};

/** What became of a request: the 200 answer's JSON, the status of a refusal, or no answer. */
export type Answer =
  | { readonly kind: "answered"; readonly body: unknown }
  | { readonly kind: "refused"; readonly status: number }
  | { readonly kind: "failed" };

const FAILED: Answer = { kind: "failed" };

const parsed = (text: string): Answer => {
  try {
    return { kind: "answered", body: JSON.parse(text) };
  } catch {
    return FAILED;
  }
};

const answerOf = (response: HttpResponse): Answer =>
  response.status === 200 ? parsed(response.text) : { kind: "refused", status: response.status };

const viaFetch = async (
  $: ModApi,
  session: SessionFile,
  { method, path, body }: LocalApiRequest,
): Promise<Answer> => {
  const headers: Record<string, string> = { [SESSION_TOKEN_HEADER]: session.sessionToken };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await $.http.fetch(`http://${LOCAL_API_HOST}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    socketPath: session.apiAddress,
  });
  return answerOf(response);
};

// The refusal the client prints as `{"status":<code>}`.
const refusalOf = (stdout: string): Answer => {
  const answer = parsed(stdout);
  if (answer.kind !== "answered") return FAILED;
  const { status } = (answer.body ?? {}) as { status?: unknown };
  return Number.isInteger(status) ? { kind: "refused", status: status as number } : FAILED;
};

const viaClient = async ($: ModApi, { path, body }: LocalApiRequest): Promise<Answer> => {
  const argv = [
    ...clientCommand($.plugin.root),
    path,
    ...(body === undefined ? [] : [JSON.stringify(body)]),
  ];
  try {
    const ran = await $.process.run(argv, { timeoutMs: CLIENT_TIMEOUT_MS });
    if (ran.exitCode === CLIENT_EXIT.answered) return parsed(ran.stdout);
    if (ran.exitCode === CLIENT_EXIT.refused) return refusalOf(ran.stdout);
    return FAILED;
  } catch {
    return FAILED;
  }
};

// One more request to `session` that fetch failed and the client answered: the third in a row pins
// the client.
const countRefusal = (memory: Memory, $: ModApi, session: SessionFile): void => {
  const known = memory.refusedFetches;
  const same = known?.pid === session.pid && known.epoch === session.epoch;
  const count = same ? known.count + 1 : 1;
  memory.refusedFetches = { pid: session.pid, epoch: session.epoch, count };
  if (count < REFUSALS_TO_PIN) return;
  memory.transport = "client";
  debug($, "$.http.fetch is refused: the local API is reached through the AskBoard client");
};

// A fetch rejected: the client carries the same request. When it reaches the session process, the
// fetch counts as refused; when it fails too, it is not run again before the next poll.
const afterFailedFetch = async (
  memory: Memory,
  $: ModApi,
  session: SessionFile,
  request: LocalApiRequest,
): Promise<Answer> => {
  if (memory.polls < memory.probeAfter) return FAILED;
  const answer = await viaClient($, request);
  if (answer.kind === "failed") {
    memory.probeAfter = memory.polls + 1;
    return FAILED;
  }
  countRefusal(memory, $, session);
  return answer;
};

/** Sends one request to the session process; never throws. */
export const send = async (
  memory: Memory,
  $: ModApi,
  session: SessionFile,
  request: LocalApiRequest,
): Promise<Answer> => {
  if (memory.transport === "client") return viaClient($, request);
  let answer: Answer;
  try {
    answer = await viaFetch($, session, request);
  } catch {
    return afterFailedFetch(memory, $, session, request);
  }
  memory.refusedFetches = undefined;
  return answer;
};

/** Whether a refusal settles a request for good: a 4xx, the local API's answer to that request. */
export const isFinalRefusal = (status: number): boolean => status >= 400 && status < 500;
