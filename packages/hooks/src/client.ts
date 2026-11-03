// The client mode (design decision 7; AD-5): `askboard client <path> [<JSON body>]` sends one local
// API request to the session process of its parent Claude Code process, found through the session
// file, so the token never appears on a command line, and prints the answer. The mod runs it once
// per request when `$.http.fetch` is refused (its fallback).
//
// Output, by exit code:
// - 0: the local API answered 200; stdout holds its JSON body exactly as the socket gave it.
// - 1: the session process could not be reached; one stderr line, nothing on stdout.
// - 2: the command line names no route or a body that does not fit it; one stderr line.
// - 3: the local API refused the request; stdout holds `{"status":<code>}`, one stderr line.

import { HOOK_REQUEST_TIMEOUT_MS, LOCAL_API_HOST, LOCAL_API_ROUTES } from "@askboard/contract";
import { describeFailure } from "./failure.ts";
import { sendRequest } from "./local-api.ts";
import { flushed, type ModeProcess, uidOf } from "./process.ts";
import { findSession, type SessionLookup } from "./session.ts";

/** The client's exit codes. */
export const CLIENT_EXIT = { answered: 0, unreachable: 1, usage: 2, refused: 3 } as const;

export type ClientOutcome = {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type ClientOptions = SessionLookup & {
  /** The request's timeout; `HOOK_REQUEST_TIMEOUT_MS` by default. */
  readonly timeoutMs?: number;
};

const USAGE = "usage: askboard client <path> [<JSON body>]";

type Route = { readonly method: "GET" | "POST"; readonly path: string };

const ROUTES: ReadonlyMap<string, Route> = new Map(
  Object.values(LOCAL_API_ROUTES).map((route) => [route.path, route]),
);

// A request target: printable ASCII with no space, so nothing can split the request line.
const TARGET = /^\/[\x21-\x7e]*$/;

const line = (text: string) => `askboard client: ${text}\n`;

const usage = (why: string): ClientOutcome => ({
  code: CLIENT_EXIT.usage,
  stdout: "",
  stderr: line(`${why}; ${USAGE}`),
});

// The route a target names, or why the command line cannot be sent.
const requestOf = (
  args: readonly string[],
): { readonly route: Route; readonly body?: string } | { readonly problem: string } => {
  const [target, body, ...rest] = args;
  if (target === undefined || !TARGET.test(target)) return { problem: "no local API path given" };
  const route = ROUTES.get(new URL(target, `http://${LOCAL_API_HOST}`).pathname);
  if (route === undefined) return { problem: "the local API has no such route" };
  if (rest.length > 0) return { problem: "one argument too many" };
  if (route.method === "GET") {
    return body === undefined ? { route } : { problem: `GET ${route.path} takes no body` };
  }
  if (body === undefined) return { problem: `POST ${route.path} takes a JSON body` };
  try {
    JSON.parse(body);
  } catch {
    return { problem: `the body for POST ${route.path} is not JSON` };
  }
  return { route, body };
};

/** Sends the request a command line names and gives what to print; never throws. */
export const runClient = async (
  args: readonly string[],
  options: ClientOptions,
): Promise<ClientOutcome> => {
  const request = requestOf(args);
  if ("problem" in request) return usage(request.problem);
  const { route, body } = request;
  const target = args[0] as string;
  try {
    const answer = await sendRequest(
      findSession(options),
      { method: route.method, path: target, ...(body === undefined ? {} : { body }) },
      options.timeoutMs ?? HOOK_REQUEST_TIMEOUT_MS,
    );
    if (answer.status === 200) {
      return { code: CLIENT_EXIT.answered, stdout: answer.body, stderr: "" };
    }
    return {
      code: CLIENT_EXIT.refused,
      stdout: `${JSON.stringify({ status: answer.status })}\n`,
      stderr: line(`the local API answered ${answer.status} to ${route.method} ${route.path}`),
    };
  } catch (error) {
    return { code: CLIENT_EXIT.unreachable, stdout: "", stderr: line(describeFailure(error)) };
  }
};

/** Runs the client for this process and exits with its code. */
export const clientProcess = async (args: readonly string[], io: ModeProcess): Promise<void> => {
  const outcome = await runClient(args, { env: io.env, uid: uidOf(io), ppid: io.ppid });
  await flushed(io.stdout, outcome.stdout);
  await flushed(io.stderr, outcome.stderr);
  io.exit(outcome.code);
};
