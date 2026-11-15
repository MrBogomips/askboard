import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import type { QuestionWork } from "./board-draft.ts";
import { createFlow, type FlowView } from "./flow.ts";
import { createSentRecords, type Footer } from "./guided-flow.ts";
import type { HeadingRequest } from "./heading-request.ts";
import type { StatusMessage } from "./status-messages.ts";
import { createStore } from "./store.ts";

// The board's run of an act (answering-flow-guidance, design decisions 3 and 7) with stand-ins for
// the stores: what it records, announces and asks the view to do.
const open = (itemId: string) => ({ itemId, rev: 1, state: "open" });
const answered = (itemId: string) => ({
  itemId,
  rev: 1,
  state: "answered",
  answer: { choice: ["x"], when: "2026-10-31T09:41:27Z", receipt: "sent" },
});
const stateOf = (questions: unknown[]) =>
  ({ ask: "partly-answered", questions }) as unknown as LifecycleBoardState;

const setUp = (
  over: Partial<FlowView> = {},
  state = stateOf(["region", "payment", "analytics", "rollout", "erp-export"].map(open)),
) => {
  const footer = createStore<Footer | undefined>(undefined);
  const focus = createStore<HeadingRequest | undefined>(undefined);
  const removed = createStore(true);
  const recorded = createSentRecords();
  const shown: string[] = [];
  const armed: string[] = [];
  const said: StatusMessage[] = [];
  const view: FlowView = {
    document: lifecycleBoardDocument,
    state,
    work: new Map<string, QuestionWork>(),
    ladder: { flightOf: () => undefined, revisingOf: () => false },
    unseen: new Set(),
    setting: "next",
    delivery: "immediate",
    single: false,
    ...over,
  };
  const base = createFlow({
    view: () => view,
    footer,
    recorded,
    focus,
    removed,
    show: (id) => shown.push(id),
    status: { announce: (message) => said.push(message) },
    guard: { arm: (id) => armed.push(id) },
  });
  // The card runs the step at once (Decline, once the menu has closed).
  const flow = {
    act: (...args: Parameters<typeof base.act>) => {
      const step = base.act(...args);
      step.run();
      return step.output;
    },
    proceed: base.proceed,
  };
  return { flow, footer, focus, removed, recorded, shown, armed, said };
};

describe("an act with the setting Go to the next", () => {
  test("a sent answer moves: the target shown, a smooth request for its heading, the guard armed, the record kept", () => {
    const run = setUp();
    const output = run.flow.act("region", "answer", "sent", { revision: false });
    expect(output).toMatchObject({ kind: "move", target: "payment" });
    expect(run.shown).toEqual(["payment"]);
    expect(run.focus.get()).toMatchObject({ id: "payment", smooth: true });
    expect(run.armed).toEqual(["payment"]);
    expect(run.removed.get()).toBe(false);
    expect(run.footer.get()).toBeUndefined();
    const record = run.recorded.take(["region"]);
    expect(record?.revision).toBe(false);
    expect(record?.next).toMatchObject({ n: 2, m: 5 });
    // Nothing is said at the act: "sent" is said when the board page reports the command sent.
    expect(run.said).toEqual([]);
  });

  test("a held answer says its next question at the act, and records nothing for Submit's command", () => {
    const run = setUp({ delivery: "submitted" });
    run.flow.act("region", "answer", "held", { revision: false });
    expect(run.recorded.take(["region"])).toBeUndefined();
    expect(run.said).toEqual([
      { key: "status.next", params: { title: expect.any(String), n: 2, m: 5 } },
    ]);
  });

  test("a held postpone or decline says its own message, then the next question; an undo says nothing", () => {
    const postponed = setUp({ delivery: "submitted" });
    postponed.flow.act("region", "postpone", "took-effect", { revision: false });
    expect(postponed.said.map((message) => message.key)).toEqual([
      "status.postponed",
      "status.next",
    ]);
    const declined = setUp({ delivery: "submitted" });
    declined.flow.act("region", "decline", "took-effect", { revision: false });
    expect(declined.said.map((message) => message.key)).toEqual(["status.declined", "status.next"]);
    const undone = setUp({ delivery: "submitted" });
    undone.flow.act("region", "postpone", "took-effect", { revision: false, undo: true });
    expect(undone.said).toEqual([]);
  });

  test("a revision, a note alone, a blocked press and a single-question board stay", () => {
    for (const [result, revision] of [
      ["sent", true],
      ["note-sent", false],
      [undefined, false],
    ] as const) {
      const run = setUp();
      expect(run.flow.act("region", "answer", result, { revision }).kind).toBe("stay");
      expect(run.shown).toEqual([]);
      expect(run.focus.get()).toBeUndefined();
    }
    expect(
      setUp({ single: true }).flow.act("region", "answer", "sent", { revision: false }).kind,
    ).toBe("stay");
  });

  test("a revision's record says so, so that the change is what its message says", () => {
    const run = setUp();
    run.flow.act("region", "answer", "sent", { revision: true });
    expect(run.recorded.take(["region"])).toEqual({ revision: true });
  });

  test("the step is only run when the card runs it: Decline waits for its menu to close", () => {
    const base = setUp();
    const step = createFlow({
      view: () => ({
        document: lifecycleBoardDocument,
        state: stateOf(["region", "payment"].map(open)),
        work: new Map(),
        ladder: { flightOf: () => undefined, revisingOf: () => false },
        unseen: new Set(),
        setting: "next",
        delivery: "immediate",
        single: false,
      }),
      footer: base.footer,
      recorded: base.recorded,
      focus: base.focus,
      removed: base.removed,
      show: (id) => base.shown.push(id),
      status: { announce: () => {} },
      guard: { arm: () => {} },
    }).act("region", "decline", "took-effect", { revision: false });
    expect(step.output.kind).toBe("move");
    expect(base.shown).toEqual([]);
    expect(base.focus.get()).toBeUndefined();
    step.run();
    expect(base.shown).toEqual(["payment"]);
    expect(base.focus.get()).toMatchObject({ id: "payment" });
  });

  test("the last question to do completes; only postponed ones left is no move either", () => {
    const run = setUp(
      {},
      stateOf(
        ["region", ...["payment", "analytics", "rollout", "erp-export"]].map((id) =>
          id === "region" ? open(id) : answered(id),
        ),
      ),
    );
    expect(run.flow.act("region", "answer", "sent", { revision: false }).kind).toBe("complete");
    expect(run.focus.get()).toBeUndefined();
  });
});

describe("an act with the setting Stay here", () => {
  test("the footer names the target and the guard is armed; no move is made", () => {
    const run = setUp({ setting: "stay" });
    const output = run.flow.act("region", "answer", "sent", { revision: false });
    expect(output.kind).toBe("footer");
    expect(run.footer.get()).toMatchObject({
      from: "region",
      target: "payment",
      newFromAgent: false,
    });
    expect(run.shown).toEqual([]);
    expect(run.focus.get()).toBeUndefined();
    expect(run.armed).toEqual(["payment"]);
  });

  test("a new question from the agent is marked in the footer", () => {
    const run = setUp({ setting: "stay", unseen: new Set(["erp-export"]) });
    run.flow.act("region", "answer", "sent", { revision: false });
    expect(run.footer.get()).toMatchObject({ target: "erp-export", newFromAgent: true });
  });

  test("Continue makes the move and clears the footer; with no footer it does nothing", () => {
    const run = setUp({ setting: "stay" });
    run.flow.proceed();
    expect(run.shown).toEqual([]);
    run.flow.act("region", "answer", "sent", { revision: false });
    run.flow.proceed();
    expect(run.footer.get()).toBeUndefined();
    expect(run.shown).toEqual(["payment"]);
    expect(run.focus.get()).toMatchObject({ id: "payment", smooth: true });
    expect(run.armed).toEqual(["payment", "payment"]);
  });

  test("an act on another question, or that took effect on this one, clears the footer; a blocked press does not", () => {
    const run = setUp({ setting: "stay" });
    run.flow.act("region", "answer", "sent", { revision: false });
    run.flow.act("payment", "answer", undefined, { revision: false });
    expect(run.footer.get()).toBeDefined();
    run.flow.act("analytics", "answer", "note-sent", { revision: false });
    expect(run.footer.get()).toBeUndefined();
  });
});

describe("the area just finished", () => {
  test("a move out of an area names it in the record, and in the footer", () => {
    const areas = lifecycleBoardDocument.items as unknown as readonly {
      id: string;
      props: { title: string; items: readonly { id: string }[] };
    }[];
    const [first, second] = areas;
    if (first === undefined || second === undefined) throw new Error("two areas");
    const last = first.props.items.at(-1)?.id ?? "";
    const state = stateOf(
      [...first.props.items, ...second.props.items].map((each) =>
        first.props.items.some((q) => q.id === each.id) && each.id !== last
          ? answered(each.id)
          : open(each.id),
      ),
    );
    const moved = setUp({}, state);
    moved.flow.act(last, "answer", "sent", { revision: false });
    expect(moved.recorded.take([last])?.areaDone).toBe(first.props.title);
    const stayed = setUp({ setting: "stay" }, state);
    stayed.flow.act(last, "answer", "sent", { revision: false });
    expect(stayed.footer.get()?.area).toBe(second.props.title);
  });
});
