import { describe, expect, test } from "bun:test";
import { type KeyEntry, ownEntry, vocabularyEntry } from "@askboard/contract";
import { Tooltip } from "radix-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type BoardContent, KeysButton, LanguageContext, register } from "../catalog/port.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { KeysPanelBody } from "./keys-panel.tsx";
import { createReadyTracker } from "./ready-tracker.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";

// The item frame's keys panel (keyboard-shortcuts-help, design decision 5; spec: The keys panel):
// the Keys button reaches the frame of a type that registered a key table and nothing else, and the
// panel lists board strings only, by group, an item that takes no edits listing what still acts.
// Opening, focus and Escape are the browser files' (`keys-help.browser.ts`).

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const TABLE: readonly KeyEntry[] = [
  vocabularyEntry("cursor.down", "list", "navigation"),
  vocabularyEntry("move.up", "list", "tool"),
  vocabularyEntry("select.toggle", "list", "pointer", { readOnly: true }),
  ownEntry("probe.menu", "toolbar", [], "menu", { readOnly: true, label: "kanban.moveTo" }),
];

const Stub = () => createElement(KeysButton);

register("keys-with-table", Stub, { keys: TABLE, name: "change.widgetRanking" });
register("keys-with-table-unnamed", Stub, { keys: TABLE });
register("keys-without-table", Stub);

const draw = (type: string, disabled = false, readOnlyItems?: ReadonlySet<string>) => {
  const board: BoardContent = { items: [], draft: new Map(), shown: new Map() };
  const context: RenderContext = {
    draft: createDraftStore(),
    tracker: createReadyTracker([{ questionId: "q", itemIds: ["x"] }], {
      onVisible: () => {},
      onFailed: () => {},
    }),
    boardContent: () => board,
    derived: createDerivedStore(),
  };
  return renderToStaticMarkup(
    createElement(
      Tooltip.Provider,
      null,
      createElement(RenderItem, {
        item: { type, id: "x", props: {} },
        component: type,
        questionId: "q",
        itemIds: ["x"],
        context,
        disabled,
        ...(readOnlyItems === undefined ? {} : { readOnlyItems }),
      }),
    ),
  );
};

describe("the item frame of a type with a key table", () => {
  test("gives its widget the Keys button", () => {
    const html = draw("keys-with-table");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain(">Keys</button>");
  });

  test("a type with no table has no panel, so the Keys button draws nothing", () => {
    expect(draw("keys-without-table")).not.toContain(">Keys</button>");
  });

  test("the panel is closed until it is asked for", () => {
    expect(draw("keys-with-table")).not.toContain('role="dialog"');
  });

  test("a locked or read-only item still has its Keys button", () => {
    expect(draw("keys-with-table", true)).toContain(">Keys</button>");
    expect(draw("keys-with-table", false, new Set(["x"]))).toContain(">Keys</button>");
  });
});

const body = (takesEdits: boolean, language: "en-US" | "it-IT" = "en-US") =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: language },
      createElement(KeysPanelBody, { table: TABLE, takesEdits }),
    ),
  );

describe("the panel's content", () => {
  test("lists each entry that has keys by group, with its key caps", () => {
    const html = body(true);
    expect(html).toContain("Move around");
    expect(html).toContain("Go down");
    expect(html).toContain("Move items");
    expect(html).toContain("Move up");
    expect(html).toContain("<kbd");
    expect(html).toContain("Alt+Shift+↑");
  });

  test("leaves a keyless entry out", () => {
    expect(body(true)).not.toContain("Move to…");
  });

  test("an item that takes no edits lists only the entries that still act", () => {
    const html = body(false);
    expect(html).toContain("Go down");
    expect(html).toContain("Select");
    expect(html).not.toContain("Move up");
  });

  test("is in the board's language", () => {
    const html = body(true, "it-IT");
    expect(html).toContain("Spostarsi");
    expect(html).toContain("Vai giù");
  });

  test("every row's name is a board string: the panel takes a table and a flag, nothing the agent sent", () => {
    // The browser file draws a probe item whose label is `<b>x</b>` and `?` and checks the open panel.
    const html = body(true);
    const names = [...html.matchAll(/<span>([^<]*)<\/span><span class/g)].map((m) => m[1]);
    expect(names).toEqual(["Go down", "Select", "Move up"]);
  });
});
