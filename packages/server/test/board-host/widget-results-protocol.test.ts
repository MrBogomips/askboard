import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { BOARD_CLOSE_CODES, BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { probeBoardState, UJ2_SESSION, uj2WidgetWaitingState } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { LifecycleBoardView, MoleculeSource } from "@askboard/core";
import { stateOf } from "../../src/board-host/messages.ts";
import { freeRange, openSocket, removeViews, startHost } from "./helpers.ts";

// Board-host spec, Widget results in acts and the draft mirror (widget-registry, task 3.5): an act
// whose results name a Tree is refused like any act ask-core refuses, and a draft record's results
// come back unchanged to a page that takes the ask over, over the UJ-2 ask with the shipped
// molecules.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = UJ2_SESSION;
const uj2 = await Bun.file(
  join(import.meta.dir, "../../../contract/test/fixtures/asks/uj2-wbs-gantt.json"),
).json();

afterAll(removeViews);

// The shipped definitions, read by path: board-host may not import the molecule-source unit.
const SHIPPED = join(import.meta.dir, "../../../molecules/src");
const definitions = await Promise.all(
  ["wbs-pert/wbs-pert.json", "gantt-plan/gantt-plan.json"].map((file) =>
    Bun.file(join(SHIPPED, file)).json(),
  ),
);
const molecules: MoleculeSource = {
  lookup: (molecule) => {
    const definition = definitions.find((found) => found.molecule === molecule);
    return definition === undefined
      ? { found: false, reason: "unknown-molecule", shipped: [] }
      : { found: true, definition };
  },
};

// The transcript's board holds the question `plan` alone, as the fixture's board document does.
const planAsk = () => {
  const { delivery: _, items, ...rest } = structuredClone(uj2);
  return { ...rest, items: items.filter((item: { id: string }) => item.id === "plan") };
};

const WHEN = "2026-11-06T09:30:00Z";
const TREE = "wbs__tree";

const started = async () => {
  const fixture = startHost({ ports: await freeRange(1), tokens: [token], molecules });
  const { port } = await fixture.ask(undefined, planAsk());
  const open = async () => {
    const socket = await openSocket(port, askId);
    socket.send({ version, type: "connect", token });
    return socket;
  };
  return { fixture, open };
};

describe("widget results over the board protocol", () => {
  test("an answer act with results for a Tree is refused, then the state with the question open", async () => {
    const { fixture, open } = await started();
    try {
      const tab = await open();
      await tab.next();
      await tab.next();
      const actionId = "rT7kQ2mPz9XtLw4nB8cYhA";
      tab.send({
        version,
        type: "act",
        actionId,
        acts: [
          { type: "answer", itemId: "plan", rev: 1, results: { [TREE]: { x: 1 } }, when: WHEN },
        ],
      });
      const refused = (await tab.next()) as Record<string, unknown>;
      expect(validateBoardMessage("toPage", refused).ok).toBe(true);
      expect(refused).toMatchObject({ type: "refused", reason: "act", actionId, index: 0 });
      expect(String(refused.detail)).toContain("a Tree gives no result");
      expect(await tab.next()).toEqual(uj2WidgetWaitingState);
      const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
      expect(read.kind === "events" && read.events).toEqual([]);
      tab.socket.terminate();
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });

  test("a mirrored draft record with results comes back unchanged to a page that takes over", async () => {
    const { fixture, open } = await started();
    try {
      const record = {
        delivery: "submitted",
        inView: "plan",
        questions: {
          plan: { rev: 1, results: { [TREE]: { pick: "a", nested: [1, { two: 2 }] } } },
        },
      };
      const first = await open();
      await first.next();
      await first.next();
      first.send({ version, type: "draft", record });
      const second = await open();
      expect(await first.next()).toEqual({ version, type: "moved" });
      first.send({ version, type: "draft", record });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(((await second.next()) as { type: string }).type).toBe("board");
      expect(((await second.next()) as { type: string }).type).toBe("state");
      const restored = (await second.next()) as { type: string; record: unknown };
      expect(restored.type).toBe("draft");
      expect(restored.record).toEqual(record);
      expect(validateBoardMessage("toPage", restored).ok).toBe(true);
      second.socket.terminate();
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });

  test("the state a board is told holds each answer's results by item ID, previous answers too", () => {
    const [question] = probeBoardState.state.questions;
    const results = question?.answer.results as Record<string, unknown>;
    const answer = {
      who: "Sara Conti",
      when: question?.answer.when as string,
      delivered: false,
      results,
    };
    const board = {
      askId: "pick-one-t3m9",
      state: "answered",
      document: {},
      questions: [
        { itemId: "choose", rev: 1, state: "answered", answer, previous: answer, thread: [] },
      ],
    } as unknown as Extract<LifecycleBoardView, { document: unknown }>;
    const [told] = stateOf(board).questions as unknown as {
      answer: { results: unknown };
      previous: { results: unknown };
    }[];
    expect(told?.answer.results).toEqual(results);
    expect(told?.previous.results).toEqual(results);
    expect(told?.answer.results).not.toBe(results);
  });
});
