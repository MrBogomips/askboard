// A widget item among a question's items goes through the walkers of E5's context items untouched
// (widget-answers, task 1.2): resolution reads no pointer for it, the board document holds it as
// sent, no warning names it, `fetch` returns it whole, and it has no source.

import { describe, expect, test } from "bun:test";
import type { ContextItem, LifecycleAskInput, QuestionProps } from "@askboard/contract";
import { validateBoardDocument } from "@askboard/contract/validate";
import { boardPropsOf } from "../src/context/board-props.ts";
import {
  ADR_POINTER,
  boardItemsOf,
  CONTEXT_ASK_ID,
  contextAsk,
  contextCoreWith,
  excerpt,
} from "./context-fakes.ts";

const TREE = { type: "tree", id: "wbs", props: { nodes: [{ id: "ux", label: "UX" }] } };
const GANTT = {
  type: "gantt",
  id: "plan",
  props: { start: "2026-11-02", tasks: [{ id: "ux", label: "UX", duration: 6 }] },
};
const widgets = [TREE, GANTT] as unknown as readonly ContextItem[];

const created = async (ask: LifecycleAskInput) => {
  const fakes = contextCoreWith({});
  const outcome = await fakes.core.ask(ask);
  expect(outcome.kind).toBe("created");
  return { ...fakes, outcome };
};

describe("widget items among a question's items", () => {
  test("the board document holds them as sent, beside a resolved excerpt, in order", async () => {
    const { core, calls } = await created(contextAsk([excerpt("adr", ADR_POINTER), ...widgets]));
    const items = boardItemsOf(core, CONTEXT_ASK_ID);
    expect(items?.map(({ id }) => id)).toEqual(["adr", "wbs", "plan"]);
    expect(items?.[1]).toEqual(TREE as never);
    expect(items?.[2]).toEqual(GANTT as never);
    // Only the excerpt's pointer was read.
    expect(JSON.stringify(calls)).not.toContain("wbs");
  });

  test("no warning names a widget item, and the board document validates", async () => {
    const { core, outcome } = await created(contextAsk(widgets));
    expect(outcome.kind === "created" && outcome.warnings).toBeFalsy();
    expect(core.sourceOf(CONTEXT_ASK_ID, "wbs")).toBeUndefined();
    expect(core.sourceOf(CONTEXT_ASK_ID, "plan")).toBeUndefined();
    const view = core.lifecycleBoard(CONTEXT_ASK_ID);
    expect(view !== undefined && "document" in view).toBe(true);
    if (view !== undefined && "document" in view) {
      expect(validateBoardDocument(view.document).ok).toBe(true);
    }
  });

  test("fetch returns a widget item whole", async () => {
    const { core } = await created(contextAsk([excerpt("adr", ADR_POINTER), ...widgets]));
    const value = core.fullValue(CONTEXT_ASK_ID, "fix");
    expect(value.kind).toBe("item");
    if (value.kind !== "item" || value.item.type !== "question") return;
    expect(value.item.props.items?.slice(1)).toEqual(widgets as never);
  });

  test("a molecule reference that was not expanded is never given to the board document", () => {
    const reference = { type: "molecule", id: "wbs", props: { molecule: "wbs-pert", data: {} } };
    const props = { text: "Plan?", items: [reference] } as unknown as QuestionProps;
    expect(() => boardPropsOf(props, undefined)).toThrow(
      '"wbs" reached the board document unexpanded',
    );
  });
});
