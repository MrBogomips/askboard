// What the user has not seen yet (ask-lifecycle, design decision 6; EXPERIENCE.md, New-question
// badge and Unread-reply marker; F-20, F-55): a question the agent added is new until it has been in
// view, and a reply that arrives while its question is out of view is unread until the question
// has been in view; a question the agent deletes leaves both. The board's questions at boot, and
// the replies it had then, count as seen. The
// cards report whether they are in view (`useInView`); the header, the outline, the tabs and the
// question navigator read the snapshot.

import type { LifecycleBoardState } from "@askboard/contract";
import { type RefObject, useEffect } from "react";
import { questionsOf, type ViewDocument } from "../view-document.ts";

export type AttentionSnapshot = {
  /** Questions the agent added that the user has not seen. */
  readonly unseen: ReadonlySet<string>;
  /** Unread replies, by question. */
  readonly unread: ReadonlyMap<string, number>;
};

export type Attention = {
  get(): AttentionSnapshot;
  /** A new board document: questions not on the board before are new. */
  documentChanged(document: ViewDocument): void;
  /** A new state: replies added to questions out of view are unread. */
  stateChanged(state: LifecycleBoardState): void;
  /** A question came into view, or left it. */
  setInView(questionId: string, inView: boolean): void;
  subscribe(listener: () => void): () => void;
};

const repliesOf = (state: LifecycleBoardState): Map<string, number> =>
  new Map(
    state.questions.map((question) => [
      question.itemId,
      (question.thread ?? []).reduce((count, entry) => count + entry.replies.length, 0),
    ]),
  );

export const createAttention = (document: ViewDocument, state: LifecycleBoardState): Attention => {
  const known = new Set(questionsOf(document).map((question) => question.id));
  const replies = repliesOf(state);
  const inView = new Set<string>();
  let snapshot: AttentionSnapshot = { unseen: new Set(), unread: new Map() };
  const listeners = new Set<() => void>();
  const set = (next: AttentionSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => snapshot,
    documentChanged: (next) => {
      const ids = new Set(questionsOf(next).map((question) => question.id));
      const added = [...ids].filter((id) => !known.has(id));
      for (const id of added) known.add(id);
      const fresh = added.filter((id) => !inView.has(id));
      // A question the agent deleted leaves both marks (task 6.7).
      const gone = (id: string) => !ids.has(id);
      const dropped = [...snapshot.unseen].some(gone) || [...snapshot.unread.keys()].some(gone);
      if (fresh.length === 0 && !dropped) return;
      set({
        unseen: new Set([...snapshot.unseen, ...fresh].filter((id) => ids.has(id))),
        unread: new Map([...snapshot.unread].filter(([id]) => ids.has(id))),
      });
    },
    stateChanged: (next) => {
      const unread = new Map(snapshot.unread);
      let changed = false;
      for (const [id, count] of repliesOf(next)) {
        const before = replies.get(id) ?? 0;
        replies.set(id, count);
        if (count <= before || inView.has(id)) continue;
        unread.set(id, (unread.get(id) ?? 0) + count - before);
        changed = true;
      }
      if (changed) set({ ...snapshot, unread });
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
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/** What `observeInView` uses of `IntersectionObserver`. */
export type ObserverConstructor = new (
  report: (entries: readonly { readonly isIntersecting: boolean }[]) => void,
) => { observe(element: Element): void; disconnect(): void };

/**
 * Reports to `attention` whether the element is in the view's viewport, as the observer sees it;
 * returns what stops it, which also reports the question out of view.
 */
export const observeInView = (
  element: Element | null,
  questionId: string,
  attention: Attention,
  Observer: ObserverConstructor | undefined = globalThis.IntersectionObserver,
): (() => void) | undefined => {
  if (element === null || Observer === undefined) return undefined;
  const observer = new Observer((entries) => {
    for (const entry of entries) attention.setInView(questionId, entry.isIntersecting);
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
    attention.setInView(questionId, false);
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
