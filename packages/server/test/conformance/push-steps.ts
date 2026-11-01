// Steps the configuration suites share (push delivery, tasks 9.2 and 9.3): a session process started
// as Claude Code starts it, its local API up and its session file found; an agent's ask through its
// hooks with the board connected as the board page connects it; the user's answer; the board's
// messages; a push read back as the agent reads it; and the mod's polls counted.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOARD_PROTOCOL_VERSION,
  PUSH_MESSAGE_PREFACE,
  type PushMessage,
  type SessionFile,
  sessionFilePath,
  sessionFolder,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validatePushMessage } from "@askboard/contract/validate";
import { type BoardSocket, linkParts, openBoardSocket } from "./board-page.ts";
import { type Agent, type AgentCall, callAs } from "./hook-runs.ts";
import type { HostRecord, ModHost } from "./mod-host.ts";
import { shortFolder } from "./modes.ts";
import { type Session, type SessionOptions, startSession } from "./session.ts";

const UID = process.getuid?.() ?? 0;
const version = BOARD_PROTOCOL_VERSION;
const WAIT_MS = 5_000;
const FIXTURES = join(import.meta.dir, "..", "..", "..", "contract", "test", "fixtures");

/** The approved plain-choice ask, as the agent sends it. */
export const PLAIN_CHOICE: Record<string, unknown> = JSON.parse(
  readFileSync(join(FIXTURES, "asks", "plain-choice.json"), "utf8"),
);
export const QUESTION = plainChoiceBoardDocument.items[0];

/** The plain-choice ask under another ID, and another title when given. */
export const askOf = (askId: string, title?: string): Record<string, unknown> => ({
  ...PLAIN_CHOICE,
  askId,
  ...(title === undefined ? {} : { title }),
});

/** A subagent of the given type, with an ID like Claude Code's. */
export const subagent = (id: string, type = "code-reviewer"): Agent => ({ id, type });

const waitFor = async <T>(probe: () => T | undefined, what: string, ms = WAIT_MS): Promise<T> => {
  const until = Date.now() + ms;
  for (;;) {
    const found = probe();
    if (found !== undefined) return found;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await Bun.sleep(10);
  }
};

/** The session file a session process of this suite writes, in the folder its environment gives. */
export const sessionFilePathOf = (env: Readonly<Record<string, string>>): string =>
  sessionFilePath(
    sessionFolder({ env: { XDG_RUNTIME_DIR: env.XDG_RUNTIME_DIR, TMPDIR: env.TMPDIR }, uid: UID }),
    process.pid,
  );

export type ClaudeSession = {
  readonly session: Session;
  /** Where the session file is, by the suite's PID, the session process's parent. */
  readonly path: string;
  readonly file: SessionFile;
};

/**
 * Starts a session process as Claude Code starts it, its session folder in a short runtime folder
 * of its own unless `options.env` says otherwise, then waits for its session file: the local API
 * starts at the first request after the handshake.
 */
export const startClaudeSession = async (options: SessionOptions = {}): Promise<ClaudeSession> => {
  const env = options.env ?? { XDG_RUNTIME_DIR: shortFolder() };
  const session = await startSession({ ...options, env });
  await session.client.listTools();
  const path = sessionFilePathOf(session.env);
  await waitFor(() => (existsSync(path) ? true : undefined), "the session file");
  const file = await waitFor(() => {
    try {
      return JSON.parse(readFileSync(path, "utf8")) as SessionFile;
    } catch {
      return undefined;
    }
  }, "a whole session file");
  return { session, path, file };
};

export type AskResultJson = {
  readonly askId: string;
  readonly epoch: string;
  readonly board: string;
  readonly cursor: string;
};

/** The board's next message of a type, the others skipped. */
export const nextOfType = async (
  board: BoardSocket,
  type: string,
): Promise<Record<string, unknown>> => {
  for (;;) {
    const message = (await board.next()) as Record<string, unknown>;
    if (message.type === type) return message;
  }
};

/** Opens a board's socket as the board page does, sends the token, and takes the board and state. */
export const connectBoard = async (link: string): Promise<BoardSocket> => {
  const parts = linkParts(link);
  const board = await openBoardSocket(parts.port, parts.askId);
  board.send({ version, type: "connect", token: parts.token });
  await nextOfType(board, "board");
  await nextOfType(board, "state");
  return board;
};

export type Asked = {
  readonly call: AgentCall;
  readonly result: AskResultJson;
  readonly board: BoardSocket;
};

/** An agent's ask through its hooks, then its board connected. */
export const askAndConnect = async (
  session: Session,
  agent: Agent | undefined,
  askId: string,
  title?: string,
): Promise<Asked> => {
  const call = await callAs(session, agent, "ask", askOf(askId, title));
  if (call.outcome.isError) throw new Error(`the ask failed: ${call.outcome.text}`);
  const result = call.outcome.json as AskResultJson;
  return { call, result, board: await connectBoard(result.board) };
};

/** The user picks `choice` on the board and presses Answer. */
export const answer = (board: BoardSocket, choice: readonly string[]): void => {
  board.send({
    version,
    type: "answer",
    itemId: QUESTION.id,
    rev: 1,
    choice,
    when: "2026-10-29T09:41:27Z",
  });
};

/**
 * Waits for a header message of `type` that `matches`, received at or after position `from` of the
 * board's header messages, and returns the latest such.
 */
export const headerOf = (
  board: BoardSocket,
  type: "origin" | "agent",
  matches: (message: Record<string, unknown>) => boolean = () => true,
  from = 0,
): Promise<Record<string, unknown>> =>
  waitFor(
    () =>
      (board.header.slice(from) as Record<string, unknown>[])
        .filter((message) => message.type === type && matches(message))
        .at(-1),
    `the board's ${type} message`,
  );

/** A push's text read back as the agent reads it: the preface, then a valid push message. */
export const pushedMessage = (text: string): PushMessage => {
  const at = text.indexOf("\n");
  const [preface, json] = [text.slice(0, at), text.slice(at + 1)];
  if (preface !== PUSH_MESSAGE_PREFACE) throw new Error(`a push opens with ${preface}`);
  const checked = validatePushMessage(JSON.parse(json));
  if (!checked.ok) throw new Error(`the contract refuses the push: ${JSON.stringify(checked)}`);
  return checked.value;
};

/** The polls the local API answered, through fetch or the client, with their responses. */
export const answeredPolls = (record: HostRecord) =>
  record.exchanges.filter(
    (exchange) => exchange.path.startsWith("/v1/mod/poll") && exchange.status === 200,
  );

/** Waits until the mod has made `count` more answered polls, so it had the chance to act. */
export const afterPolls = async (host: ModHost, count = 2): Promise<void> => {
  const start = answeredPolls(host.record).length;
  await host.until(
    (record) => (answeredPolls(record).length >= start + count ? true : undefined),
    `${count} more answered polls`,
  );
};
