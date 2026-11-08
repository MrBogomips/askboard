import { describe, expect, test } from "bun:test";
import { uj2ExpandedEditedValues, uj2ExpandedQuestion } from "@askboard/contract/fixtures";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, WHEN } from "./lifecycle-fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";

// Core spec: Changing an item inside a question (widget-answers design decision 5): add and change
// with widgets, with a fake `MoleculeSource` over the two shipped definitions.

const ASK_ID = uj2Ask.askId;
type Json = Record<string, unknown>;
type Request = Parameters<AskCore["ask"]>[0];
type Update = Parameters<AskCore["update"]>[0];
type Heard = Parameters<Parameters<AskCore["subscribe"]>[0]>[0];

const setup = async (request: Request = copyOf(uj2Ask) as unknown as Request) => {
  const fakes = fakePorts();
  const core = new AskCore({
    ...fakes.ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
  });
  const outcome = await core.ask(request);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  const heard: Heard[] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard };
};

const change = (core: AskCore, itemId: string, props: Json, askId = ASK_ID) =>
  core.update({ askId, actions: [{ action: "change", itemId, props }] } as unknown as Update);

const documents = (heard: readonly Heard[]) => heard.filter(({ type }) => type === "document");

const planOf = (core: AskCore, askId = ASK_ID) => {
  const [plan] = core.board(askId)?.document.items ?? [];
  return plan as unknown as { rev: number; props: { items: { id: string; props: Json }[] } };
};

// The data of the UJ-2 reference at `index` among its question's items, a copy.
const dataOf = (index: number): Json => {
  const reference = uj2Ask.items[0]?.props.items?.[index] as { props: { data: Json } };
  return copyOf(reference.props.data);
};

const scheduleData = () => ({
  ...dataOf(1),
  start: "2026-12-01",
});

describe("changing a reference", () => {
  test("new data expands again, raises the rev and publishes the board once", async () => {
    const { core, heard } = await setup();
    const outcome = await change(core, "schedule", { data: scheduleData() });
    expect(outcome).toMatchObject({
      kind: "updated",
      applied: [{ action: "change", itemId: "schedule", rev: 2 }],
    });
    const plan = planOf(core);
    expect(plan.rev).toBe(2);
    expect(plan.props.items.map(({ id }) => id)).toEqual(["wbs__tree", "schedule__plan"]);
    expect(plan.props.items[1]?.props.start).toBe("2026-12-01");
    expect(plan.props.items[0]).toEqual(uj2ExpandedQuestion.props.items?.[0] as never);
    expect(documents(heard)).toHaveLength(1);
  });

  test("a second change merges into the first, and the reference stays fetchable", async () => {
    const { core } = await setup();
    await change(core, "wbs", { data: dataOf(0) });
    await change(core, "schedule", { data: scheduleData() });
    const second = await change(core, "schedule", { molecule: "gantt-plan" });
    expect(second).toMatchObject({ kind: "updated", applied: [{ rev: 4 }] });
    expect(planOf(core).props.items[1]?.props.start).toBe("2026-12-01");
    expect(JSON.stringify(core.fullValue(ASK_ID, "schedule"))).toContain("2026-12-01");
  });

  test("a change that does not expand is refused naming the reference and changes nothing", async () => {
    const { core, heard } = await setup();
    const before = JSON.stringify(core.board(ASK_ID));
    const data = dataOf(0) as { nodes: Json[] };
    delete data.nodes[0]?.label;
    const outcome = await change(core, "wbs", { data });
    expect(outcome).toMatchObject({ kind: "refused", index: 0, itemId: "wbs", refusal: "props" });
    expect(JSON.stringify(outcome)).toContain("wbs");
    expect(JSON.stringify(core.board(ASK_ID))).toBe(before);
    expect(planOf(core).rev).toBe(1);
    expect(documents(heard)).toEqual([]);
    expect(JSON.stringify(core.fullValue(ASK_ID, "wbs"))).toContain('"wbs"');
  });

  test("an expanded ID is an unknown item", async () => {
    const { core } = await setup();
    const outcome = await change(core, "wbs__tree", { openDepth: 1 });
    expect(outcome).toMatchObject({ kind: "refused", refusal: "unknown-item" });
  });

  test("an answered question is refused naming its answer, and the map stays", async () => {
    const { core } = await setup();
    const answered = core.act(ASK_ID, {
      actionId: actionId(1),
      acts: [
        {
          type: "answer",
          itemId: "plan",
          rev: 1,
          when: WHEN,
          values: copyOf(uj2ExpandedEditedValues),
        },
      ],
    } as never);
    expect(answered.ok).toBe(true);
    const outcome = await change(core, "schedule", { data: scheduleData() });
    expect(outcome).toMatchObject({ kind: "refused", refusal: "answered", itemId: "schedule" });
    expect(JSON.stringify(outcome)).toContain("answered at");
    expect(planOf(core).rev).toBe(1);
  });
});

describe("changing a plain widget item", () => {
  const treeAsk = (): Request => {
    const tree = uj2ExpandedQuestion.props.items?.[0];
    return {
      askId: "plain-tree",
      items: [
        {
          type: "question",
          id: "plan",
          props: { text: "Estimate the WBS?", items: [{ ...tree, id: "tree" }] },
        },
      ],
    } as unknown as Request;
  };

  test("props merge key by key and the question's rev rises", async () => {
    const { core } = await setup(treeAsk());
    const outcome = await change(core, "tree", { openDepth: 1 }, "plain-tree");
    expect(outcome).toMatchObject({ kind: "updated", applied: [{ itemId: "tree", rev: 2 }] });
    const item = planOf(core, "plain-tree").props.items[0];
    expect(item?.props.openDepth).toBe(1);
    expect(Object.keys(item?.props ?? {})).toEqual(["columns", "nodes", "pert", "openDepth"]);
  });

  test("props the widget refuses leave the ask unchanged", async () => {
    const { core, heard } = await setup(treeAsk());
    const outcome = await change(core, "tree", { nodes: [{ id: "x" }] }, "plain-tree");
    expect(outcome).toMatchObject({ kind: "refused", refusal: "props", itemId: "tree" });
    expect(planOf(core, "plain-tree").rev).toBe(1);
    expect(documents(heard)).toEqual([]);
  });
});

describe("adding a question with references", () => {
  const added = () => ({
    type: "question",
    id: "again",
    props: {
      text: "Estimate once more?",
      items: [{ type: "molecule", id: "wbs2", props: uj2Ask.items[0]?.props.items?.[0]?.props }],
    },
  });

  test("the references expand, join the map and are fetched under their own IDs", async () => {
    const { core, heard } = await setup();
    const outcome = await core.update({
      askId: ASK_ID,
      actions: [{ action: "add", item: added() }],
    } as unknown as Update);
    expect(outcome).toMatchObject({ kind: "updated", applied: [{ itemId: "again", rev: 1 }] });
    const text = JSON.stringify(core.board(ASK_ID)?.document);
    expect(text).toContain("wbs2__tree");
    expect(text).not.toContain('"molecule"');
    expect(documents(heard)).toHaveLength(1);
    expect(JSON.stringify(core.fullValue(ASK_ID, "wbs2"))).toContain('"wbs2"');
  });

  test("an unknown molecule refuses the update and adds nothing", async () => {
    const { core } = await setup();
    const item = copyOf(added());
    (item.props.items[0]?.props as { molecule: string }).molecule = "org-chart";
    const outcome = await core.update({
      askId: ASK_ID,
      actions: [{ action: "add", item }],
    } as unknown as Update);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "props", itemId: "wbs2" });
    expect(core.board(ASK_ID)?.document.items).toHaveLength(2);
  });

  test("an ID another widget holds is refused", async () => {
    const { core } = await setup();
    const item = copyOf(added());
    (item.props.items[0] as { id: string }).id = "wbs";
    const outcome = await core.update({
      askId: ASK_ID,
      actions: [{ action: "add", item }],
    } as unknown as Update);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "props", itemId: "wbs" });
  });

  test("a formula error in the board as changed is a warning on the result", async () => {
    const { core } = await setup();
    const data = {
      ...dataOf(1),
      dependencies: { billing: ["review"] },
    };
    const outcome = await change(core, "schedule", { data });
    const warnings = outcome.kind === "updated" ? (outcome.warnings ?? []) : [];
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: "formula", itemId: "schedule" });
    expect(JSON.stringify(warnings)).not.toContain("schedule__plan");
  });
});

// Item IDs unique across the ask on update (layouts, task 2.4, review X-1): a molecule reference's
// ID is held by the question that sent it, whether or not the reference's question is still there.
describe("a molecule reference's ID on update", () => {
  const tree = () => ({ ...uj2ExpandedQuestion.props.items?.[0] });
  const plainQuestion = (id: string, itemId: string) => ({
    type: "question",
    id,
    props: { text: "A plain Tree?", items: [{ ...tree(), id: itemId }] },
  });
  const send = (core: AskCore, actions: unknown[]) =>
    core.update({ askId: ASK_ID, actions } as unknown as Update);

  test("adding a question with a plain item named like a reference is refused", async () => {
    const { core, heard } = await setup();
    const before = documents(heard).length;
    const outcome = await send(core, [{ action: "add", item: plainQuestion("q2", "wbs") }]);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "in-use", itemId: "wbs" });
    expect(core.board(ASK_ID)?.document.items).toHaveLength(2);
    expect(documents(heard)).toHaveLength(before);
  });

  test("changing another question to hold the reference's ID is refused", async () => {
    const { core } = await setup();
    const added = await send(core, [{ action: "add", item: plainQuestion("q2", "tree-two") }]);
    expect(added).toMatchObject({ kind: "updated" });
    const outcome = await send(core, [
      { action: "change", itemId: "q2", props: { items: [{ ...tree(), id: "schedule" }] } },
    ]);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "in-use", itemId: "schedule" });
  });

  test("the ID stays refused after the reference's question is deleted", async () => {
    const { core } = await setup();
    const deleted = await send(core, [{ action: "delete", itemId: "plan" }]);
    expect(deleted).toMatchObject({ kind: "updated" });
    const outcome = await send(core, [{ action: "add", item: plainQuestion("q3", "wbs") }]);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "in-use", itemId: "wbs" });
  });

  test("an in-use refusal caused by an expanded ID names the reference's ID", async () => {
    const { core } = await setup();
    const outcome = await send(core, [{ action: "add", item: plainQuestion("q4", "wbs__tree") }]);
    if (outcome.kind !== "refused") throw new Error(outcome.kind);
    expect(outcome).toMatchObject({ refusal: "in-use", itemId: "wbs" });
    expect(JSON.stringify(outcome)).not.toContain("wbs__tree");
    expect(outcome.detail).toContain('held by the molecule reference "wbs" of the question "plan"');
    const added = await send(core, [{ action: "add", item: plainQuestion("q5", "tree-five") }]);
    expect(added).toMatchObject({ kind: "updated" });
    const changed = await send(core, [
      { action: "change", itemId: "q5", props: { items: [{ ...tree(), id: "schedule__plan" }] } },
    ]);
    if (changed.kind !== "refused") throw new Error(changed.kind);
    expect(changed).toMatchObject({ refusal: "in-use", itemId: "schedule" });
    expect(JSON.stringify(changed)).not.toContain("schedule__plan");
  });

  test("the question holding the references still changes", async () => {
    const { core } = await setup();
    const outcome = await change(core, "wbs", { data: dataOf(0) });
    expect(outcome).toMatchObject({ kind: "updated" });
    const plan = await send(core, [
      { action: "change", itemId: "plan", props: { text: "Again?" } },
    ]);
    expect(plan).toMatchObject({ kind: "updated" });
  });

  test("the question holding a reference may not replace it with a plain item of its ID, and stays changeable", async () => {
    const { core } = await setup();
    const before = JSON.stringify(core.board(ASK_ID));
    const outcome = await send(core, [
      { action: "change", itemId: "plan", props: { items: [{ ...tree(), id: "wbs" }] } },
    ]);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "in-use", itemId: "wbs" });
    expect(JSON.stringify(core.board(ASK_ID))).toBe(before);
    const again = await send(core, [
      { action: "change", itemId: "plan", props: { text: "Again?" } },
    ]);
    expect(again).toMatchObject({ kind: "updated" });
    const reference = await change(core, "wbs", { data: dataOf(0) });
    expect(reference).toMatchObject({ kind: "updated" });
  });
});
