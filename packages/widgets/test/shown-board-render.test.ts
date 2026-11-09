// A Tree, a Gantt and a computing Table only the revision a card shows holds render over the board
// built for that revision, and cannot over the current one (document-review, task 6.19; design
// decision 15). The chunks' entries are imported in a process of their own, as
// `component-facts.test.ts` does: loaded here they would count, unrun, against the files' coverage.
// The components render through the server renderer; what they report ready is a layout effect,
// which the browser scenario `shown-revision-items-session.browser.ts` runs.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const SCRIPT = `
import { TABLE_FIXTURE_ITEM, uj2ExpandedBoardDocument, uj2ExpandedEditedValues } from "@askboard/contract/fixtures";
import { componentFor } from "@askboard/view/catalog";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
await import("./src/tree/index.tsx");
await import("./src/gantt/index.tsx");
await import("./src/table/index.tsx");
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
const [question] = uj2ExpandedBoardDocument.items;
const [wbs, plan] = question.props.items;
const verdict = { type: "approval", id: "verdict", props: {} };
const boardOf = (items, shown) => ({
  items,
  questionItems: new Map([[question.id, items.map((item) => item.id)]]),
  draft: shown,
  shown,
});
const boards = {
  shown: boardOf([wbs, plan, TABLE_FIXTURE_ITEM, verdict], new Map([[plan.id, uj2ExpandedEditedValues[plan.id]]])),
  current: boardOf([verdict], new Map()),
};
const render = (name, item, board) => {
  try {
    const html = renderToStaticMarkup(createElement(componentFor(name), {
      item, questionId: question.id, value: undefined, onValueChange() {}, onValuesChange() {},
      result: undefined, onResultChange() {}, disabled: false, ready() {}, board,
      onDerived() {}, cellEntries: new Map(), onCellEntriesChange() {}, onEntryChange() {},
    }));
    return { rendered: html.startsWith("<div") };
  } catch (error) {
    return { threw: error.message };
  }
};
console.log(JSON.stringify([["tree", wbs], ["gantt", plan], ["table", TABLE_FIXTURE_ITEM]].map(
  ([name, item]) => ({ name, shown: render(name, item, boards.shown), current: render(name, item, boards.current) }),
)));
`;

type Outcome = { rendered?: boolean; threw?: string };

const rendered = async (): Promise<{ name: string; shown: Outcome; current: Outcome }[]> => {
  const child = Bun.spawn([process.execPath, "-e", SCRIPT], {
    cwd: join(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(err);
  return JSON.parse(out);
};

describe("a Tree, a Gantt and a computing Table only revision 1 holds", () => {
  test("render over the board of the revision the card shows", async () => {
    const results = await rendered();
    expect(results.map(({ name }) => name)).toEqual(["tree", "gantt", "table"]);
    for (const { name, shown } of results) expect(shown, name).toEqual({ rendered: true });
  });

  test("throw over the board of the current revision, whose graph holds none of them", async () => {
    const [tree, gantt, table] = await rendered();
    expect(tree?.current.threw).toBe('the board\'s graph holds no work breakdown "wbs__tree"');
    expect(gantt?.current.threw).toContain("refuses its link");
    expect(table?.current.threw).toBe('the board\'s graph holds no Table "costs"');
  });
});
