import { describe, expect, test } from "bun:test";
import { ANSWER_EVENT_MAX_CHARS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, logOf, WHEN } from "./lifecycle-fakes.ts";

// Core spec: Answers too large for one result (widget-answers design decision 6, the too-large
// rule): the event is serialized as `collect` returns it; over `ANSWER_EVENT_MAX_CHARS` it is
// logged without `changes` and `derived` and with `tooLarge: true`, the full values still held.

const ASK_ID = "big-tree-q7k2";
const TREE = "big";
const NODES = 500;
type Json = Record<string, unknown>;
type Node = { id: string; label: string };
type Act = Parameters<AskCore["act"]>[1];

const sentNodes = (): Node[] =>
  Array.from({ length: NODES }, (_, at) => ({ id: `n${at}`, label: `Node ${at}` }));

const setup = async () => {
  const core = new AskCore(fakePorts().ports);
  const items = [{ type: "tree", id: TREE, props: { nodes: sentNodes() } }];
  const request = {
    askId: ASK_ID,
    items: [{ type: "question", id: "q", props: { text: "Rename the nodes", items } }],
  };
  const outcome = await core.ask(request as unknown as Parameters<AskCore["ask"]>[0]);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  return core;
};

let n = 0;
// Renames the first `count` nodes and answers; returns the logged event.
const renamed = async (count: number) => {
  const core = await setup();
  const nodes = sentNodes().map((node, at) =>
    at < count ? { ...node, label: `Renamed node number ${at}` } : node,
  );
  n += 1;
  const act = { type: "answer", itemId: "q", rev: 1, when: WHEN, values: { [TREE]: { nodes } } };
  const outcome = core.act(ASK_ID, { actionId: actionId(n), acts: [act] } as unknown as Act);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome));
  return { core, event: logOf(core, ASK_ID).at(-1) as unknown as Json };
};

describe("the too-large rule", () => {
  test("every node of a 500-node Tree renamed logs a tooLarge event the schema accepts", async () => {
    const { core, event } = await renamed(NODES);
    expect(event.tooLarge).toBe(true);
    expect(event).not.toHaveProperty("changes");
    expect(event).not.toHaveProperty("derived");
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect(JSON.stringify(event).length).toBeLessThan(ANSWER_EVENT_MAX_CHARS);
    const [values = {}] = core.keptAnswerValues(ASK_ID)?.values() ?? [];
    const kept = values[TREE] as { nodes: Node[] } | undefined;
    expect(kept?.nodes[499]?.label).toBe("Renamed node number 499");
  });

  test("an event just under the limit keeps its changes", async () => {
    // The most nodes whose event stays within the limit, found by bisection.
    let [low, high] = [1, NODES];
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const { event } = await renamed(middle);
      if (event.tooLarge === true) high = middle - 1;
      else low = middle;
    }
    const { event } = await renamed(low);
    expect(event.tooLarge).toBeUndefined();
    expect(event.changes).toHaveLength(low);
    expect(JSON.stringify(event).length).toBeLessThanOrEqual(ANSWER_EVENT_MAX_CHARS);
    const over = await renamed(low + 1);
    expect(over.event.tooLarge).toBe(true);
  });
});
