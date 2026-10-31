import { describe, expect, mock, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import type { ViewArea, ViewDocument } from "../view-document.ts";
import { createAttention, type ObserverConstructor, observeInView } from "./attention.ts";

const when = "2026-10-31T09:41:27Z";
const thread = (replies: number) => [
  {
    cursor: "k3x9.4",
    who: "Sara Conti",
    when,
    text: "Why?",
    replies: Array.from({ length: replies }, (_, n) => ({ text: `r${n}`, when })),
  },
];
const stateWith = (replies: Record<string, number>): LifecycleBoardState =>
  ({
    ask: "waiting",
    questions: ["region", "payment", "analytics", "rollout", "erp-export"].map((itemId) => ({
      itemId,
      rev: 1,
      state: "open",
      ...(replies[itemId] === undefined ? {} : { thread: thread(replies[itemId] ?? 0) }),
    })),
  }) as unknown as LifecycleBoardState;
const [scope, delivery] = lifecycleBoardDocument.items as unknown as readonly [ViewArea, ViewArea];
const withAdded: ViewDocument = {
  ...lifecycleBoardDocument,
  items: [
    scope,
    {
      ...delivery,
      props: {
        ...delivery.props,
        items: [...delivery.props.items, { ...delivery.props.items[0], id: "budget" }],
      },
    },
  ],
} as ViewDocument;

describe("what the user has not seen yet (ask-lifecycle: New-question badge, Unread replies; F-20, F-55)", () => {
  test("the board's first questions are seen; one the agent adds is new until it has been in view", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    expect([...attention.get().unseen]).toEqual([]);
    attention.documentChanged(withAdded);
    expect([...attention.get().unseen]).toEqual(["budget"]);
    attention.setInView("budget", true);
    expect([...attention.get().unseen]).toEqual([]);
  });

  test("a question the agent deletes leaves what is unseen and unread (task 6.7)", () => {
    const attention = createAttention(withAdded, stateWith({ payment: 0 }));
    attention.stateChanged(stateWith({ payment: 1 }));
    const removed: ViewDocument = {
      ...lifecycleBoardDocument,
      items: [
        {
          ...scope,
          props: { ...scope.props, items: scope.props.items.filter(({ id }) => id !== "payment") },
        },
        delivery,
      ],
    } as unknown as ViewDocument;
    const added: ViewDocument = {
      ...removed,
      items: [
        removed.items[0] as ViewArea,
        {
          ...delivery,
          props: {
            ...delivery.props,
            items: [...delivery.props.items, { ...delivery.props.items[0], id: "fresh" }],
          },
        },
      ],
    } as ViewDocument;
    attention.documentChanged(added);
    expect([...attention.get().unseen]).toEqual(["fresh"]);
    attention.documentChanged(removed);
    expect([...attention.get().unseen]).toEqual([]);
    expect([...attention.get().unread]).toEqual([]);
  });

  test("a reply that arrives while its question is out of view is unread until it has been in view", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({ payment: 1 }));
    const heard = mock(() => {});
    attention.subscribe(heard);
    attention.stateChanged(stateWith({ payment: 2, rollout: 1 }));
    expect([...attention.get().unread]).toEqual([
      ["payment", 1],
      ["rollout", 1],
    ]);
    attention.setInView("payment", true);
    expect([...attention.get().unread]).toEqual([["rollout", 1]]);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test("a reply to a question in view is read at once", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    attention.setInView("region", true);
    attention.stateChanged(stateWith({ region: 1 }));
    expect(attention.get().unread.size).toBe(0);
    attention.setInView("region", false);
    attention.stateChanged(stateWith({ region: 2 }));
    expect([...attention.get().unread]).toEqual([["region", 1]]);
  });

  test("nothing that changes nothing is heard, and the snapshot stays the same", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    const before = attention.get();
    const heard = mock(() => {});
    attention.subscribe(heard);
    attention.stateChanged(stateWith({}));
    attention.setInView("region", true);
    attention.setInView("region", true);
    attention.documentChanged(lifecycleBoardDocument);
    expect(heard).not.toHaveBeenCalled();
    expect(attention.get()).toBe(before);
  });
});

describe("a card reports whether it is in view (IntersectionObserver)", () => {
  test("each entry the observer reports, and out of view once it stops", () => {
    let report: ((entries: readonly { isIntersecting: boolean }[]) => void) | undefined;
    const observed: unknown[] = [];
    let disconnected = 0;
    const Fake = class {
      constructor(callback: (entries: readonly { isIntersecting: boolean }[]) => void) {
        report = callback;
      }
      observe(element: Element) {
        observed.push(element);
      }
      disconnect() {
        disconnected += 1;
      }
    } as unknown as ObserverConstructor;
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    attention.documentChanged(withAdded);
    const element = {} as Element;
    const stop = observeInView(element, "budget", attention, Fake);
    expect(observed).toEqual([element]);
    report?.([{ isIntersecting: false }]);
    expect([...attention.get().unseen]).toEqual(["budget"]);
    report?.([{ isIntersecting: true }]);
    expect([...attention.get().unseen]).toEqual([]);
    stop?.();
    expect(disconnected).toBe(1);
    const withBudget = stateWith({});
    attention.stateChanged({
      ...withBudget,
      questions: [
        ...withBudget.questions,
        { itemId: "budget", rev: 1, state: "open", thread: thread(1) },
      ],
    } as unknown as LifecycleBoardState);
    expect([...attention.get().unread]).toEqual([["budget", 1]]);
  });

  test("no element, or no observer, observes nothing", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    expect(observeInView(null, "region", attention)).toBeUndefined();
    expect(observeInView({} as Element, "region", attention, undefined)).toBeUndefined();
  });
});
