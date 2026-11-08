import { describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type BoardContent,
  type CatalogComponent,
  type ItemProps,
  LanguageContext,
  register,
} from "../catalog/port.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { createReadyTracker } from "./ready-tracker.ts";
import { ItemError, type RenderContext, RenderItem } from "./renderer.tsx";

// An item the card makes read-only, drawn through the renderer (keep-mine-shown-revision, design
// decision 3 and 4): `disabled` reaches the component, at any depth of its layouts, and the line
// says why under that item and under no other.

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

// The `disabled` each stub component was drawn with, by item ID.
const drawn = new Map<string, boolean>();

type Held = { readonly type: string; readonly id: string; readonly props: unknown };

const Stub: CatalogComponent = ({ item, disabled }: ItemProps) => {
  const { id } = item as Held;
  drawn.set(id, disabled);
  return createElement("span", { "data-stub": id }, id);
};

// A layout stub, which draws the items it holds through the port's renderer.
const Box: CatalogComponent = ({ item, disabled, renderItem }: ItemProps) => {
  const { id, props } = item as Held;
  drawn.set(id, disabled);
  const inner = (props as { items: Held[] }).items;
  return createElement("div", null, ...inner.map((child) => renderItem?.(child) as ReactNode));
};

// A component that reports back while it is drawn, as a component's effects do: its derived
// values, and an update naming an item its question does not hold.
const Reporting: CatalogComponent = ({ item, onDerived, onValuesChange }: ItemProps) => {
  const { id } = item as Held;
  onDerived({ total: 1 });
  onValuesChange({ outsider: 1 });
  return createElement("span", null, id);
};

register("read-only-stub", Stub);
register("read-only-reporting", Reporting);
register("read-only-box", Box);

const ITEM_IDS = ["edited", "other", "inner", "inner-other", "box"];

const context = (): RenderContext => {
  const board: BoardContent = { items: [], draft: new Map(), shown: new Map() };
  return {
    draft: createDraftStore(),
    tracker: createReadyTracker([{ questionId: "q", itemIds: ITEM_IDS }], {
      onVisible: () => {},
      onFailed: () => {},
    }),
    boardContent: () => board,
    derived: createDerivedStore(),
  };
};

const draw = (item: Held, shared: RenderContext): string =>
  renderToStaticMarkup(
    createElement(RenderItem, {
      item,
      component: item.type,
      questionId: "q",
      itemIds: ITEM_IDS,
      context: shared,
      disabled: false,
    }),
  );

const render = (
  item: Held,
  readOnlyItems: ReadonlySet<string> | undefined,
  language: "en-US" | "it-IT" = "en-US",
): string => {
  drawn.clear();
  const rendered = createElement(RenderItem, {
    item,
    component: item.type,
    questionId: "q",
    itemIds: ITEM_IDS,
    context: context(),
    disabled: false,
    ...(readOnlyItems === undefined ? {} : { readOnlyItems }),
  });
  return renderToStaticMarkup(
    createElement(LanguageContext.Provider, { value: language }, rendered),
  );
};

const stub = (id: string) => ({ type: "read-only-stub", id, props: {} });
const box = {
  type: "read-only-box",
  id: "box",
  props: { items: [stub("inner"), stub("inner-other")] },
};
const LINE =
  "Read-only: your work on this question keeps an earlier version, which this tab can no longer show.";
const LINE_IT =
  "In sola lettura: il tuo lavoro su questa domanda mantiene una versione precedente, che questa scheda non può più mostrare.";

describe("an item in the read-only set, drawn through the renderer", () => {
  test("a top-level item is drawn disabled and shows the line under it", () => {
    const html = render(stub("edited"), new Set(["edited"]));
    expect(drawn.get("edited")).toBe(true);
    expect(html).toContain(LINE);
    expect(html.indexOf("data-stub")).toBeLessThan(html.indexOf(LINE));
  });

  test("a sibling outside the set is drawn editable, with no line", () => {
    const html = render(stub("other"), new Set(["edited"]));
    expect(drawn.get("other")).toBe(false);
    expect(html).not.toContain(LINE);
  });

  test("with no set given nothing is read-only", () => {
    const html = render(stub("edited"), undefined);
    expect(drawn.get("edited")).toBe(false);
    expect(html).not.toContain(LINE);
  });

  test("an item inside a layout is drawn disabled with the line, its neighbour and the layout are not", () => {
    const html = render(box, new Set(["inner"]));
    expect(drawn.get("inner")).toBe(true);
    expect(drawn.get("inner-other")).toBe(false);
    expect(drawn.get("box")).toBe(false);
    expect(html.split(LINE)).toHaveLength(2);
    const [frame] = html.split('data-askboard-item="inner-other"');
    expect(frame).toContain(LINE);
    expect(html.slice(html.indexOf('data-askboard-item="inner-other"'))).not.toContain(LINE);
  });

  test("the line is plain text with no focus and no live region, in Italian under an Italian board", () => {
    const html = render(stub("edited"), new Set(["edited"]), "it-IT");
    expect(html).toContain(LINE_IT);
    expect(html).not.toContain(LINE);
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("aria-live");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });
});

describe("the renderer around an item", () => {
  test("hands the component the callbacks of its own item: derived values are kept, and an update naming an item outside the question fails it", () => {
    const shared = context();
    draw({ type: "read-only-reporting", id: "edited", props: {} }, shared);
    expect(shared.derived.reported("edited")).toEqual({ total: 1 });
    expect(shared.tracker.itemStatus("edited")).toBe("failed");
    expect(shared.draft.record().size).toBe(0);
  });

  test("an item whose type no chunk registered fails, as one that throws does", () => {
    expect(() => draw({ type: "read-only-missing", id: "edited", props: {} }, context())).toThrow(
      'no catalog component is registered for the item "edited"',
    );
  });

  test("the error state of a failed item is an alert", () => {
    const html = renderToStaticMarkup(createElement(ItemError));
    expect(html).toContain('role="alert"');
    expect(html).toContain("This item could not be shown.");
  });
});
