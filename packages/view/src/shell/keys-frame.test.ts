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

// A table whose entries span the cases of "A read-only Ranking": moves, which need edits, and the
// cursor, selection and panel keys, which do not.
const MOVES_TABLE: readonly KeyEntry[] = [
  vocabularyEntry("cursor.down", "list", "navigation"),
  vocabularyEntry("select.toggle", "list", "pointer", { readOnly: true }),
  vocabularyEntry("move.up", "list", "tool"),
  vocabularyEntry("move.top", "list", "tool"),
  vocabularyEntry("keys.open", "list", "panel"),
];
register("keys-with-moves", Stub, { keys: MOVES_TABLE, name: "change.widgetRanking" });

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

// What the frame says of its item (`data-askboard-keys-edits`) is the flag the renderer gave it;
// the panel (a portal, which the static renderer does not draw) lists by that flag, so each case
// draws the panel's content with the flag read from the frame's own output, never given by the test.
const FLAG = /data-askboard-keys-edits="(true|false)"/;
const listedBy = (type: string, disabled: boolean, readOnlyItems?: ReadonlySet<string>): string => {
  const flag = FLAG.exec(draw(type, disabled, readOnlyItems))?.[1];
  expect(flag).toBeDefined();
  return renderToStaticMarkup(
    createElement(KeysPanelBody, { table: MOVES_TABLE, takesEdits: flag === "true" }),
  );
};

describe("what an item frame lists by the item's state (A read-only Ranking)", () => {
  test("an item neither disabled nor read-only lists the moves", () => {
    const html = listedBy("keys-with-moves", false);
    for (const name of ["Move up", "To top", "Go down", "Select", "Show the keys"]) {
      expect(html).toContain(name);
    }
  });

  test("a read-only item that is not disabled lists no move and its readOnly entries", () => {
    const html = listedBy("keys-with-moves", false, new Set(["x"]));
    expect(html).not.toContain("Move up");
    expect(html).not.toContain("To top");
    expect(html).toContain("Show the keys");
    expect(html).toContain("Select");
  });

  test("an item read-only elsewhere in the board still lists the moves", () => {
    expect(listedBy("keys-with-moves", false, new Set(["other"]))).toContain("Move up");
  });

  test("a disabled item lists no move", () => {
    const html = listedBy("keys-with-moves", true);
    expect(html).not.toContain("Move up");
    expect(html).toContain("Show the keys");
  });
});
