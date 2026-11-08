import { describe, expect, test } from "bun:test";
import {
  type AnswerEvent,
  type OutputEvent,
  type QuestionState,
  RESULT_MAX_CHARS,
  RESULT_VERSIONS,
  SCHEMA_IDS,
} from "@askboard/contract";
import { lifecycleCollectResult } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import type { LifecycleBoardView, ReadOutcome } from "@askboard/core";
import { connect, depsWith, EPOCH, fakeCore, jsonOf, manualTimers, textOf } from "./helpers.ts";

// MCP adapter spec: Collecting events, Result size, Waiting for an item (ask-lifecycle, task 4.4),
// against a fake core: the lifecycle's states and events, one command's events kept on one page,
// and a wait on a question only, which ends at once on a postponed question or a closed or
// discarded ask, and on any event of its question in a command.

const A = "checkout-plan-p8r3";
const at = (seq: number) => `${EPOCH}.${seq}`;

const answer = (seq: number, itemId: string, size = 0): AnswerEvent => ({
  cursor: at(seq),
  type: "answer",
  itemId,
  rev: 1,
  who: "Sara Conti",
  when: "2026-10-31T14:05:12Z",
  choice: ["EU"],
  ...(size > 0 ? { note: "n".repeat(size) } : {}),
});

// One ask's log with its command groups, read as ask-core reads it.
const logOf = (events: OutputEvent[], groups: number[], state = "partly-answered") => {
  const log = { events, groups, state };
  const read = (askId: string, after: string): ReadOutcome => {
    const seq = Number(after.split(".")[1]);
    const from = log.events.findIndex((event) => Number(event.cursor.split(".")[1]) > seq);
    const start = from === -1 ? log.events.length : from;
    return {
      kind: "events",
      askId,
      state: log.state as never,
      cursor: log.events.at(-1)?.cursor ?? at(0),
      events: log.events.slice(start),
      groups: log.groups.slice(start),
    };
  };
  return { log, read };
};

const collect = async (core: ReturnType<typeof fakeCore>, args: unknown) => {
  const { client, close } = await connect(depsWith(core).deps);
  const result = await client.callTool({ name: "collect", arguments: args as never });
  await close();
  return result;
};

describe("collecting the lifecycle's states and events", () => {
  test("every event type and the new ask states pass through, unchecked", async () => {
    const [entry, gone] = lifecycleCollectResult.asks as [
      (typeof lifecycleCollectResult.asks)[number],
      (typeof lifecycleCollectResult.asks)[number],
    ];
    const core = fakeCore({
      read: (askId) =>
        askId === entry.askId
          ? {
              kind: "events",
              askId,
              state: entry.state,
              cursor: entry.cursor,
              events: entry.events,
              groups: entry.events.map((_, index) => index),
            }
          : { kind: "events", askId, state: gone.state, cursor: gone.cursor, events: gone.events },
    });
    const json = jsonOf(
      await collect(core, {
        asks: [
          { askId: entry.askId, after: at(0) },
          { askId: gone.askId, after: at(0) },
        ],
      }),
    );
    expect(json).toEqual({ ...lifecycleCollectResult, epoch: EPOCH });
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
  });
});

describe("paging keeps one command's events together", () => {
  test("a submit at a page's edge goes whole to the next page", async () => {
    // One answer alone, then a submit of three; the page has room for the first and two more.
    const events = [
      answer(1, "region", 9_000),
      answer(2, "payment", 9_000),
      answer(3, "erp-export", 9_000),
      answer(4, "rollout", 9_000),
    ];
    const { read } = logOf(events, [1, 2, 2, 2]);
    const core = fakeCore({ read });
    const first = jsonOf(await collect(core, { asks: [{ askId: A, after: at(0) }] })) as {
      more?: true;
      asks: { cursor: string; events: OutputEvent[] }[];
    };
    expect(first.more).toBe(true);
    expect(first.asks[0]?.events.map((event) => event.cursor)).toEqual([at(1)]);
    expect(first.asks[0]?.cursor).toBe(at(1));
    const rest = jsonOf(await collect(core, { asks: [{ askId: A, after: at(1) }] })) as {
      more?: true;
      asks: { events: OutputEvent[] }[];
    };
    expect(rest.more).toBeUndefined();
    expect(rest.asks[0]?.events.map((event) => event.cursor)).toEqual([at(2), at(3), at(4)]);
  });

  test("a command larger than a page fills a page by itself", async () => {
    const events = [
      answer(1, "region", 100),
      answer(2, "payment", 10_500),
      answer(3, "erp-export", 10_500),
      answer(4, "rollout", 10_500),
      answer(5, "analytics", 100),
    ];
    const { read } = logOf(events, [1, 2, 2, 2, 3]);
    const core = fakeCore({ read });
    const pages: { more?: true; asks: { cursor: string; events: OutputEvent[] }[] }[] = [];
    let after = at(0);
    for (let tries = 0; tries < 5; tries += 1) {
      const page = jsonOf(
        await collect(core, { asks: [{ askId: A, after }] }),
      ) as (typeof pages)[0];
      pages.push(page);
      after = page.asks[0]?.cursor ?? after;
      if (!page.more) break;
    }
    expect(pages.map((page) => page.asks[0]?.events.map((event) => event.cursor))).toEqual([
      [at(1)],
      [at(2), at(3), at(4)],
      [at(5)],
    ]);
  });

  test("without command groups, each event is its own unit, as before", async () => {
    const events = [answer(1, "region", 15_000), answer(2, "payment", 15_000)];
    const core = fakeCore({
      read: (askId) => ({ kind: "events", askId, state: "answered", cursor: at(2), events }),
    });
    const page = jsonOf(await collect(core, { asks: [{ askId: A, after: at(0) }] })) as {
      more?: true;
      asks: { events: OutputEvent[] }[];
    };
    expect(page.more).toBe(true);
    expect(page.asks[0]?.events).toHaveLength(1);
    expect(textOf(await collect(core, { asks: [{ askId: A, after: at(0) }] })).length).toBeLessThan(
      RESULT_MAX_CHARS,
    );
  });
});

// A Tabs of a Group of a NumberField, which q3 holds beside its Tree (layouts: a wait names a
// question, however deep the item it names sits).
const NESTED = {
  type: "tabs",
  id: "q3-tabs",
  props: {
    tabs: [
      {
        id: "t1",
        title: "T",
        items: [
          {
            type: "group",
            id: "q3-group",
            props: { title: "G", items: [{ type: "number-field", id: "q3-days", props: {} }] },
          },
        ],
      },
    ],
  },
};

// A core with an ask of questions q1 to q3 in an area, whose log, states and subscription the test
// drives, as ask-core would.
const lifecycleCore = (options: { questionStates?: Record<string, QuestionState> } = {}) => {
  const { log, read } = logOf([], [], "waiting");
  const questionStates: Record<string, QuestionState> = { ...options.questionStates };
  let askState: "waiting" | "partly-answered" | "answered" | "closed" | "discarded" = "waiting";
  let widget = true;
  const view = (askId: string): LifecycleBoardView | undefined => {
    if (askId !== A) return undefined;
    if (askState === "discarded") return { askId, state: "discarded" };
    const ids = ["q1", "q2", "q3"].filter((id) => id !== "q3" || widget);
    const question = (id: string) => ({
      type: "question",
      id,
      rev: 1,
      props: {
        text: id,
        options: [{ label: "A" }],
        ...(id === "q3" ? { items: [{ type: "tree", id: "q3-tree" }, NESTED] } : {}),
      },
    });
    return {
      askId,
      state: askState,
      document: {
        version: "1.1",
        askId,
        title: "Plan",
        items: [{ type: "area", id: "scope", props: { title: "Scope", items: ids.map(question) } }],
      } as never,
      questions: ids.map((itemId) => ({
        itemId,
        rev: 1,
        state: questionStates[itemId] ?? "open",
        thread: [],
      })),
    };
  };
  const core = fakeCore({
    read: (askId, after) => {
      const outcome = read(askId, after);
      return outcome.kind === "events" ? { ...outcome, state: askState } : outcome;
    },
    lifecycle: view,
    fullValue: (askId, itemId) =>
      itemId === "gone" ? { kind: "deleted", askId, itemId } : { kind: "missing", askId, itemId },
  });
  const append = (events: OutputEvent[], state: typeof askState = "partly-answered") => {
    const group = (log.groups.at(-1) ?? 0) + 1;
    log.events.push(...events);
    log.groups.push(...events.map(() => group));
    askState = state;
    for (const event of events) {
      if (event.type === "postponed") questionStates[event.itemId] = "postponed";
    }
    const [first] = events;
    if (first) core.emit({ type: "appended", askId: A, event: first, events });
  };
  return {
    core,
    append,
    close: () => {
      askState = "closed";
      core.emit({ type: "closed", askId: A, reason: "agent" });
    },
    discard: () => {
      const event: OutputEvent = {
        cursor: at(log.events.length + 1),
        type: "discarded",
        reason: "board-closed",
      };
      log.events.push(event);
      log.groups.push((log.groups.at(-1) ?? 0) + 1);
      askState = "discarded";
      core.emit({ type: "appended", askId: A, event, events: [event] });
      core.emit({ type: "discarded", askId: A, reason: "board-closed" });
    },
    deleteQ3: () => {
      widget = false;
      core.emit({ type: "document", askId: A });
      core.emit({ type: "state", askId: A });
    },
  };
};

const waiting = async (live: ReturnType<typeof lifecycleCore>, itemId = "q2", after = at(0)) => {
  const clock = manualTimers();
  const { client, close } = await connect(depsWith(live.core, clock.timers).deps);
  const result = client.callTool({
    name: "collect",
    arguments: { asks: [{ askId: A, after }], wait: { askId: A, itemId } },
  });
  await Bun.sleep(5);
  return { result, close, clock };
};

type Waited = { outcome?: string; asks: { state: string; events: OutputEvent[] }[] };

describe("waiting for a question", () => {
  test("an item inside a question is an error naming that question", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live, "q3-tree");
    const done = await result;
    expect(done.isError).toBe(true);
    expect(textOf(done)).toContain('"q3-tree" is an item inside the question "q3"');
    expect(live.core.calls).not.toContain("subscribe");
    await close();
  });

  test("an item inside a layout, at any depth, or a layout, is an error naming its question", async () => {
    for (const id of ["q3-tabs", "q3-group", "q3-days"]) {
      const live = lifecycleCore();
      const { result, close } = await waiting(live, id);
      const done = await result;
      expect(done.isError).toBe(true);
      expect(textOf(done)).toContain(`"${id}" is an item inside the question "q3"`);
      expect(live.core.calls).not.toContain("subscribe");
      await close();
    }
  });

  test("an area is an error: a wait names a question", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live, "scope");
    const done = await result;
    expect(done.isError).toBe(true);
    expect(textOf(done)).toContain('"scope" is an area');
    await close();
  });

  test("a deleted question is an error saying it was deleted", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live, "gone");
    const done = await result;
    expect(done.isError).toBe(true);
    expect(textOf(done)).toContain('"gone"');
    expect(textOf(done)).toContain("deleted");
    await close();
  });

  test("returns at once with outcome postponed on a postponed question", async () => {
    const live = lifecycleCore({ questionStates: { q2: "postponed" } });
    const { result, close } = await waiting(live);
    const json = jsonOf(await result) as Waited;
    expect(json.outcome).toBe("postponed");
    expect(json.asks[0]?.events).toEqual([]);
    expect(live.core.calls).not.toContain("subscribe");
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
    await close();
  });

  test("returns at once with outcome closed on a closed ask", async () => {
    const live = lifecycleCore();
    live.close();
    const { result, close } = await waiting(live);
    const json = jsonOf(await result) as Waited;
    expect(json).toMatchObject({ outcome: "closed", asks: [{ state: "closed", events: [] }] });
    expect(live.core.calls).not.toContain("subscribe");
    await close();
  });

  test("a follow-up on the question ends the wait", async () => {
    const live = lifecycleCore();
    const { result, close, clock } = await waiting(live);
    const followUp: OutputEvent = {
      cursor: at(1),
      type: "follow-up",
      itemId: "q2",
      rev: 1,
      who: "Sara Conti",
      when: "2026-10-31T14:07:00Z",
      text: "Why?",
    };
    live.append([followUp], "waiting");
    const json = jsonOf(await result) as Waited;
    expect(json.outcome).toBeUndefined();
    expect(json.asks[0]?.events).toEqual([followUp]);
    expect(clock.pending()).toBe(0);
    expect(live.core.listeners.size).toBe(0);
    await close();
  });

  test("any event of the question in a command ends it, not only the command's first", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live);
    live.append([answer(1, "q1"), answer(2, "q2")], "answered");
    const json = jsonOf(await result) as Waited;
    expect(json.asks[0]?.events.map((event) => event.cursor)).toEqual([at(1), at(2)]);
    await close();
  });

  test("another question's answer that changes the ask's state ends it (AD-4)", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live);
    live.append([answer(1, "q1")], "partly-answered");
    const json = jsonOf(await result) as Waited;
    expect(json.outcome).toBeUndefined();
    expect(json.asks[0]?.state).toBe("partly-answered");
    expect(json.asks[0]?.events.map((event) => event.cursor)).toEqual([at(1)]);
    expect(live.core.listeners.size).toBe(0);
    await close();
  });

  test("another question's answer that leaves the ask's state does not end it; the discard does", async () => {
    const live = lifecycleCore();
    live.append([answer(1, "q1")], "partly-answered");
    const { result, close } = await waiting(live, "q2", at(1));
    live.append([answer(2, "q3")], "partly-answered");
    await Bun.sleep(5);
    expect(live.core.listeners.size).toBe(1);
    live.discard();
    const json = jsonOf(await result) as Waited;
    expect(json.outcome).toBeUndefined();
    expect(json.asks[0]?.state).toBe("discarded");
    expect(json.asks[0]?.events.map((event) => event.type)).toEqual(["answer", "discarded"]);
    await close();
  });

  test("the user postponing the question ends it with outcome postponed", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live);
    live.append([{ cursor: at(1), type: "postponed", itemId: "q2", rev: 1 }]);
    const json = jsonOf(await result) as Waited;
    expect(json.outcome).toBe("postponed");
    expect(json.asks[0]?.events.map((event) => event.type)).toEqual(["postponed"]);
    await close();
  });

  test("the agent closing the ask ends it with outcome closed", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live);
    live.close();
    const json = jsonOf(await result) as Waited;
    expect(json).toMatchObject({ outcome: "closed", asks: [{ state: "closed", events: [] }] });
    await close();
  });

  test("the waited question deleted by the agent ends it", async () => {
    const live = lifecycleCore();
    const { result, close } = await waiting(live, "q3");
    live.deleteQ3();
    const json = jsonOf(await result) as Waited;
    expect(json.outcome).toBeUndefined();
    expect(json.asks[0]?.events).toEqual([]);
    await close();
  });

  test("a result names its versions", async () => {
    const live = lifecycleCore({ questionStates: { q2: "postponed" } });
    const { result, close } = await waiting(live);
    expect(jsonOf(await result)).toMatchObject({ versions: RESULT_VERSIONS, epoch: EPOCH });
    await close();
  });
});
