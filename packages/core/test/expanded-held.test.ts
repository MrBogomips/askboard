import { describe, expect, test } from "bun:test";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsData, wbsPert } from "./molecules.ts";

// Core spec: Expanded IDs are held against items (agent-facing-gaps review 3.3, X-1): every ID a
// molecule reference of the ask has expanded to is held against the items an `add` or a `change`
// sends, for the ask's life, so one ID never has two owners and `fetch` reads one.

type Request = Parameters<AskCore["ask"]>[0];
type Update = Parameters<AskCore["update"]>[0];

const { askId } = uj2Ask;

const withMolecules = async () => {
  const core = new AskCore({
    ...fakePorts().ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
  });
  expect((await core.ask(copyOf(uj2Ask) as unknown as Request)).kind).toBe("created");
  return core;
};

const send = (core: AskCore, actions: unknown[]) =>
  core.update({ askId, actions } as unknown as Update);

const plainQuestion = (id: string, itemId: string) => ({
  type: "question",
  id,
  props: { text: "A toggle?", items: [{ type: "toggle", id: itemId, props: { label: "Ok" } }] },
});

const [plan] = uj2Ask.items;
const planItems = () => (plan?.props.items ?? []) as readonly { readonly id: string }[];

describe("an expanded ID is held against items for the ask's life", () => {
  test("a plain item named like the expanded ID of a dropped reference is refused, naming it", async () => {
    const core = await withMolecules();
    const dropped = await send(core, [
      {
        action: "change",
        itemId: "plan",
        props: { items: copyOf(planItems().filter((item) => item.id !== "schedule")) },
      },
    ]);
    expect(dropped.kind).toBe("updated");
    const before = core.lifecycleBoard(askId);
    const outcome = await send(core, [
      { action: "add", item: plainQuestion("q2", "schedule__plan") },
    ]);
    if (outcome.kind !== "refused") throw new Error(outcome.kind);
    expect(outcome).toMatchObject({ refusal: "in-use", itemId: "schedule__plan" });
    expect(outcome.detail).toContain('"schedule__plan"');
    expect(core.lifecycleBoard(askId)).toEqual(before);
    // The refusal leaves one owner: the ID is no item, so fetch reads neither as an item or deleted.
    expect(core.fullValue(askId, "schedule").kind).toBe("missing");
    expect(core.fullValue(askId, "schedule__plan").kind).toBe("missing");
  });

  test("a change that gives a question such an item is refused too", async () => {
    const core = await withMolecules();
    await send(core, [
      {
        action: "change",
        itemId: "plan",
        props: { items: copyOf(planItems().filter((item) => item.id !== "schedule")) },
      },
    ]);
    await send(core, [{ action: "add", item: plainQuestion("q2", "tog") }]);
    const outcome = await send(core, [
      {
        action: "change",
        itemId: "q2",
        props: { items: [{ type: "toggle", id: "schedule__plan", props: { label: "Ok" } }] },
      },
    ]);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "in-use", itemId: "schedule__plan" });
  });

  test("a reference that would expand to a deleted plain ID is refused, naming it", async () => {
    const second = new AskCore({
      ...fakePorts().ports,
      molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
    });
    const first = {
      askId: "plain-first",
      items: [plainQuestion("qa", "wbs__tree"), plainQuestion("qb", "other")],
    } as unknown as Request;
    expect((await second.ask(first)).kind).toBe("created");
    const deleted = await second.update({
      askId: "plain-first",
      actions: [{ action: "delete", itemId: "qa" }],
    } as unknown as Update);
    expect(deleted.kind).toBe("updated");
    expect(second.fullValue("plain-first", "wbs__tree").kind).toBe("deleted");
    const [reference] = planItems().filter((item) => item.id === "wbs");
    const outcome = await second.update({
      askId: "plain-first",
      actions: [
        {
          action: "add",
          item: {
            type: "question",
            id: "qc",
            props: { text: "WBS?", items: [copyOf(reference)] },
          },
        },
      ],
    } as unknown as Update);
    if (outcome.kind !== "refused") throw new Error(outcome.kind);
    expect(outcome).toMatchObject({ refusal: "in-use", itemId: "wbs__tree" });
    // The refusal names the reference the agent must rename, and the expanded ID it takes (S-1).
    expect(outcome.detail).toContain('"wbs"');
    expect(outcome.detail).toContain('"wbs__tree"');
    expect(second.fullValue("plain-first", "wbs__tree").kind).toBe("deleted");
    expect(second.fullValue("plain-first", "wbs").kind).toBe("missing");
  });

  test("a live reference's own question still changes and keeps its expansion", async () => {
    const core = await withMolecules();
    const outcome = await send(core, [
      { action: "change", itemId: "plan", props: { text: "The plan, again?" } },
    ]);
    expect(outcome.kind).toBe("updated");
    const resent = await send(core, [
      { action: "change", itemId: "plan", props: { items: copyOf(planItems()) } },
    ]);
    expect(resent.kind).toBe("updated");
    expect(core.fullValue(askId, "wbs").kind).toBe("item");
  });

  test("a reference that changes molecule keeps its old expanded ID held", async () => {
    const core = await withMolecules();
    const switched = await send(core, [
      {
        action: "change",
        itemId: "schedule",
        props: { molecule: "wbs-pert", data: copyOf(wbsData) },
      },
    ]);
    expect(switched.kind).toBe("updated");
    const before = core.lifecycleBoard(askId);
    const outcome = await send(core, [
      { action: "add", item: plainQuestion("q2", "schedule__plan") },
    ]);
    expect(outcome).toMatchObject({ kind: "refused", refusal: "in-use", itemId: "schedule__plan" });
    expect(core.lifecycleBoard(askId)).toEqual(before);
  });
});

// Review 3.5, X-1: a layout's own `change` brings items in as a question's `items` does.
describe("a layout change cannot give a plain item a held expanded ID", () => {
  const toggle = (id: string) => ({ type: "toggle", id, props: { label: "Ok" } });
  const group = (id: string, items: unknown[]) => ({
    type: "group",
    id,
    props: { title: id, items },
  });
  const row = (id: string, items: unknown[]) => ({ type: "row", id, props: { items } });
  const tabs = (id: string, first: unknown[]) => ({
    type: "tabs",
    id,
    props: {
      tabs: [
        { id: "ta", title: "A", items: first },
        { id: "tb", title: "B", items: [toggle("t9")] },
      ],
    },
  });
  const layoutQuestion = (id: string, items: unknown[]) => ({
    type: "question",
    id,
    props: { text: "Layout?", items },
  });

  // `schedule` dropped, then a question `q2` holding `layout`.
  const withLayout = async (layout: unknown) => {
    const core = await withMolecules();
    const dropped = await send(core, [
      {
        action: "change",
        itemId: "plan",
        props: { items: copyOf(planItems().filter((item) => item.id !== "schedule")) },
      },
    ]);
    expect(dropped.kind).toBe("updated");
    const added = await send(core, [{ action: "add", item: layoutQuestion("q2", [layout]) }]);
    expect(added.kind).toBe("updated");
    return core;
  };

  const refusedChange = async (layout: { id: string }, props: unknown) => {
    const core = await withLayout(layout);
    const before = core.lifecycleBoard(askId);
    const outcome = await send(core, [{ action: "change", itemId: layout.id, props }]);
    if (outcome.kind !== "refused") throw new Error(outcome.kind);
    expect(outcome).toMatchObject({ refusal: "in-use", itemId: "schedule__plan" });
    expect(outcome.detail).toContain('"schedule__plan"');
    expect(core.lifecycleBoard(askId)).toEqual(before);
    expect(core.fullValue(askId, "schedule").kind).toBe("missing");
    expect(core.fullValue(askId, "schedule__plan").kind).toBe("missing");
  };

  test("through a Group's items", async () => {
    await refusedChange(group("g", [toggle("t1")]), { items: [toggle("schedule__plan")] });
  });

  test("through a Tabs' tabs", async () => {
    await refusedChange(tabs("tb2", [toggle("t1")]), {
      tabs: [
        { id: "ta", title: "A", items: [toggle("schedule__plan")] },
        { id: "tb", title: "B", items: [toggle("t9")] },
      ],
    });
  });

  test("one level deeper, a Row in a Group", async () => {
    await refusedChange(group("g", [toggle("t1")]), {
      items: [row("r", [toggle("schedule__plan"), toggle("t2")])],
    });
  });

  test("a layout change in a question beside a live reference still applies", async () => {
    const core = await withMolecules();
    const items = [...copyOf(planItems()), group("g", [toggle("a"), toggle("b")])];
    expect((await send(core, [{ action: "change", itemId: "plan", props: { items } }])).kind).toBe(
      "updated",
    );
    const outcome = await send(core, [
      { action: "change", itemId: "g", props: { items: [toggle("a"), toggle("c")] } },
    ]);
    expect(outcome.kind).toBe("updated");
    expect(core.fullValue(askId, "wbs").kind).toBe("item");
  });
});
