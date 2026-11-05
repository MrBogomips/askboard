// Comparing what the board page sends with a transcript's page half (design decision 13). Track
// 0's transcripts compare exactly, except an answer's `when`: the board stamps the time of the
// click (FR-19, FR-22), so a test checks it against the click's window instead of the time the
// transcript was recorded with. Since the ask lifecycle, the board page speaks protocol 1.1 to
// E1's transcripts: it answers with an act command of one answer act under an action ID of its
// own, which stands for the transcript's answer, and it mirrors draft records, which no E1
// transcript holds and which never reach the agent, so they are left out (ask-lifecycle, design
// decision 6). Push
// delivery's presence messages (task 5.3) are no transcript's either: the comparisons leave them
// out, and `presenceMessagesOf` lists them.

import {
  ACTION_ID_PATTERN,
  type PageMessage,
  type SnapshotCommand,
  UTC_TIME_PATTERN,
} from "@askboard/contract";
import type { ReplayTranscript } from "./transcripts.ts";

/** A message the board page sent, with the number of the socket it sent it on, from 1. */
export type SentMessage = { readonly socket: number; readonly message: unknown };

export type ExpectedMessage = {
  readonly socket: number;
  readonly message: PageMessage | SnapshotCommand;
};

/** When the user acted: the test's clock just before the click and just after it. */
export type ClickWindow = { readonly from: number; readonly to: number };

/** A WebSocket as the browser saw it: each frame in order, sent by the page or received. */
export type RecordedSocket = {
  readonly url: string;
  readonly frames: readonly { readonly dir: "sent" | "received"; readonly text: string }[];
};

const UTC_TIME = new RegExp(UTC_TIME_PATTERN);
const ACTION_ID = new RegExp(ACTION_ID_PATTERN);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The board may stamp to the second: a stamp of the second the click started in counts.
const inWindow = (when: unknown, window: ClickWindow | undefined): boolean => {
  if (typeof when !== "string" || !UTC_TIME.test(when)) return false;
  if (window === undefined) return true;
  const at = Date.parse(when);
  return at >= Math.floor(window.from / 1000) * 1000 && at <= window.to;
};

/** The one answer act of an act command, as E1's answer command would carry it, if it holds one. */
export const answerOfAct = (message: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(message) || message.type !== "act" || !Array.isArray(message.acts)) {
    return undefined;
  }
  const [act, ...more] = message.acts as unknown[];
  if (more.length > 0 || !isRecord(act) || act.type !== "answer") return undefined;
  if (typeof message.actionId !== "string" || !ACTION_ID.test(message.actionId)) return undefined;
  const { type: _, ...fields } = act;
  return { version: message.version, type: "answer", ...fields };
};

/** Whether a message is a draft record, which the board page mirrors on its own. */
export const isDraft = (message: unknown): boolean => isRecord(message) && message.type === "draft";

// A Snapshot request with the page's own request ID, a fresh action ID (snapshot task 7.1).
const sameSnapshot = (sent: Record<string, unknown>, expected: SnapshotCommand): boolean => {
  const { requestId, ...rest } = sent;
  const { requestId: _, ...expectedRest } = expected;
  return (
    typeof requestId === "string" &&
    ACTION_ID.test(requestId) &&
    Bun.deepEquals(rest, expectedRest, true)
  );
};

/**
 * Whether a sent message is the transcript's, an answer's `when` checked as a time and a Snapshot
 * request's ID as an action ID.
 */
export const samePageMessage = (
  sent: unknown,
  expected: PageMessage | SnapshotCommand,
  answeredAt?: ClickWindow,
): boolean => {
  const actual = expected.type === "answer" ? (answerOfAct(sent) ?? sent) : sent;
  if (!isRecord(actual)) return false;
  if (expected.type === "snapshot") return sameSnapshot(actual, expected);
  if (expected.type !== "answer") return Bun.deepEquals(actual, expected, true);
  const { when, ...rest } = actual;
  const { when: _, ...expectedRest } = expected;
  return Bun.deepEquals(rest, expectedRest, true) && inWindow(when, answeredAt);
};

/** The transcript's page half in order, each `connect` carrying the session's token. */
export const pageHalf = (
  transcript: Pick<ReplayTranscript, "token" | "steps">,
  token: string = transcript.token,
): ExpectedMessage[] =>
  transcript.steps.flatMap((step) => {
    if (step.from !== "page" || !("message" in step)) return [];
    const message = step.message.type === "connect" ? { ...step.message, token } : step.message;
    return [{ socket: step.socket, message }];
  });

/** A message in a few words: its type, and for an answer what it answers. */
export const summary = (message: unknown): string => {
  if (message === undefined) return "nothing";
  if (!isRecord(message)) return JSON.stringify(message);
  if (message.type === "act" && Array.isArray(message.acts)) {
    return `act [${message.acts.map((act) => summary(act)).join(", ")}]`;
  }
  const type = String(message.type);
  if (type !== "answer") return type;
  const choice = Array.isArray(message.choice) ? message.choice.join(", ") : "?";
  return `answer ${String(message.itemId)} rev ${String(message.rev)} [${choice}]`;
};

const bySocket = <T extends { readonly socket: number }>(list: readonly T[]) => {
  const sockets = new Map<number, T[]>();
  for (const entry of list)
    sockets.set(entry.socket, [...(sockets.get(entry.socket) ?? []), entry]);
  return sockets;
};

/** Every difference between what each socket sent and what the transcript says it sends. */
export const pageHalfProblems = (
  sent: readonly SentMessage[],
  expected: readonly ExpectedMessage[],
  answeredAt?: ClickWindow,
): string[] => {
  const actual = bySocket(sent);
  const wanted = bySocket(expected);
  const sockets = [...new Set([...actual.keys(), ...wanted.keys()])].sort((a, b) => a - b);
  return sockets.flatMap((socket) => {
    const got = actual.get(socket) ?? [];
    const want = wanted.get(socket) ?? [];
    return Array.from({ length: Math.max(got.length, want.length) }, (_, at) => {
      const message = got[at]?.message;
      const expectedMessage = want[at]?.message;
      if (expectedMessage !== undefined && samePageMessage(message, expectedMessage, answeredAt)) {
        return [];
      }
      return [
        `socket ${socket}, message ${at + 1}: sent ${summary(message)}, expected ${summary(expectedMessage)}`,
      ];
    }).flat();
  });
};

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** Whether a message names itself the board page's presence message. */
export const isPresenceMessage = (message: unknown): boolean =>
  isRecord(message) && message.type === "presence";

type Frame = RecordedSocket["frames"][number];

const isPresenceFrame = (frame: Frame): boolean => isPresenceMessage(parsed(frame.text));

// What the page sent that a transcript can hold: its draft records left out.
const sentFrames = (socket: RecordedSocket) =>
  socket.frames.filter((frame) => frame.dir === "sent" && !isDraft(parsed(frame.text)));

// Sockets that never opened sent nothing: the transcript numbers only those that did.
const usedSockets = (sockets: readonly RecordedSocket[]) =>
  sockets.filter((socket) => sentFrames(socket).length > 0);

// What each socket that sent something sent, numbered as the transcript does, presence or not.
const sentOf = (sockets: readonly RecordedSocket[], presence: boolean): SentMessage[] =>
  usedSockets(sockets).flatMap((socket, at) =>
    sentFrames(socket)
      .filter((frame) => isPresenceFrame(frame) === presence)
      .map((frame) => ({ socket: at + 1, message: parsed(frame.text) })),
  );

/** What the page sent on each socket that sent something, numbered as the transcript does. */
export const pageMessagesOf = (sockets: readonly RecordedSocket[]): SentMessage[] =>
  sentOf(sockets, false);

/** The presence messages the page sent, by socket, numbered as the transcript numbers sockets. */
export const presenceMessagesOf = (sockets: readonly RecordedSocket[]): SentMessage[] =>
  sentOf(sockets, true);

// The action ID of each message of this type in these frames, in order.
const actionIdsOf = (
  sockets: readonly RecordedSocket[],
  dir: Frame["dir"],
  type: "act" | "done",
): string[] =>
  sockets.flatMap((socket) =>
    socket.frames.flatMap((frame) => {
      if (frame.dir !== dir) return [];
      const message = parsed(frame.text);
      return isRecord(message) && message.type === type && typeof message.actionId === "string"
        ? [message.actionId]
        : [];
    }),
  );

/**
 * Whether board-host has applied the first `count` act commands the page sent, on any socket: its
 * `done` names each (AD-20). A command shows "sent" once it leaves the page, before this.
 */
export const actsDoneIn = (sockets: readonly RecordedSocket[], count: number): boolean => {
  // A command resent across a drop keeps its action ID (AD-20): it counts once.
  const sent = [...new Set(actionIdsOf(sockets, "sent", "act"))];
  const done = new Set(actionIdsOf(sockets, "received", "done"));
  return sent.length >= count && sent.slice(0, count).every((actionId) => done.has(actionId));
};

/**
 * Page messages sent before the host's messages that precede them on their socket in the
 * transcript had arrived, such as an answer queued across a drop sent before the new socket's
 * state showed the question open.
 */
export const orderProblems = (
  sockets: readonly RecordedSocket[],
  transcript: Pick<ReplayTranscript, "steps">,
): string[] =>
  usedSockets(sockets).flatMap((socket, at) => {
    const number = at + 1;
    const steps = transcript.steps.filter((step) => step.socket === number && "message" in step);
    let received = 0;
    let sent = 0;
    return socket.frames.flatMap((frame) => {
      if (frame.dir === "sent" && isPresenceFrame(frame)) return [];
      if (frame.dir === "received") {
        received += 1;
        return [];
      }
      if (isDraft(parsed(frame.text))) return [];
      const pageSteps = steps.filter((step) => step.from === "page");
      const step = pageSteps[sent];
      sent += 1;
      if (step === undefined) return [];
      const before = steps.slice(0, steps.indexOf(step)).filter((s) => s.from === "host");
      if (received >= before.length) return [];
      const names = before.map((s) => ("message" in s ? s.message.type : "")).join(", ");
      return [
        `socket ${number} sent ${summary(parsed(frame.text))} after ${received} of the ${before.length} host messages before it (${names})`,
      ];
    });
  });
