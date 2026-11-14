import { describe, expect, test } from "bun:test";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";

// Core spec: Fetching an item (layouts review S-2): `fetch` of an item of a deleted question answers
// `deleted`, at every depth of its layouts, where it answered `missing` before layouts. A molecule
// reference is read in reference addressing (AD-9; agent-facing-gaps review 2.2, X-1): the reference
// of a deleted question is `deleted`, and an expanded ID the agent never sent stays `missing`.

type Request = Parameters<AskCore["ask"]>[0];
type Update = Parameters<AskCore["update"]>[0];

const ASK_ID = "deleted-fetch";

const request = {
  askId: ASK_ID,
  items: [
    {
      type: "question",
      id: "plan",
      props: {
        text: "Plan?",
        items: [
          {
            type: "group",
            id: "estimate",
            props: {
              title: "Estimate",
              items: [{ type: "text-field", id: "t1", props: { label: "Note" } }],
            },
          },
          { type: "number-field", id: "days", props: { label: "Days", min: 0, max: 9 } },
        ],
      },
    },
    {
      type: "question",
      id: "other",
      props: { text: "Other?", items: [{ type: "toggle", id: "ok", props: { label: "Ok" } }] },
    },
  ],
} as unknown as Request;

describe("fetch of an item of a deleted question", () => {
  test("answers deleted for a nested item and a top-level one", async () => {
    const core = new AskCore(fakePorts().ports);
    const created = await core.ask(request);
    expect(JSON.stringify(created)).toContain("created");
    expect(core.fullValue(ASK_ID, "t1").kind).not.toBe("deleted");
    const outcome = await core.update({
      askId: ASK_ID,
      actions: [{ action: "delete", itemId: "plan" }],
    } as unknown as Update);
    expect(outcome.kind).toBe("updated");
    for (const itemId of ["t1", "estimate", "days"]) {
      expect(core.fullValue(ASK_ID, itemId)).toEqual({ kind: "deleted", askId: ASK_ID, itemId });
    }
  });
});

const withMolecules = () =>
  new AskCore({
    ...fakePorts().ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
  });

const deleteItem = async (core: AskCore, askId: string, itemId: string) =>
  core.update({ askId, actions: [{ action: "delete", itemId }] } as unknown as Update);

describe("fetch of a molecule reference inside a deleted question", () => {
  test("the references wbs and schedule answer deleted, their expanded IDs missing", async () => {
    const core = withMolecules();
    const { askId } = uj2Ask;
    expect((await core.ask(copyOf(uj2Ask) as unknown as Request)).kind).toBe("created");
    // While the question lives: the references hold items, an expanded ID is unknown.
    expect(core.fullValue(askId, "wbs").kind).toBe("item");
    expect(core.fullValue(askId, "schedule").kind).toBe("item");
    expect(core.fullValue(askId, "wbs__tree").kind).toBe("missing");
    expect(core.fullValue(askId, "schedule__plan").kind).toBe("missing");
    expect((await deleteItem(core, askId, "plan")).kind).toBe("updated");
    expect(core.fullValue(askId, "plan")).toEqual({ kind: "deleted", askId, itemId: "plan" });
    for (const itemId of ["wbs", "schedule"]) {
      expect(core.fullValue(askId, itemId)).toEqual({ kind: "deleted", askId, itemId });
    }
    for (const itemId of ["wbs__tree", "schedule__plan", "never-sent"]) {
      expect(core.fullValue(askId, itemId)).toEqual({ kind: "missing", askId, itemId });
    }
  });

  test("a deleted area holding a question with a reference: the reference deleted, the expanded ID missing", async () => {
    const core = withMolecules();
    const askId = "deleted-area-ref";
    const [plan] = uj2Ask.items;
    const request = {
      askId,
      items: [
        {
          type: "area",
          id: "planning",
          props: { title: "Planning", items: [{ ...copyOf(plan), id: "plan-q" }] },
        },
        {
          type: "area",
          id: "ops",
          props: {
            title: "Ops",
            items: [
              {
                type: "question",
                id: "ops-q",
                props: {
                  text: "Ok?",
                  items: [{ type: "toggle", id: "ok", props: { label: "Ok" } }],
                },
              },
            ],
          },
        },
      ],
    } as unknown as Request;
    const created = await core.ask(request);
    expect(JSON.stringify(created)).toContain("created");
    expect(core.fullValue(askId, "wbs").kind).toBe("item");
    expect((await deleteItem(core, askId, "planning")).kind).toBe("updated");
    for (const itemId of ["planning", "plan-q", "wbs", "schedule"]) {
      expect(core.fullValue(askId, itemId)).toEqual({ kind: "deleted", askId, itemId });
    }
    for (const itemId of ["wbs__tree", "schedule__plan"]) {
      expect(core.fullValue(askId, itemId)).toEqual({ kind: "missing", askId, itemId });
    }
    expect(core.fullValue(askId, "ops-q").kind).toBe("item");
  });

  test("a reference a change dropped before the question was deleted stays missing, never deleted", async () => {
    const core = withMolecules();
    const { askId } = uj2Ask;
    await core.ask(copyOf(uj2Ask) as unknown as Request);
    const [plan] = uj2Ask.items;
    const items = (plan?.props.items ?? []).filter((item) => item.id !== "schedule");
    const changed = await core.update({
      askId,
      actions: [{ action: "change", itemId: "plan", props: { items: copyOf(items) } }],
    } as unknown as Update);
    expect(changed.kind).toBe("updated");
    await deleteItem(core, askId, "plan");
    expect(core.fullValue(askId, "wbs").kind).toBe("deleted");
    expect(core.fullValue(askId, "schedule").kind).toBe("missing");
  });

  test("the IDs of a deleted question's references stay in use, expanded ones too (inUse unchanged)", async () => {
    const core = withMolecules();
    const { askId } = uj2Ask;
    await core.ask(copyOf(uj2Ask) as unknown as Request);
    await deleteItem(core, askId, "plan");
    for (const id of ["wbs", "wbs__tree", "plan"]) {
      const outcome = await core.update({
        askId,
        actions: [{ action: "add", item: { type: "question", id, props: { text: "Again?" } } }],
      } as unknown as Update);
      expect(outcome.kind, id).not.toBe("updated");
    }
  });
});
