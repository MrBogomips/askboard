import { describe, expect, test } from "bun:test";
import {
  ATOM_TYPES,
  LAYOUT_WIDGETS,
  treeBoardDocument,
  treeEditedValue,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { EventLog } from "../src/lifecycle/log.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: Fetching nested items and layouts (layouts, design decision 5): `fetch` of an item
// inside a layout returns that item alone as the user left it, with its question's state; `fetch`
// of a layout returns it with every item inside it as the user left it. The shipped `AskCore` holds
// the shipped registry, so the values are read through `widgetItemValue` over `withWidgetTypes`.

const TYPES = withWidgetTypes(...ATOM_TYPES, ...LAYOUT_WIDGETS);
const copy = <T>(value: T): T => structuredClone(value);
const [PLAN] = treeBoardDocument.items;
const [WBS] = PLAN.props.items;

// A Tabs whose first tab holds a Group of a Tree `wbs` and a NumberField `days`, and whose second
// tab holds a Stack of a TextField `owner`.
const arranged = (): Item[] =>
  copy([
    {
      type: "tabs",
      id: "sections",
      props: {
        tabs: [
          {
            id: "breakdown",
            title: "Breakdown",
            items: [
              {
                type: "group",
                id: "work",
                props: {
                  title: "Work",
                  items: [
                    WBS,
                    { type: "number-field", id: "days", props: { label: "Days", min: 0, max: 40 } },
                  ],
                },
              },
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

// The model after `fields` were answered (or none), and a reader of what `fetch` returns.
const held = (fields?: Json) => {
  const model = modelOf(arranged());
  const log = new EventLog();
  const kept = new Map();
  if (fields !== undefined) {
    const { outcome } = checked(model, [answerAct(fields)], { types: TYPES, log });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    model.noteEntries(log.append(outcome.events));
    for (const [cursor, entry] of outcome.kept) kept.set(cursor, entry);
  }
  const question = model.questions()[0];
  if (question === undefined) throw new Error("no question");
  const status = () => questionStatus(question.mark, log.ofItem(question.id));
  const fetch = { map: new Map(), source: undefined, kept };
  return (id: string) => widgetItemValue(model, id, status, fetch, TYPES);
};

type Fetched = { type: string; id: string; props: Json; state: string; questionId: string };
const itemOf = (found: ReturnType<ReturnType<typeof held>>): Fetched => {
  if (found === undefined) throw new Error("nothing fetched");
  return found.item as unknown as Fetched;
};

describe("fetching an item inside a layout", () => {
  test("a Tree inside a tab, after an answer with an added node, comes as the user left it", () => {
    const fetched = itemOf(held({ values: { wbs: copy(treeEditedValue) } })("wbs"));
    expect(fetched).toMatchObject({
      type: "tree",
      id: "wbs",
      questionId: "choose",
      state: "answered",
    });
    expect(fetched.props).toEqual(treeEditedValue as unknown as Json);
  });

  test("before any answer it comes as sent, with its question's state", () => {
    const fetched = itemOf(held()("wbs"));
    expect(fetched).toMatchObject({ type: "tree", questionId: "choose", state: "open" });
    expect(fetched.props).toEqual(WBS.props as unknown as Json);
  });

  test("an atom inside a layout comes with its result, as an atom at the top does", () => {
    const found = held({ results: { days: 12 } })("days");
    expect(itemOf(found)).toMatchObject({ type: "number-field", id: "days", state: "answered" });
    expect((itemOf(found) as { result?: unknown }).result).toBe(12);
  });

  test("an ID no item holds, an inherited name or a prototype key names nothing", () => {
    const fetch = held({ results: { days: 12 } });
    for (const id of ["nowhere", "constructor", "__proto__", "toString"]) {
      expect(fetch(id)).toBeUndefined();
    }
  });
});

describe("fetching a layout", () => {
  test("a Group comes with its title and its Tree as the user left it", () => {
    const fetched = itemOf(held({ values: { wbs: copy(treeEditedValue) } })("work"));
    expect(fetched).toMatchObject({ type: "group", id: "work", state: "answered" });
    expect(fetched.props.title).toBe("Work");
    const [tree, days] = fetched.props.items as Item[];
    expect(tree?.props).toEqual(treeEditedValue as unknown as Json);
    expect(days).toEqual({
      type: "number-field",
      id: "days",
      props: { label: "Days", min: 0, max: 40 },
    });
  });

  test("a Tabs comes with the items of each of its tabs as the user left them", () => {
    const fetched = itemOf(held({ values: { wbs: copy(treeEditedValue) } })("sections"));
    const tabs = fetched.props.tabs as { id: string; items: Item[] }[];
    expect(tabs.map(({ id }) => id)).toEqual(["breakdown", "who"]);
    const [work] = tabs[0]?.items ?? [];
    const [tree] = ((work as Item).props as { items: Item[] }).items;
    expect(tree?.props).toEqual(treeEditedValue as unknown as Json);
    expect(tabs[1]?.items[0]?.id).toBe("people");
  });

  test("an unanswered layout comes as sent, and a layout gives no result", () => {
    const found = held()("people");
    expect(itemOf(found)).toMatchObject({ type: "stack", id: "people", state: "open" });
    expect(found?.item).not.toHaveProperty("result");
    expect(itemOf(found).props).toEqual({
      items: [{ type: "text-field", id: "owner", props: { label: "Owner" } }],
    });
  });

  test("fetching leaves what is held as it was", () => {
    const fetch = held({ values: { wbs: copy(treeEditedValue) } });
    const first = JSON.stringify(fetch("work"));
    const again = JSON.stringify(fetch("work"));
    expect(again).toBe(first);
    expect(JSON.stringify(fetch("wbs"))).toContain("u-1");
  });
});
