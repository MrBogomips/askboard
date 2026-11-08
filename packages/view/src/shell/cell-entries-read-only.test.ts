// A Table the card makes read-only (table-widget, task 8.3c; keep-mine-shown-revision, design
// decisions 1 and 3): after a reload, on a revision the board cannot show, the Table takes no edit,
// so it takes no cell entry either (`onCellEntriesChange` writes nothing), and "Keep mine" drops
// the cell entries it held, which no longer have a cell to correct and would block "Answer" for
// good (NFR-10, AD-10). The cell entries store reaches `RenderItem` through the same server-safe
// hook as the others.

import { describe, expect, mock, spyOn, test } from "bun:test";
import { plainChoiceBoardDocument, TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type BoardContent,
  type CatalogComponent,
  type ItemProps,
  register,
} from "../catalog/port.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createBoardDraft } from "./board-draft.ts";
import { blockedBy, keepMine } from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { itemCallbacks } from "./item-callbacks.ts";
import { createReadyTracker } from "./ready-tracker.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";

const [asked] = plainChoiceBoardDocument.items;
const ITEMS = [
  structuredClone(TABLE_FIXTURE_ITEM),
  { type: "text-field", id: "name", props: { label: "Name" } },
];
const document = {
  ...plainChoiceBoardDocument,
  items: [{ ...asked, props: { ...asked.props, options: undefined, items: ITEMS } }],
} as unknown as ViewDocument;
const [question] = questionsOf(document) as [ViewQuestion];

const cells = (entries: Record<string, string>): ReadonlyMap<string, string> =>
  new Map(Object.entries(entries));

describe("the cell entries callback of a read-only Table", () => {
  const setUp = (readOnlyItems: ReadonlySet<string>) => {
    const held = createDraftStore();
    const onBeforeChange = mock(() => {});
    const onError = mock((_error: unknown) => {});
    const complaint = spyOn(console, "error").mockImplementation(() => {});
    const { onCellEntriesChange } = itemCallbacks({
      draft: createDraftStore(),
      cellEntries: held,
      cellEntriesAllowed: true,
      itemId: "costs",
      questionId: question.id,
      itemIds: ["costs", "name"],
      readOnlyItems,
      onBeforeChange,
      onError,
    });
    return { held, onBeforeChange, onError, complaint, onCellEntriesChange };
  };

  test("writes nothing, runs no step before a change, fails nothing, and the console names the item", () => {
    const { held, onBeforeChange, onError, complaint, onCellEntriesChange } = setUp(
      new Set(["costs"]),
    );
    onCellEntriesChange(cells({ "pm.rate": "x" }));
    onCellEntriesChange(new Map());
    expect(held.record().size).toBe(0);
    expect(onBeforeChange).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(complaint).toHaveBeenCalledTimes(2);
    expect(String(complaint.mock.calls[0]?.join(" "))).toContain('"costs"');
    complaint.mockRestore();
  });

  test("a Table outside the set holds its cell entries as before", () => {
    const { held, onBeforeChange, complaint, onCellEntriesChange } = setUp(new Set(["name"]));
    onCellEntriesChange(cells({ "pm.rate": "x" }));
    expect([...(held.valueOf("costs") as Map<string, string>)]).toEqual([["pm.rate", "x"]]);
    expect(onBeforeChange).toHaveBeenCalledTimes(1);
    expect(complaint).not.toHaveBeenCalled();
    complaint.mockRestore();
  });
});

describe("Keep mine on a read-only Table", () => {
  const setUp = () => {
    const sent: ViewMessage[] = [];
    const channel: ViewChannel = {
      send: async (message) => {
        sent.push(message);
        return { outcome: "sent", actionId: "AAAAAAAAAAAAAAAAAAAAAA" };
      },
      onUpdate: () => () => {},
      onTheme: () => () => {},
    };
    const draft = createDraftStore();
    const entries = createDraftStore();
    const cellEntries = createDraftStore();
    const board = createBoardDraft("immediate");
    board.edit(question.id, 1, () => ({ rev: 1 }));
    const context = {
      channel,
      acts: createAnswerActs(),
      draft,
      results: createDraftStore(),
      entries,
      cellEntries,
      board,
      derived: createDerivedStore(),
      delivery: "immediate" as const,
      facts: () => undefined,
    };
    return { sent, draft, entries, cellEntries, context };
  };
  // The page reloaded after the agent's change: it shows the current revision, 2, while the work
  // was made on revision 1.
  const current = { ...question, rev: 2 };

  test("drops the held cell entries of a Table in the read-only set, and Answer is no longer blocked", () => {
    const { cellEntries, context, sent } = setUp();
    cellEntries.set("costs", cells({ "pm.rate": "x", "dev.days": "y" }));
    expect(blockedBy(current, context)).toBe(true);
    keepMine(current, context, current, new Set(["costs"]));
    expect(cellEntries.record().has("costs")).toBe(false);
    expect(blockedBy(current, context)).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ acts: [{ edit: "ignore", keptRev: 1 }] });
  });

  test("keeps the cell entries of a Table outside the set", () => {
    const { cellEntries, context } = setUp();
    cellEntries.set("costs", cells({ "pm.rate": "x" }));
    keepMine(current, context, current, new Set(["name"]));
    expect([...(cellEntries.valueOf("costs") as Map<string, string>)]).toEqual([["pm.rate", "x"]]);
  });

  test("with no set given, nothing is read-only", () => {
    const { cellEntries, context } = setUp();
    cellEntries.set("costs", cells({ "pm.rate": "x" }));
    keepMine(current, context, current);
    expect(cellEntries.valueOf("costs")).toBeDefined();
  });
});

// `RenderItem` server-rendered with a cell entries store given: `useSyncExternalStore` needs the
// server snapshot for it as for the other stores, else React throws "Missing getServerSnapshot".
const seen: (ReadonlyMap<string, string> | undefined)[] = [];
const Reading: CatalogComponent = ({ cellEntries }: ItemProps) => {
  seen.push(cellEntries);
  return createElement("span", null, "reading");
};
register("cell-entries-reading", Reading);

describe("a cell entries store drawn on the server", () => {
  test("the item gets the held cells and the render does not throw", () => {
    const board: BoardContent = { items: [], draft: new Map(), shown: new Map() };
    const cellEntries = createDraftStore();
    cellEntries.set("held", cells({ "pm.rate": "x" }));
    const context: RenderContext = {
      draft: createDraftStore(),
      tracker: createReadyTracker([{ questionId: "q", itemIds: ["held"] }], {
        onVisible: () => {},
        onFailed: () => {},
      }),
      boardContent: () => board,
      derived: createDerivedStore(),
      cellEntries,
    };
    const html = renderToStaticMarkup(
      createElement(RenderItem, {
        item: { type: "cell-entries-reading", id: "held", props: {} },
        component: "cell-entries-reading",
        questionId: "q",
        itemIds: ["held"],
        context,
        disabled: false,
      }),
    );
    expect(html).toContain("reading");
    expect([...(seen.at(-1) ?? [])]).toEqual([["pm.rate", "x"]]);
  });
});
