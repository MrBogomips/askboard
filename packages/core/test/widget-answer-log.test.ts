import { describe, expect, test } from "bun:test";
import { uj2ExpandedDerived, uj2ExpandedEditedValues } from "@askboard/contract/fixtures";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, logOf, WHEN } from "./lifecycle-fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";

// Core spec: Widget answers stored in full, Changes computed by the core, Derived values in an
// answer (widget-answers design decision 6, step 3, and the fold): the event carries the changes
// and derived values in reference addressing, the full values stay apart from the log.

const ASK_ID = uj2Ask.askId;
const TREE = "wbs__tree";
const PLAN = "schedule__plan";
type Json = Record<string, unknown>;
type Act = Parameters<AskCore["act"]>[1];

const approved = (
  (await Bun.file(
    new URL("../../contract/test/fixtures/answers/uj2-wbs-gantt.json", import.meta.url),
  ).json()) as { asks: { events: Json[] }[] }
).asks[0]?.events[0] as Json;

const setup = async () => {
  const core = new AskCore({
    ...fakePorts().ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
  });
  const outcome = await core.ask(copyOf(uj2Ask) as unknown as Parameters<AskCore["ask"]>[0]);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  return core;
};

let n = 100;
const send = (core: AskCore, fields: Json) => {
  n += 1;
  const act = { type: "answer", itemId: "plan", rev: 1, when: WHEN, ...fields };
  return core.act(ASK_ID, { actionId: actionId(n), acts: [act] } as unknown as Act);
};

const sentProps = (core: AskCore, id: string): Json => {
  const [question] = core.board(ASK_ID)?.document.items ?? [];
  const items = (question as unknown as { props: { items: { id: string; props: Json }[] } }).props
    .items;
  return copyOf(items.find((item) => item.id === id)?.props) as Json;
};

type Node = { id: string; label?: string; children?: Node[] };
const rename = (nodes: Node[], id: string, label: string): void => {
  for (const node of nodes) {
    if (node.id === id) node.label = label;
    if (node.children !== undefined) rename(node.children, id, label);
  }
};
const treeWith = (core: AskCore, renames: Record<string, string>): Json => {
  const tree = sentProps(core, TREE) as { nodes: Node[] };
  for (const [id, label] of Object.entries(renames)) rename(tree.nodes, id, label);
  return tree;
};

const lastEvent = (core: AskCore) => logOf(core, ASK_ID).at(-1) as unknown as Json;
const setOf = (changes: unknown) => new Set((changes as unknown[]).map((c) => JSON.stringify(c)));

describe("the logged widget answer", () => {
  test("the approved edits give the approved eight changes and fourteen derived values", async () => {
    const core = await setup();
    const values = copyOf(uj2ExpandedEditedValues);
    const derived = copyOf(uj2ExpandedDerived);
    expect(send(core, { values, derived }).ok).toBe(true);
    const event = lastEvent(core);
    expect(event.changes).toHaveLength(8);
    expect(setOf(event.changes)).toEqual(setOf(approved.changes));
    expect(event.derived).toEqual(approved.derived);
    expect(Object.keys(event.derived as Json)).toHaveLength(14);
    expect(JSON.stringify(event)).not.toContain("__");
    expect(event).not.toHaveProperty("values");
    expect(event).not.toHaveProperty("tooLarge");
  });

  test("a revision is diffed against the revision it names, not the answer it replaces", async () => {
    const core = await setup();
    const both = { ux: "UX research", portal: "Portal accounts" };
    send(core, { values: { [TREE]: treeWith(core, both) } });
    const first = lastEvent(core);
    const again = send(core, { values: { [TREE]: treeWith(core, { portal: "Portal accounts" }) } });
    expect(again.ok).toBe(true);
    const second = lastEvent(core);
    expect(second.replaces).toBe(first.cursor);
    expect(second.changes).toEqual([
      { op: "set", target: "wbs.portal.label", value: "Portal accounts" },
    ]);
  });

  test("an edit of the Tree's columns, which no operation expresses, is refused", async () => {
    const core = await setup();
    const tree = treeWith(core, { ux: "UX research" }) as { columns: { id: string }[] };
    tree.columns = tree.columns.slice(1);
    const outcome = send(core, { values: { [TREE]: tree } });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).toContain(TREE);
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test("derived values beside no widget change are logged without changes", async () => {
    const core = await setup();
    const plan = sentProps(core, PLAN) as { workPackages: string };
    const sent = { values: { [PLAN]: plan }, derived: { [`${PLAN}.finish`]: "2026-12-02" } };
    expect(send(core, sent).ok).toBe(false);
  });
});

describe("the full values kept apart from the log", () => {
  test("keptAnswerValues holds the edited values by reference ID, new on each read", async () => {
    const core = await setup();
    send(core, { values: copyOf(uj2ExpandedEditedValues), derived: {} });
    const cursor = lastEvent(core).cursor as string;
    const kept = core.keptAnswerValues(ASK_ID);
    expect([...(kept?.keys() ?? [])]).toEqual([cursor]);
    const values = kept?.get(cursor) as Json;
    expect(Object.keys(values)).toEqual(["wbs", "schedule"]);
    expect(values.schedule).toMatchObject({ workPackages: "wbs" });
    expect(JSON.stringify(kept)).not.toContain("__");
    (values.wbs as Json).nodes = [];
    const again = core.keptAnswerValues(ASK_ID)?.get(cursor) as Json;
    expect(again).not.toBe(values);
    expect((again.wbs as { nodes: unknown[] }).nodes.length).toBeGreaterThan(0);
  });

  test("an answer with choices only keeps none, and an unknown ask holds undefined", async () => {
    const core = await setup();
    expect(core.keptAnswerValues(ASK_ID)?.size).toBe(0);
    expect(core.keptAnswerValues("no-such-ask")).toBeUndefined();
  });

  test("a discarded ask keeps none", async () => {
    const core = await setup();
    send(core, { values: copyOf(uj2ExpandedEditedValues) });
    core.discardAll("session-exit");
    expect(core.keptAnswerValues(ASK_ID)?.size).toBe(0);
  });

  test("the logged event never changes afterwards", async () => {
    const core = await setup();
    send(core, { values: { [TREE]: treeWith(core, { ux: "UX research" }) } });
    const first = lastEvent(core);
    const text = JSON.stringify(first);
    send(core, { values: { [TREE]: treeWith(core, { ux: "UX study" }) } });
    expect(JSON.stringify(logOf(core, ASK_ID)[0])).toBe(text);
    expect(Object.isFrozen(logOf(core, ASK_ID)[0])).toBe(true);
  });
});
