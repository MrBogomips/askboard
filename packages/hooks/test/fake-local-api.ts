// A fake local API for the hooks' tests (design decision 11): `node:http` on a real Unix socket in
// a session folder under a short temporary folder, with the session file the session process would
// write beside it. It records every request and answers each with what the test says, or never.

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingHttpHeaders } from "node:http";
import {
  SESSION_FILE_FORMAT,
  type SessionFile,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
} from "@askboard/contract";
import { fixtureSessionFile } from "@askboard/contract/fixtures";

export const UID = process.getuid?.() ?? 0;

/** A request as the fake local API received it. */
export type FakeRequest = {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
};

/** What the fake answers: a status with a JSON or text body, or nothing ever. */
export type FakeReply =
  | { readonly status?: number; readonly json: unknown }
  | { readonly status: number; readonly text: string }
  | "hang";

export type FakeApi = {
  /** `XDG_RUNTIME_DIR` set to the temporary folder: the session folder is `<it>/askboard`. */
  readonly env: Readonly<Record<string, string>>;
  readonly folder: string;
  readonly key: number;
  readonly file: string;
  readonly socket: string;
  readonly session: SessionFile;
  readonly requests: FakeRequest[];
  /** Sets what the fake answers from now on. */
  reply(answer: (request: FakeRequest) => FakeReply): void;
  close(): Promise<void>;
};

const roots: string[] = [];

/** A temporary runtime folder under `/tmp`, short enough for any socket path. */
export const runtimeFolder = (): { root: string; env: Record<string, string>; folder: string } => {
  const root = mkdtempSync("/tmp/abh-");
  roots.push(root);
  const env = { XDG_RUNTIME_DIR: root };
  return { root, env, folder: sessionFolder({ env, uid: UID }) };
};

/** Removes every folder `runtimeFolder` made. */
export const removeRuntimeFolders = (): void => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
};

/** Writes a session file as the session process does: 0600, in the 0700 session folder. */
export const writeSession = (folder: string, key: number, session: unknown): string => {
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  chmodSync(folder, 0o700);
  const file = sessionFilePath(folder, key);
  writeFileSync(file, `${JSON.stringify(session)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
};

export type FakeApiOptions = {
  /** The Claude Code PID that names the session file. */
  readonly key?: number;
  /** Another fake's environment, to share its session folder. */
  readonly env?: Readonly<Record<string, string>>;
  readonly token?: string;
};

/** Starts a fake local API answering 200 with an acknowledgement until told otherwise. */
export const fakeLocalApi = async (options: FakeApiOptions = {}): Promise<FakeApi> => {
  const env = options.env ?? runtimeFolder().env;
  const folder = sessionFolder({ env, uid: UID });
  const key = options.key ?? 48_213;
  const socket = socketPathFor(folder, key);
  const session: SessionFile = {
    ...fixtureSessionFile,
    format: SESSION_FILE_FORMAT,
    key,
    pid: process.pid,
    apiAddress: socket,
    sessionToken: options.token ?? fixtureSessionFile.sessionToken,
  };
  const file = writeSession(folder, key, session);
  const requests: FakeRequest[] = [];
  let answer: (request: FakeRequest) => FakeReply = () => ({ json: { version: "1.0" } });
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const received: FakeRequest = {
        method: request.method ?? "",
        url: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      };
      requests.push(received);
      const reply = answer(received);
      if (reply === "hang") return;
      const json = "json" in reply;
      const body = json ? JSON.stringify(reply.json) : reply.text;
      response.writeHead(reply.status ?? 200, {
        "Content-Type": json ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
      });
      response.end(body);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socket, () => resolve());
  });
  return {
    env,
    folder,
    key,
    file,
    socket,
    session,
    requests,
    reply: (next) => {
      answer = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
};

/** Stdin as the runner reads it: the chunks given, in order. */
export async function* chunks(...parts: (string | Uint8Array)[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) yield typeof part === "string" ? new TextEncoder().encode(part) : part;
}
