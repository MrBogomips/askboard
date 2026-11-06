import { describe, expect, test } from "bun:test";
import {
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
  uj2WidgetFetchResult,
} from "@askboard/contract/fixtures";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, WHEN } from "./lifecycle-fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";

// Core spec: Full value of an item, Full value of a widget item (widget-answers design decision 7):
// an answered question holds its widget values and derived values in reference addressing, a
// widget item or reference alone comes as the user left it, an expanded ID is unknown.

const ASK_ID = uj2Ask.askId;
type Json = Record<string, unknown>;
type Loose = Json & { answer: Json; props: Json };
type Act = Parameters<AskCore["act"]>[1];
type Request = Parameters<AskCore["ask"]>[0];

const open = async (request: unknown = uj2Ask) => {
  const core = new AskCore({
    ...fakePorts().ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
  });
  const outcome = await core.ask(copyOf(request) as Request);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  return core;
};

let n = 200;
const answer = (core: AskCore, askId: string, itemId: string, fields: Json) => {
  n += 1;
  const act = { type: "answer", itemId, rev: 1, when: WHEN, ...fields };
  return core.act(askId, { actionId: actionId(n), acts: [act] } as unknown as Act);
};

const answered = async () => {
  const core = await open();
  const values = copyOf(uj2ExpandedEditedValues);
  answer(core, ASK_ID, "plan", { values, derived: copyOf(uj2ExpandedDerived) });
  return core;
};

const itemOf = (core: AskCore, itemId: string) => {
  const value = core.fullValue(ASK_ID, itemId);
  if (value.kind !== "item") throw new Error(`${itemId}: ${value.kind}`);
  return value as unknown as { item: Loose; generation: number };
};

// The board document's item `at` of the question `plan`, as the agent sent it (expanded).
const sentItem = (core: AskCore, at: number): Json => {
  const document = core.board(ASK_ID)?.document;
  const [question] = (document?.items ?? []) as unknown as { props: { items: Json[] } }[];
  return (question?.props.items[at] ?? {}) as Json;
};

describe("the full value of a widget question", () => {
  test("the answered UJ-2 question holds edited values and derived values by reference", async () => {
    const core = await answered();
    const { item } = itemOf(core, "plan");
    expect(Object.keys(item.answer.values as Json)).toEqual(["wbs", "schedule"]);
    expect(Object.keys(item.answer.derived as Json)).toHaveLength(14);
    expect(Object.hasOwn(item.answer.derived as Json, "schedule.criticalPath")).toBe(true);
    expect((item.props.items as Json[]).map((each) => each.id)).toEqual(["wbs", "schedule"]);
    expect(JSON.stringify(item)).not.toMatch(/wbs__tree|schedule__plan/);
    expect((item.answer.values as Json).schedule).toMatchObject({ workPackages: "wbs" });
  });

  test("no fetched value of the UJ-2 ask holds an expanded ID, open or answered", async () => {
    for (const core of [await open(), await answered()]) {
      for (const id of ["plan", "wbs", "schedule"]) {
        expect(JSON.stringify(itemOf(core, id))).not.toMatch(/wbs__tree|schedule__plan/);
      }
    }
  });

  test("an area holding the UJ-2 question names the references too", async () => {
    const area = { type: "area", id: "scope", props: { title: "Scope", items: uj2Ask.items } };
    const core = await open({ askId: "area-uj2-a1b2", items: [area] });
    const text = JSON.stringify(core.fullValue("area-uj2-a1b2", "scope"));
    expect(text).toContain('"id":"wbs"');
    expect(text).not.toMatch(/wbs__tree|schedule__plan/);
  });

  test("an excerpt beside a Tree keeps the excerpts form and the Tree comes in full", async () => {
    const tree = { type: "tree", id: "tree", props: { nodes: [{ id: "a", label: "A" }] } };
    const note = { type: "excerpt", id: "note", props: { text: "secret text", title: "Note" } };
    const request = {
      askId: "beside-q1w2",
      items: [{ type: "question", id: "q", props: { text: "Edit", items: [note, tree] } }],
    };
    const core = await open(request);
    const value = core.fullValue("beside-q1w2", "q");
    const props = (value as unknown as { item: { props: { items: Json[] } } }).item.props;
    expect(props.items[0]).toEqual({ type: "excerpt", id: "note", props: { title: "Note" } });
    expect(props.items[1]).toEqual(tree);
  });
});

describe("the full value of a widget item or a reference", () => {
  test("a reference comes under its own ID as the user left it", async () => {
    const core = await answered();
    expect<unknown>(itemOf(core, "wbs").item).toEqual(uj2WidgetFetchResult.item);
    const { item } = itemOf(core, "schedule");
    expect(item).toMatchObject({ type: "gantt", id: "schedule", questionId: "plan" });
    expect(item.props.workPackages).toBe("wbs");
    expect(item.props.tasks).toHaveProperty("u-1");
  });

  test("an untouched Tree in an open question is the Tree as the agent sent it", async () => {
    const core = await open();
    const sent = sentItem(core, 0);
    const { item } = itemOf(core, "wbs");
    expect<unknown>(item).toEqual({
      type: "tree",
      id: "wbs",
      questionId: "plan",
      props: sent.props,
      state: "open",
    });
  });

  test("an item the answer did not change is returned as sent, beside one it changed", async () => {
    const core = await open();
    answer(core, ASK_ID, "plan", {
      values: { wbs__tree: (copyOf(uj2ExpandedEditedValues) as Json).wbs__tree },
    });
    const sent = sentItem(core, 1);
    const { item } = itemOf(core, "schedule");
    expect(item.props).toEqual({ ...(sent.props as Json), workPackages: "wbs" });
  });

  test("an expanded ID is an unknown item, as is an item that is no widget", async () => {
    const core = await answered();
    expect(core.fullValue(ASK_ID, "wbs__tree").kind).toBe("missing");
    expect(core.fullValue(ASK_ID, "schedule__plan").kind).toBe("missing");
  });
});

describe("the generation of a widget item", () => {
  const generationOf = (core: AskCore, id: string) => itemOf(core, id).generation;

  test("an answer raises it", async () => {
    const core = await open();
    const [before, same] = [generationOf(core, "wbs"), generationOf(core, "wbs")];
    expect(same).toBe(before);
    answer(core, ASK_ID, "plan", { values: copyOf(uj2ExpandedEditedValues) });
    expect(generationOf(core, "wbs")).toBeGreaterThan(before);
  });

  test("a revision of the question raises it", async () => {
    const core = await open();
    const before = generationOf(core, "wbs");
    core.update({
      askId: ASK_ID,
      actions: [{ action: "change", itemId: "plan", props: { text: "Rework the plan" } }],
    });
    expect(generationOf(core, "wbs")).toBeGreaterThan(before);
  });
});
