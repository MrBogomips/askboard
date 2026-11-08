import { describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type BoardContent,
  type CatalogComponent,
  type ItemProps,
  register,
} from "../catalog/port.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { createReadyTracker } from "./ready-tracker.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";

// The result an item is drawn with, through the renderer (reopen-start-from-answer, design
// decision 5; Issue #107): the latest answer's result while no revision has started, the held
// results alone once one has, at any depth of the layouts.

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

type Held = { readonly type: string; readonly id: string; readonly props: unknown };

// The `result` each stub was drawn with, by item ID.
const drawn = new Map<string, unknown>();

const Stub: CatalogComponent = ({ item, result }: ItemProps) => {
  const { id } = item as Held;
  drawn.set(id, result);
  return createElement("span", null, id);
};

const Box: CatalogComponent = ({ item, renderItem }: ItemProps) => {
  const { props } = item as Held;
  const inner = (props as { items: Held[] }).items;
  return createElement("div", null, ...inner.map((child) => renderItem?.(child) as ReactNode));
};

register("revising-stub", Stub);
register("revising-box", Box);

const ITEM_IDS = ["outer", "inner", "box"];
const stub = (id: string): Held => ({ type: "revising-stub", id, props: {} });
const box: Held = { type: "revising-box", id: "box", props: { items: [stub("inner")] } };

const draw = (item: Held, revising: boolean, held: Readonly<Record<string, unknown>>) => {
  drawn.clear();
  const board: BoardContent = { items: [], draft: new Map(), shown: new Map() };
  const results = createDraftStore();
  for (const [id, value] of Object.entries(held)) results.set(id, value);
  const context: RenderContext = {
    draft: createDraftStore(),
    results,
    tracker: createReadyTracker([{ questionId: "q", itemIds: ITEM_IDS }], {
      onVisible: () => {},
      onFailed: () => {},
    }),
    boardContent: () => board,
    derived: createDerivedStore(),
    answeredResult: (id) => `answered ${id}`,
  };
  renderToStaticMarkup(
    createElement(RenderItem, {
      item,
      component: item.type,
      questionId: "q",
      itemIds: ITEM_IDS,
      context,
      disabled: false,
      revising,
    }),
  );
};

describe("the result an item is drawn with", () => {
  test("while no revision has started, the latest answer's result is the fallback, at any depth", () => {
    draw(stub("outer"), false, {});
    expect(drawn.get("outer")).toBe("answered outer");
    draw(box, false, {});
    expect(drawn.get("inner")).toBe("answered inner");
  });

  test("a held result wins over the answer's, revising or not", () => {
    draw(stub("outer"), true, { outer: "held" });
    expect(drawn.get("outer")).toBe("held");
    draw(box, true, { inner: "held inside" });
    expect(drawn.get("inner")).toBe("held inside");
  });

  test("once a revision has started, a result the item holds none of shows none, at any depth", () => {
    draw(stub("outer"), true, {});
    expect(drawn.has("outer")).toBe(true);
    expect(drawn.get("outer")).toBeUndefined();
    draw(box, true, {});
    expect(drawn.has("inner")).toBe(true);
    expect(drawn.get("inner")).toBeUndefined();
  });
});
