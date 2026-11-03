// The local API client (design decision 2; AD-5, AD-11): one HTTP request over the session
// process's Unix socket, with the fixed host, the session token header and no `Origin`, bounded in
// time and in the size of its answer. The hooks check each answer against the contract; the client
// mode passes it on as it came.

import { request as httpRequest } from "node:http";
import {
  HOOK_REQUEST_TIMEOUT_MS,
  LOCAL_API_HOST,
  LOCAL_API_MAX_BYTES,
  type LocalApiMessageName,
  type LocalApiMessages,
  SESSION_TOKEN_HEADER,
  type SessionFile,
} from "@askboard/contract";
import { validateLocalApi } from "@askboard/contract/validate";
import { HookFailure } from "./failure.ts";

export type LocalApiRequest = {
  readonly method: "GET" | "POST";
  /** The route's path, with its query when it has one. */
  readonly path: string;
  /** A POST body, sent as JSON; a string is sent as it is. */
  readonly body?: unknown;
};

/** What the local API answered: its status and its body as text. */
export type LocalApiAnswer = { readonly status: number; readonly body: string };

const seconds = (ms: number): string => `${ms / 1000} s`;

/** Sends one request to the session process and reads its answer; throws when it cannot. */
export const sendRequest = (
  session: Pick<SessionFile, "apiAddress" | "sessionToken">,
  { method, path, body }: LocalApiRequest,
  timeoutMs: number = HOOK_REQUEST_TIMEOUT_MS,
): Promise<LocalApiAnswer> =>
  new Promise((resolve, reject) => {
    const payload =
      body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    const headers: Record<string, string | number> = {
      Host: LOCAL_API_HOST,
      [SESSION_TOKEN_HEADER]: session.sessionToken,
      Connection: "close",
    };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
    };
    const fail = (message: string, status?: number) => {
      settle(() => reject(new HookFailure(message, status)));
      sent.destroy();
    };
    const sent = httpRequest(
      { socketPath: session.apiAddress, method, path, headers, agent: false },
      (response) => {
        const parts: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > LOCAL_API_MAX_BYTES) {
            fail(`the session process answered with over ${LOCAL_API_MAX_BYTES / 1024 / 1024} MiB`);
          } else parts.push(chunk);
        });
        response.on("end", () =>
          settle(() =>
            resolve({
              status: response.statusCode ?? 0,
              body: Buffer.concat(parts).toString("utf8"),
            }),
          ),
        );
        response.on("error", () => fail("the session process's answer could not be read"));
      },
    );
    timer = setTimeout(
      () => fail(`the session process did not answer within ${seconds(timeoutMs)}`),
      timeoutMs,
    );
    sent.on("error", (error: NodeJS.ErrnoException) =>
      fail(`could not reach the session process (${error.code ?? error.name})`),
    );
    sent.end(payload);
  });

/** Sends one request and checks a 200 answer against the contract's message `response`. */
export const exchange = async <N extends LocalApiMessageName>(
  session: Pick<SessionFile, "apiAddress" | "sessionToken">,
  request: LocalApiRequest,
  response: N,
  timeoutMs?: number,
): Promise<LocalApiMessages[N]> => {
  const answer = await sendRequest(session, request, timeoutMs);
  const route = `${request.method} ${request.path.split("?")[0]}`;
  if (answer.status !== 200) {
    throw new HookFailure(`the local API answered ${answer.status} to ${route}`, answer.status);
  }
  const notTheContracts = `the local API gave ${route} an answer that is not the contract's`;
  let value: unknown;
  try {
    value = JSON.parse(answer.body);
  } catch {
    throw new HookFailure(notTheContracts);
  }
  const checked = validateLocalApi(response, value);
  if (checked.ok) return checked.value;
  if (checked.reason === "version") {
    throw new HookFailure(
      `the local API's answer to ${route}: ${checked.problems[0]?.message ?? "another version"}`,
    );
  }
  throw new HookFailure(notTheContracts);
};
