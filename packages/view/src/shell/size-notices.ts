// The lines on a question's card for a message too large (oversized-acts, design decisions 2, 3
// and 4; EXPERIENCE.md, State Patterns, Question): that an answer or a Submit was not sent because
// it passes the board's message limit, that the board refused a command as too large, and that a
// question's work is too large to keep across a reload. The user's work is never touched: a notice
// only says what did not go. An act notice goes when its question's work changes (`sync`, given the
// references the stores hold for the question) or a later command of it is sent (`clear`); the
// draft line follows the board page's latest reply to the draft.

import { formatNumber, type Locale } from "@askboard/contract";
import { t } from "../strings/index.ts";
import type { MessageSize, SettledAct } from "../view-protocol.ts";
import type { AnswerActs } from "./answer-acts.ts";
import { sameRefs } from "./work-refs.ts";

/** What a card says of a command that did not go. */
export type SizeNotice =
  /** An answer or a Submit the board page refused: nothing was sent, with its size and the limit. */
  | { readonly kind: "answer" | "submit"; readonly size: MessageSize }
  /** `board-host` closed the socket as too large: the command was not sent again. */
  | { readonly kind: "closed" };

export type SizeNotices = {
  /** The act notice of a question, if it has one. */
  noticeOf(questionId: string): SizeNotice | undefined;
  /** Whether the board page left the question's work out of the mirrored draft. */
  leftOut(questionId: string): boolean;
  /** A command the board page refused as too large, or a Submit, for each question it named. */
  refused(questionIds: readonly string[], size: MessageSize, via: "answer" | "submit"): void;
  /** A command the board page settled as refused after a socket closed as too large. */
  closed(questionIds: readonly string[]): void;
  /** A command of these questions was sent: their act notices go. */
  clear(questionIds: readonly string[]): void;
  /** The board page's latest reply to the draft: the questions it left out. */
  draftReply(leftOut: readonly string[]): void;
  /** A store changed: the notices of questions whose work changed go. */
  sync(): void;
  subscribe(listener: () => void): () => void;
};

type Held = { readonly notice: SizeNotice; readonly refs: readonly unknown[] };

/**
 * The store of the notices. `refsOf` gives the references the stores hold for a question's work (its
 * work record and the value, result and entry of each of its items), which change whenever the
 * work does, so a notice stays only while they are the ones it was set on.
 */
export const createSizeNotices = (
  refsOf: (questionId: string) => readonly unknown[],
): SizeNotices => {
  // Maps, so that an ID such as `__proto__` is a key like any other.
  let notices: ReadonlyMap<string, Held> = new Map();
  let left: ReadonlySet<string> = new Set();
  const listeners = new Set<() => void>();
  const heard = () => {
    for (const listener of listeners) listener();
  };
  const set = (questionIds: readonly string[], notice: SizeNotice) => {
    const next = new Map(notices);
    for (const id of questionIds) next.set(id, { notice, refs: refsOf(id) });
    notices = next;
    heard();
  };
  const drop = (gone: readonly string[]) => {
    if (gone.length === 0) return;
    const next = new Map(notices);
    for (const id of gone) next.delete(id);
    notices = next;
    heard();
  };
  return {
    noticeOf: (id) => notices.get(id)?.notice,
    leftOut: (id) => left.has(id),
    refused: (ids, size, via) => set(ids, { kind: via, size }),
    closed: (ids) => set(ids, { kind: "closed" }),
    clear: (ids) => drop(ids.filter((id) => notices.has(id))),
    draftReply: (ids) => {
      const next = new Set(ids);
      if (next.size === left.size && [...next].every((id) => left.has(id))) return;
      left = next;
      heard();
    },
    sync: () =>
      drop([...notices].flatMap(([id, held]) => (sameRefs(held.refs, refsOf(id)) ? [] : [id]))),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

// Megabytes (a million bytes) with one decimal at most, the size rounded up and the limit down, so
// that a refused size never reads equal to the limit.
const megabytes = (bytes: number, rounding: "up" | "down", locale: Locale): string => {
  const tenths = rounding === "up" ? Math.ceil(bytes / 100_000) : Math.floor(bytes / 100_000);
  return formatNumber(tenths / 10, locale, { maxFraction: 1 });
};

/** The line a notice shows, in the ask's language, its sizes in the ask's locale. */
export const noticeText = (notice: SizeNotice, language: Locale, locale: Locale): string => {
  if (notice.kind === "closed") return t(language, "send.tooLargeClosed");
  const slots = {
    size: megabytes(notice.size.bytes, "up", locale),
    max: megabytes(notice.size.max, "down", locale),
  };
  return t(language, notice.kind === "submit" ? "send.tooLargeSubmit" : "send.tooLarge", slots);
};

/**
 * Commands the board page dropped because their socket was closed as too large: each question of
 * their flights says so. Run before `reconcile` settles the flights, which keeps the work.
 */
export const noticeTooLarge = (
  acts: AnswerActs,
  settled: readonly SettledAct[],
  notices: SizeNotices,
): void => {
  for (const flight of acts.tooLarge(settled)) {
    notices.closed([...new Set(flight.acts.map((act) => act.itemId))]);
  }
};
