import { describe, expect, test } from "bun:test";
import type { Rendered } from "../catalog/components.ts";
import { couldSplit, layoutOf } from "./context-layout.ts";

const rendered = (type: string, id: string, props: unknown = {}): Rendered => ({
  item: { type, id, props },
  component: type,
});

const question = { type: "question", id: "q", rev: 1, props: { text: "Q?" } } as never;
const choice: Rendered = { item: question, component: "choice" };
const resolved = rendered("excerpt", "a", { status: "resolved", pointer: "a.md#L1-L2" });
const written = rendered("excerpt", "w", { text: "x" });
const missing = rendered("excerpt", "m", { status: "unresolved", pointer: "m.md#L1" });
const ref = rendered("reference", "r");
const image = rendered("image", "i");

describe("a question card's context layout (excerpts, task 6.3; view spec, A question with context splits)", () => {
  test("the context is the excerpts, then the references, each in its own order", () => {
    const { context } = layoutOf([choice, ref, missing, resolved, image, written]);
    expect(context.map(({ item }) => item.id)).toEqual(["m", "a", "w", "r"]);
  });

  test("the options stay with the question, and everything else follows below, images included", () => {
    const laid = layoutOf([choice, image, resolved, rendered("table", "t")]);
    expect(laid.main).toEqual([choice]);
    expect(laid.below.map(({ item }) => item.id)).toEqual(["i", "t"]);
  });

  test("a resolved or an agent-written excerpt lets the card split", () => {
    expect(couldSplit(layoutOf([choice, resolved]).context)).toBe(true);
    expect(couldSplit(layoutOf([choice, written]).context)).toBe(true);
  });

  test("an unresolved excerpt alone, references alone and no context do not", () => {
    expect(couldSplit(layoutOf([choice, missing, ref]).context)).toBe(false);
    expect(couldSplit(layoutOf([choice, ref]).context)).toBe(false);
    expect(couldSplit(layoutOf([choice]).context)).toBe(false);
  });

  test("props that are no object do not split", () => {
    expect(couldSplit(layoutOf([rendered("excerpt", "x", null)]).context)).toBe(false);
    expect(couldSplit(layoutOf([rendered("excerpt", "y", "text")]).context)).toBe(false);
  });
});
