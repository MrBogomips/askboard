// What the user has not seen yet (ask-lifecycle, design decision 6; EXPERIENCE.md, New-question
// badge and Unread-reply marker; F-20, F-55): a question the agent added is new until it has been in
// view, and a reply that arrives while its question is out of view is unread until the question
// has been in view; a question the agent deletes leaves both. The board's questions at boot, and
// the replies it had then, count as seen. The
// cards report whether they are in view (`useInView`); the header, the outline, the tabs and the
// question navigator read the snapshot.
//
// The observer reports only at the browser's rendering updates, so its last report can be a frame
// old when a reply arrives: the user may have scrolled the question away since. A reply to a
// question last reported in view therefore waits for a fresh look at its card, an observation
// taken after the reply arrived, and is unread unless that look finds the question in view.

import type { LifecycleBoardState } from "@askboard/contract";
import { type RefObject, useEffect } from "react";
import { questionsOf, type ViewDocument } from "../view-document.ts";

export type AttentionSnapshot = {
  /** Questions the agent added that the user has not seen. */
  readonly unseen: ReadonlySet<string>;
  /** Unread replies, by question. */
  readonly unread: ReadonlyMap<string, number>;
};

/** Takes a fresh look at a question's card: reports once whether it is in view, observed later. */
export type Look = (report: (inView: boolean) => void) => void;

export type Attention = {
  get(): AttentionSnapshot;
  /** A new board document: questions not on the board before are new. */
  documentChanged(document: ViewDocument): void;
  /** A new state: replies added to questions out of view are unread. */
  stateChanged(state: LifecycleBoardState): void;
  /** A question came into view, or left it, as its card's observer reported. */
  setInView(questionId: string, inView: boolean): void;
  /**
   * How to look at a question's card afresh while it is observed; returns what ends it, which
   * counts the replies still waiting for a look as unread.
   */
  track(questionId: string, look: Look): () => void;
  subscribe(listener: () => void): () => void;
};

const repliesOf = (state: LifecycleBoardState): Map<string, number> =>
  new Map(
    state.questions.map((question) => [
      question.itemId,
      (question.thread ?? []).reduce((count, entry) => count + entry.replies.length, 0),
    ]),
  );

const withUnread = (
  snapshot: AttentionSnapshot,
  added: ReadonlyMap<string, number>,
): AttentionSnapshot => {
  const unread = new Map(snapshot.unread);
  for (const [id, count] of added) unread.set(id, (unread.get(id) ?? 0) + count);
  return { ...snapshot, unread };
};

export const createAttention = (document: ViewDocument, state: LifecycleBoardState): Attention => {
  const known = new Set(questionsOf(document).map((question) => question.id));
  const replies = repliesOf(state);
  const inView = new Set<string>();
  const looks = new Map<string, Look>();
  /** Replies to questions last reported in view, waiting for the latest fresh look, by question. */
  const waiting = new Map<string, { readonly count: number }>();
  let snapshot: AttentionSnapshot = { unseen: new Set(), unread: new Map() };
  const listeners = new Set<() => void>();
  const set = (next: AttentionSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const settle = (questionId: string, shown: boolean) => {
    const batch = waiting.get(questionId);
    if (batch === undefined) return;
    waiting.delete(questionId);
    if (!shown) set(withUnread(snapshot, new Map([[questionId, batch.count]])));
  };
  // A reply to a question last reported in view is read only if a look taken after it still finds
  // the question there: each reply starts a look, and only the latest settles what is waiting.
  const lookAgain = (questionId: string, added: number) => {
    const look = looks.get(questionId);
    if (look === undefined) return;
    const batch = { count: (waiting.get(questionId)?.count ?? 0) + added };
    waiting.set(questionId, batch);
    look((shown) => {
      if (waiting.get(questionId) === batch) settle(questionId, shown);
    });
  };
  return {
    get: () => snapshot,
    documentChanged: (next) => {
      const ids = new Set(questionsOf(next).map((question) => question.id));
      const added = [...ids].filter((id) => !known.has(id));
      for (const id of added) known.add(id);
      const fresh = added.filter((id) => !inView.has(id));
      // A question the agent deleted leaves both marks (task 6.7) and its replies waiting for a look.
      const gone = (id: string) => !ids.has(id);
      for (const id of [...waiting.keys()].filter(gone)) waiting.delete(id);
      const dropped = [...snapshot.unseen].some(gone) || [...snapshot.unread.keys()].some(gone);
      if (fresh.length === 0 && !dropped) return;
      set({
        unseen: new Set([...snapshot.unseen, ...fresh].filter((id) => ids.has(id))),
        unread: new Map([...snapshot.unread].filter(([id]) => ids.has(id))),
      });
    },
    stateChanged: (next) => {
      const unread = new Map<string, number>();
      for (const [id, count] of repliesOf(next)) {
        const added = count - (replies.get(id) ?? 0);
        replies.set(id, count);
        if (added <= 0) continue;
        if (inView.has(id)) lookAgain(id, added);
        else unread.set(id, added);
      }
      if (unread.size > 0) set(withUnread(snapshot, unread));
    },
    setInView: (questionId, shown) => {
      if (!shown) {
        inView.delete(questionId);
        return;
      }
      inView.add(questionId);
      if (!snapshot.unseen.has(questionId) && !snapshot.unread.has(questionId)) return;
      const unseen = new Set(snapshot.unseen);
      unseen.delete(questionId);
      const unread = new Map(snapshot.unread);
      unread.delete(questionId);
      set({ unseen, unread });
    },
    track: (questionId, look) => {
      looks.set(questionId, look);
      return () => {
        if (looks.get(questionId) === look) looks.delete(questionId);
        settle(questionId, false);
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/**
 * The attribute on an observed card saying whether its observer last reported it in view, "true"
 * or "false", as `attention` heard it; the browser tests wait on it.
 */
export const IN_VIEW_ATTRIBUTE = "data-askboard-in-view";

/** What `observeInView` uses of `IntersectionObserver`. */
export type ObserverConstructor = new (
  report: (entries: readonly { readonly isIntersecting: boolean }[]) => void,
) => { observe(element: Element): void; disconnect(): void };

/**
 * Reports to `attention` whether the element is in the view's viewport, as the observer sees it,
 * and gives it fresh looks: a new observer's first report is an observation taken after it began.
 * Returns what stops both, which also reports the question out of view.
 */
export const observeInView = (
  element: Element | null,
  questionId: string,
  attention: Attention,
  Observer: ObserverConstructor | undefined = globalThis.IntersectionObserver,
): (() => void) | undefined => {
  if (element === null || Observer === undefined) return undefined;
  const report = (shown: boolean) => {
    element.setAttribute(IN_VIEW_ATTRIBUTE, String(shown));
    attention.setInView(questionId, shown);
  };
  const looking = new Set<{ disconnect(): void }>();
  const stopLooks = attention.track(questionId, (reportLook) => {
    let done = false;
    const look = new Observer((entries) => {
      const last = entries.at(-1);
      if (done || last === undefined) return;
      done = true;
      look.disconnect();
      looking.delete(look);
      reportLook(last.isIntersecting);
    });
    looking.add(look);
    look.observe(element);
  });
  const observer = new Observer((entries) => {
    for (const entry of entries) report(entry.isIntersecting);
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
    for (const look of looking) look.disconnect();
    stopLooks();
    report(false);
  };
};

/** Reports whether the element is in the view's viewport while it is mounted. */
export const useInView = (
  ref: RefObject<Element | null>,
  questionId: string,
  attention: Attention,
): void => {
  useEffect(() => observeInView(ref.current, questionId, attention), [ref, questionId, attention]);
};
