import { describe, expect, mock, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import type { ViewArea, ViewDocument } from "../view-document.ts";
import {
  createAttention,
  IN_VIEW_ATTRIBUTE,
  type ObserverConstructor,
  observeInView,
} from "./attention.ts";

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

type Report = (entries: readonly { isIntersecting: boolean }[]) => void;

// One card in a viewport whose observers report as a browser's do: only at a rendering update, a
// target observed since the last one gets its first entry and a target whose state changed gets
// one; a scroll changes the layout at once and the observers only at the next update.
const fakeViewport = () => {
  let shown = true;
  const attributes = new Map<string, string>();
  const observers = new Set<{ report: Report; last: boolean | undefined }>();
  const Observer = class {
    readonly #self: { report: Report; last: boolean | undefined };
    constructor(report: Report) {
      this.#self = { report, last: undefined };
    }
    observe() {
      observers.add(this.#self);
    }
    disconnect() {
      observers.delete(this.#self);
    }
  } as unknown as ObserverConstructor;
  return {
    Observer,
    element: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    } as unknown as Element,
    attributes,
    observers,
    scroll: (to: boolean) => {
      shown = to;
    },
    update: () => {
      for (const observer of [...observers]) {
        if (observer.last === shown) continue;
        observer.last = shown;
        observer.report([{ isIntersecting: shown }]);
      }
    },
  };
};

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

  test("a reply to a question reported in view, with no card to look at again, is read at once", () => {
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
    const attributes = new Map<string, string>();
    const element = {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    } as unknown as Element;
    const stop = observeInView(element, "budget", attention, Fake);
    expect(observed).toEqual([element]);
    report?.([{ isIntersecting: false }]);
    expect([...attention.get().unseen]).toEqual(["budget"]);
    expect(attributes.get(IN_VIEW_ATTRIBUTE)).toBe("false");
    report?.([{ isIntersecting: true }]);
    expect([...attention.get().unseen]).toEqual([]);
    expect(attributes.get(IN_VIEW_ATTRIBUTE)).toBe("true");
    stop?.();
    expect(disconnected).toBe(1);
    expect(attributes.get(IN_VIEW_ATTRIBUTE)).toBe("false");
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

  test("a reply that arrives after its question left view, before the observer reports it, is unread", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    const viewport = fakeViewport();
    observeInView(viewport.element, "region", attention, viewport.Observer);
    viewport.update();
    // The user scrolls the question away, and the reply arrives before the next rendering update.
    viewport.scroll(false);
    attention.stateChanged(stateWith({ region: 1 }));
    viewport.update();
    expect([...attention.get().unread]).toEqual([["region", 1]]);
  });

  test("a reply to a question still in view is read once a look taken after it finds it there", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    const viewport = fakeViewport();
    observeInView(viewport.element, "region", attention, viewport.Observer);
    viewport.update();
    attention.stateChanged(stateWith({ region: 1 }));
    attention.stateChanged(stateWith({ region: 2 }));
    expect(viewport.observers.size).toBe(3);
    expect(attention.get().unread.size).toBe(0);
    viewport.update();
    expect(attention.get().unread.size).toBe(0);
    expect(viewport.observers.size).toBe(1);
    viewport.scroll(false);
    viewport.update();
    attention.stateChanged(stateWith({ region: 3 }));
    expect([...attention.get().unread]).toEqual([["region", 1]]);
    expect(viewport.observers.size).toBe(1);
  });

  test("only the look started after the latest reply settles the replies waiting", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    const looks: ((inView: boolean) => void)[] = [];
    attention.track("region", (report) => looks.push(report));
    attention.setInView("region", true);
    attention.stateChanged(stateWith({ region: 1 }));
    attention.stateChanged(stateWith({ region: 2 }));
    // The first look can have been taken before the second reply arrived.
    looks[0]?.(true);
    expect(attention.get().unread.size).toBe(0);
    looks[1]?.(false);
    expect([...attention.get().unread]).toEqual([["region", 2]]);
    looks[1]?.(true);
    expect([...attention.get().unread]).toEqual([["region", 2]]);
  });

  test("replies waiting for a look are unread when the card stops being observed, and dropped with a deleted question", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    const viewport = fakeViewport();
    const stop = observeInView(viewport.element, "region", attention, viewport.Observer);
    viewport.update();
    attention.stateChanged(stateWith({ region: 2 }));
    stop?.();
    expect(viewport.observers.size).toBe(0);
    expect([...attention.get().unread]).toEqual([["region", 2]]);
    expect(viewport.attributes.get(IN_VIEW_ATTRIBUTE)).toBe("false");

    const deleting = createAttention(withAdded, stateWith({}));
    const card = fakeViewport();
    const stopCard = observeInView(card.element, "budget", deleting, card.Observer);
    card.update();
    const withBudget = stateWith({});
    deleting.stateChanged({
      ...withBudget,
      questions: [
        ...withBudget.questions,
        { itemId: "budget", rev: 1, state: "open", thread: thread(1) },
      ],
    } as unknown as LifecycleBoardState);
    deleting.documentChanged(lifecycleBoardDocument);
    stopCard?.();
    expect(deleting.get().unread.size).toBe(0);
  });

  test("no element, or no observer, observes nothing", () => {
    const attention = createAttention(lifecycleBoardDocument, stateWith({}));
    expect(observeInView(null, "region", attention)).toBeUndefined();
    expect(observeInView({} as Element, "region", attention, undefined)).toBeUndefined();
  });
});
