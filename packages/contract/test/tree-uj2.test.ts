import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { treeAnswer, treeBoardDocument, treeEditedValue } from "../src/fixtures/index.ts";
import {
  type AnswerEvent,
  applyElementChanges,
  type Change,
  elementChanges,
  SCHEMA_IDS,
  TREE_SHAPE,
  type TreeProps,
} from "../src/index.ts";
import {
  validateAgainst,
  validateBoardDocument,
  validateTreeChanges,
  validateTreeProps,
} from "../src/validate.ts";

// The UJ-2 check of design decision 4: the approved example's work breakdown as a plain Tree, and
// its answer's `wbs` operations as the Tree's changes. The examples were copied byte for byte by
// E1's task 3.1; `approved-examples.test.ts` holds the copy to the archive.
const FIXTURES = join(import.meta.dir, "fixtures");
const read = async (path: string): Promise<unknown> => Bun.file(join(FIXTURES, path)).json();

type Json = Record<string, unknown>;
type Node = Json & { readonly children?: readonly Node[] };

// The molecule declares its fields; a plain Tree declares them as columns.
const COLUMNS = [
  { field: "optimistic", label: "Optimistic", type: "number" },
  { field: "mostLikely", label: "Most likely", type: "number" },
  { field: "pessimistic", label: "Pessimistic", type: "number" },
] as const;
const KEPT = new Set(["id", "label", "children", ...COLUMNS.map(({ field }) => field)]);

// The nodes without the keys a plain Tree does not hold, and those keys.
const stripped = (nodes: readonly Node[], dropped: Set<string>): Node[] =>
  nodes.map((node) => {
    const kept = Object.entries(node).filter(([key]) => KEPT.has(key) || !dropped.add(key));
    const copy: Json = Object.fromEntries(kept);
    if (node.children !== undefined) copy.children = stripped(node.children, dropped);
    return copy;
  });

const ask = (await read("asks/uj2-wbs-gantt.json")) as {
  askId: string;
  title: string;
  items: { id: string; props: { text: string; header: string; items: Json[] } }[];
};
const plan = ask.items.find(({ id }) => id === "plan");
const molecule = plan?.props.items.find(({ id }) => id === "wbs") as {
  props: { molecule: string; data: { nodes: Node[] } };
};
const dropped = new Set<string>();
// The example is JSON: the validators below check that it is a Tree.
const nodes = stripped(molecule.props.data.nodes, dropped);
const sent = { columns: COLUMNS, nodes } as unknown as TreeProps;

const answers = (await read("answers/uj2-wbs-gantt.json")) as { asks: { events: Json[] }[] };
const event = answers.asks[0]?.events.find(({ type }) => type === "answer") as AnswerEvent;
const approved = event.changes ?? [];
const wbs = approved.filter(({ target }) => target.startsWith("wbs."));

// Operations compared as a set: each as JSON with its keys sorted, at every level.
const canonical = (change: unknown): string =>
  JSON.stringify(change, (_, value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
const asSet = (changes: readonly Change[]) => changes.map(canonical).sort();

describe("the approved UJ-2 example as a Tree (design decision 4)", () => {
  test("its wbs is the molecule's work breakdown, eight nodes under two packages", () => {
    expect(molecule.props.molecule).toBe("wbs-pert");
    const ids = (nodes: readonly Node[]): unknown[] =>
      nodes.flatMap((node) => [node.id, ...ids(node.children ?? [])]);
    expect(ids(sent.nodes)).toEqual([
      "design",
      "ux",
      "architecture",
      "prototype",
      "build",
      "portal",
      "billing",
      "reporting",
    ]);
  });

  test("its nodes without excerpt, the only key stripped, validate with three number columns", () => {
    expect([...dropped]).toEqual(["excerpt"]);
    expect(validateTreeProps(sent, "agent")).toEqual({ ok: true, value: sent });
  });

  test("every wbs operation of the answer validates as Tree changes", () => {
    expect(wbs).toHaveLength(7);
    expect(approved.filter((change) => !wbs.includes(change))).toEqual([
      { op: "set", target: "schedule.u-1.dependencies", value: ["architecture", "prototype"] },
    ]);
    expect(validateTreeChanges("wbs", wbs, sent)).toEqual({ ok: true, value: wbs });
  });

  test("the diff of the sent and the edited nodes gives those operations, as a set", () => {
    const edited = applyElementChanges("wbs", sent, wbs, TREE_SHAPE);
    expect(validateTreeProps(edited, "edited").ok).toBe(true);
    const diff = elementChanges("wbs", sent, edited, TREE_SHAPE);
    expect(asSet(diff)).toEqual(asSet(wbs));
    expect(diff).toHaveLength(wbs.length);
  });
});

describe("the Tree fixtures (spec, Tree fixtures)", () => {
  const [question] = treeBoardDocument.items;
  const [tree] = question.props.items;

  test("the board document holds the UJ-2 plan as one question with one Tree and no options", () => {
    expect(treeBoardDocument).toMatchObject({ askId: ask.askId, title: ask.title });
    expect(question).toMatchObject({ type: "question", id: "plan", rev: 1 });
    expect(question.props).toEqual({
      text: plan?.props.text as string,
      header: plan?.props.header as string,
      items: [{ type: "tree", id: "wbs", props: sent }],
    });
    expect(tree).toEqual({ type: "tree", id: "wbs", props: sent });
  });

  test("E1's board document refuses it: no Tree reaches the board page yet", () => {
    expect(validateBoardDocument(treeBoardDocument)).toMatchObject({ ok: false, reason: "schema" });
  });

  test("the Tree and its edited value validate", () => {
    expect(validateTreeProps(tree.props, "agent").ok).toBe(true);
    expect(validateTreeProps(treeEditedValue, "edited")).toEqual({
      ok: true,
      value: treeEditedValue,
    });
    expect(validateTreeProps(treeEditedValue, "agent").ok).toBe(false);
  });

  test("the edited value is the Tree after the approved answer's edits", () => {
    expect(applyElementChanges("wbs", tree.props, wbs, TREE_SHAPE)).toEqual(treeEditedValue);
  });

  test("the answer validates as an answer event, and its changes as Tree changes", () => {
    expect(validateAgainst(SCHEMA_IDS.answerEvent, treeAnswer)).toEqual({
      ok: true,
      value: treeAnswer,
    });
    expect(validateTreeChanges("wbs", treeAnswer.changes, tree.props).ok).toBe(true);
  });

  test("the answer is the approved one, without the Gantt operation and derived", () => {
    const { changes: _, derived, ...rest } = event;
    expect(derived).toBeDefined();
    expect(treeAnswer).toEqual({ ...rest, changes: treeAnswer.changes });
    expect("derived" in treeAnswer).toBe(false);
    expect(asSet(treeAnswer.changes ?? [])).toEqual(asSet(wbs));
  });

  test("the diff of the Tree and its edited value gives exactly the answer's changes", () => {
    expect(elementChanges("wbs", tree.props, treeEditedValue, TREE_SHAPE)).toEqual(
      treeAnswer.changes ?? [],
    );
  });
});
