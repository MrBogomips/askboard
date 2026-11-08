import { describe, expect, test } from "bun:test";
import {
  ATOM_TYPES,
  LATEX_FIXTURE_ITEM,
  LAYOUT_WIDGETS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { EventLog } from "../src/lifecycle/log.ts";
import { BoardModel } from "../src/lifecycle/model.ts";
import { applyActions, type UpdateContext, type UpdateRefusal } from "../src/lifecycle/updates.ts";
import { holderOf } from "../src/lifecycle/widget-update.ts";
import { answerAct, checked, type Item, type Json } from "./probe-fakes.ts";

// Core spec: Changing a nested item or a layout, Item IDs unique across the ask on update (layouts,
// design decision 5). The shipped `AskCore` holds the shipped registry, so the actions run through
// `applyActions` over `withWidgetTypes` of the atoms and the layouts.

const TYPES = withWidgetTypes(...ATOM_TYPES, ...LAYOUT_WIDGETS);
const copy = <T>(value: T): T => structuredClone(value);
const number = (id: string, max = 40): Item => ({
  type: "number-field",
  id,
  props: { label: id, min: 0, max },
});
const group = (id: string, ...items: Item[]): Item => ({
  type: "group",
  id,
  props: { title: id, items },
});

// `plan`: a Tabs of a Group of a NumberField `days` and a Row of `hours`, and a second tab holding
// a Stack of a TextField `owner`. `other`: a Tree-less question of one NumberField `budget`.
const planItems = (): Item[] =>
  copy([
    {
      type: "tabs",
      id: "sections",
      props: {
        tabs: [
          {
            id: "effort",
            title: "Effort",
            items: [
              group(
                "estimate",
                number("days"),
                { type: "row", id: "pair", props: { items: [number("hours"), number("rate")] } },
                LATEX_FIXTURE_ITEM as unknown as Item,
              ),
            ],
          },
          {
            id: "who",
            title: "Who",
            items: [
              {
                type: "stack",
                id: "people",
                props: { items: [{ type: "text-field", id: "owner", props: { label: "Owner" } }] },
              },
            ],
          },
        ],
      },
    },
  ]) as Item[];

const question = (id: string, items: Item[]) => ({
  type: "question",
  id,
  props: { text: id, items },
});

const setup = (log = new EventLog()) => {
  const model = BoardModel.of([
    question("plan", planItems()),
    question("other", [number("budget")]),
  ] as never);
  const context: UpdateContext = {
    askId: "ask",
    epoch: "e1",
    who: "Sara Conti",
    now: "2026-11-07T10:00:00Z",
    model,
    log,
    widgets: { source: undefined, expansion: new Map(), references: new Map() },
    types: TYPES,
  };
  return { model, log, context };
};

const itemsOf = (model: BoardModel, id: string) =>
  (model.propsOf(model.question(id) as never) as unknown as { items: Item[] }).items;

// The nested item `id` in the question's current items, at any depth.
const find = (items: readonly Item[], id: string): Item | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    const props = item.props as { items?: Item[]; tabs?: { items: Item[] }[] };
    const inside = [...(props.items ?? []), ...(props.tabs ?? []).flatMap((tab) => tab.items)];
    const found = find(inside, id);
    if (found !== undefined) return found;
  }
  return undefined;
};

const change = (itemId: string, props: Json) => ({ action: "change", itemId, props }) as never;
const add = (item: unknown, parentId?: string) =>
  ({ action: "add", item, ...(parentId === undefined ? {} : { parentId }) }) as never;

// A refused update names the refusal and leaves the ask as it was.
const refused = (actions: unknown[], refusal?: UpdateRefusal) => {
  const { model, context } = setup();
  const before = JSON.stringify(model.items());
  const result = applyActions(context, actions as never);
  if (result.ok) throw new Error(`applied: ${JSON.stringify(result.applied)}`);
  if (refusal !== undefined) expect(result.refusal).toBe(refusal);
  expect(JSON.stringify(model.items())).toBe(before);
  expect(model.question("plan")?.rev).toBe(1);
  return result;
};

describe("changing a nested item", () => {
  test("a NumberField's bound inside a Group in a tab is merged, at rev 2, and nothing else moves", () => {
    const { model, context } = setup();
    const before = copy(itemsOf(model, "plan"));
    const result = applyActions(context, [change("days", { max: 12 })]);
    expect(result).toMatchObject({
      ok: true,
      applied: [{ action: "change", itemId: "days", rev: 2 }],
    });
    const items = itemsOf(model, "plan");
    expect(find(items, "days")?.props).toEqual({ label: "days", min: 0, max: 12 });
    // The only difference is that one key.
    (find(before, "days")?.props as Json).max = 12;
    expect(items).toEqual(before);
    expect(model.question("plan")?.rev).toBe(2);
    expect(model.question("other")?.rev).toBe(1);
  });

  test("a nested change that leaves the item invalid is refused, naming it, with the ask unchanged", () => {
    const result = refused([change("hours", { max: -5 })], "props");
    expect(result.itemId).toBe("hours");
  });

  test("a change of a Group merges its props key by key and keeps its items", () => {
    const { model, context } = setup();
    const result = applyActions(context, [change("estimate", { title: "Effort estimate" })]);
    expect(result.ok).toBe(true);
    const held = find(itemsOf(model, "plan"), "estimate");
    expect(((held as Item).props as Json).title).toBe("Effort estimate");
    expect(find(itemsOf(model, "plan"), "days")).toBeDefined();
  });

  test("a Tabs' tabs are replaced whole, the new tab's TextField checked as an ask's item is", () => {
    const { model, context } = setup();
    const tabs = [
      {
        id: "notes",
        title: "Notes",
        items: [{ type: "text-field", id: "remark", props: { label: "Remark" } }],
      },
      { id: "more", title: "More", items: [number("extra")] },
    ];
    const result = applyActions(context, [change("sections", { tabs })]);
    expect(result).toMatchObject({ ok: true, applied: [{ itemId: "sections", rev: 2 }] });
    expect(((find(itemsOf(model, "plan"), "sections") as Item).props as Json).tabs).toEqual(tabs);
    expect(find(itemsOf(model, "plan"), "days")).toBeUndefined();

    const bad = [
      { id: "notes", title: "Notes", items: [{ type: "text-field", id: "remark", props: {} }] },
      { id: "more", title: "More", items: [number("extra")] },
    ];
    refused([change("sections", { tabs: bad })], "props");
  });

  test("a change that nests the layouts past the bound is refused, appending nothing", () => {
    let deep: Item = number("leaf");
    for (const id of ["a", "b", "c", "d"]) deep = group(id, deep);
    const result = refused([change("people", { items: [deep] })], "props");
    expect(result.detail.length).toBeGreaterThan(0);
  });

  test("a hostile depth through a change is refused and never throws", () => {
    let deep: Item = number("leaf");
    for (let n = 0; n < 5_000; n += 1) deep = group(`g${n}`, deep);
    refused([change("people", { items: [deep] })], "props");
  });

  test("a nested item of an answered question is refused, naming the answer", () => {
    const log = new EventLog();
    const { model, context } = setup(log);
    const answered = checked(model, [answerAct({ results: { days: 3 } }, "plan")], {
      types: TYPES,
      log,
    });
    if (!answered.outcome.ok) throw new Error(JSON.stringify(answered.outcome.problem));
    model.noteEntries(log.append(answered.outcome.events));
    const result = applyActions(context, [change("days", { max: 12 })]);
    if (result.ok) throw new Error("applied");
    expect(result.refusal).toBe("answered");
    expect(result.cursor).toBeDefined();
    expect(result.detail).toContain('"plan"');
    expect(model.question("plan")?.rev).toBe(1);
  });

  test("a change naming an item no question holds is refused as unknown", () => {
    refused([change("nowhere", { max: 1 })], "unknown-item");
  });

  test("holderOf finds an item and a layout at any depth, and names its question", () => {
    const { model, context } = setup();
    for (const id of ["sections", "estimate", "days", "pair", "hours", "owner", "people"]) {
      const holder = holderOf(model, context.widgets, id, TYPES);
      expect(holder?.question.id).toBe("plan");
      expect(holder?.item.id).toBe(id);
    }
    expect(holderOf(model, context.widgets, "budget", TYPES)?.question.id).toBe("other");
    expect(holderOf(model, context.widgets, "constructor", TYPES)).toBeUndefined();
  });
});

describe("item IDs unique across the ask on update", () => {
  test("a question added with an ID a nested item holds is refused, naming it", () => {
    const result = refused(
      [add(question("extra", [{ type: "text-field", id: "owner", props: { label: "Owner" } }]))],
      "in-use",
    );
    expect(result.detail).toContain('"owner"');
    expect(result.itemId).toBe("owner");
  });

  test("a question added with a nested item holding a used ID is refused, naming it", () => {
    const inner = group("fresh-group", number("days"));
    expect(refused([add(question("extra", [inner]))], "in-use").detail).toContain('"days"');
  });

  test("a new question named like a nested item is refused", () => {
    refused([add(question("days", [number("fresh")]))], "in-use");
  });

  test("a question's own item may keep the IDs it holds when it changes", () => {
    const { context } = setup();
    expect(applyActions(context, [change("days", { max: 9 })]).ok).toBe(true);
  });

  test("a change to a question's items holding another question's item ID is refused, naming it", () => {
    const { model, context } = setup();
    const before = JSON.stringify(model.items());
    const clash = { type: "toggle", id: "budget", props: { label: "Budget" } };
    const result = applyActions(context, [change("plan", { items: [clash] })]);
    if (result.ok) throw new Error("applied");
    expect(result.refusal).toBe("in-use");
    expect(result.detail).toContain('"budget"');
    expect(JSON.stringify(model.items())).toBe(before);
  });

  test("a nested item's change cannot introduce another question's ID either", () => {
    const toggle = { type: "toggle", id: "budget", props: { label: "Budget" } };
    expect(refused([change("people", { items: [toggle] })], "in-use").detail).toContain('"budget"');
  });

  test("a change that drops an item frees its ID for a later add", () => {
    const { model, context } = setup();
    const dropped = applyActions(context, [
      change("estimate", { items: [number("hours")] }),
      add(question("again", [number("days")])),
    ]);
    expect(dropped.ok).toBe(true);
    expect(model.question("again")).toBeDefined();
  });

  test("a deleted question's own ID, and the IDs it held, stay refused", () => {
    const { model, context } = setup();
    expect(applyActions(context, [{ action: "delete", itemId: "plan" } as never]).ok).toBe(true);
    expect(model.inUse("plan")).toBe(true);
    for (const id of ["days", "owner", "sections"]) expect(model.inUse(id)).toBe(true);
    const again = applyActions(context, [add(question("later", [number("days")]))]);
    if (again.ok) throw new Error("applied");
    expect(again.refusal).toBe("in-use");
    expect(again.detail).toContain("deleted earlier");
  });

  test("an ID nobody holds is free", () => {
    const { model } = setup();
    expect(model.inUse("brand-new")).toBe(false);
    for (const id of ["days", "owner", "budget", "plan"]) expect(model.inUse(id)).toBe(true);
  });
});
