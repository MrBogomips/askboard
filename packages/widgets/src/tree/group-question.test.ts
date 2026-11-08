import { describe, expect, test } from "bun:test";
import { createElement, type KeyboardEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QUESTION_ROW } from "./classes.ts";
import { DeleteQuestion } from "./delete-question.tsx";
import { GroupQuestion, questionKeyDown } from "./group-question.tsx";
import type { GroupQuestion as Question } from "./grouping.ts";
import { TreeToolbar } from "./toolbar.tsx";

// The question before a leaf becomes a group (view spec, Making a work package a group asks first,
// The group question's words, Answering the group question; design decision 2). The server renderer
// draws it; the focus on "Cancel", Escape on the page and the drop, indent and "Add child" that
// ask are in the browser (wbs-linking.browser.ts), which has the DOM they need.
Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const PORTAL: Question = { label: "Customer portal", estimates: true, task: true, dependents: 1 };
const NONE = () => {};

// The ask's language is the shell's to provide (a context the catalog entry does not export), so the
// component is drawn in en-US; the Italian words and buttons are checked in `grouping-words.test.ts`
// and `italian.test.ts`, and in the browser.
const within = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);

const draw = (question: Question) =>
  within(createElement(GroupQuestion, { question, onConfirm: NONE, onCancel: NONE }));

describe("the group question", () => {
  test("is a fieldset named by its words, which are the leaf's name and what leaves with it", () => {
    const html = draw(PORTAL);
    const id = /<p id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`<fieldset aria-labelledby="${id}" class="${QUESTION_ROW}">`);
    const words = html.replace(/<[^>]+>/g, "");
    expect(words).toContain(
      "“Customer portal” becomes a group: its estimates leave the totals while it has children, and its task leaves the plan. 1 task in the plan depends on it.",
    );
  });

  test("offers Cancel first and then Continue", () => {
    const html = draw(PORTAL);
    expect([...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])).toEqual([
      "Cancel",
      "Continue",
    ]);
    expect(html.match(/type="button"/g)).toHaveLength(2);
  });

  test("shows the agent's label as text, never as markup (AD-8)", () => {
    const html = draw({ ...PORTAL, label: "<b>Portal</b> <img src=x onerror=1>" });
    expect(html).toContain("“&lt;b&gt;Portal&lt;/b&gt; &lt;img src=x onerror=1&gt;”");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<img");
  });

  test("says nothing of a plan for a work breakdown no plan names", () => {
    const html = draw({ ...PORTAL, task: false, dependents: 0 });
    expect(html).toContain("its estimates leave the totals while it has children.");
    expect(html).not.toContain("plan");
  });
});

const keyEvent = (key: string, extra: Partial<Record<string, unknown>> = {}) => {
  const seen = { prevented: 0 };
  const event = {
    key,
    keyCode: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => {
      seen.prevented += 1;
    },
    ...extra,
  } as unknown as KeyboardEvent<HTMLFieldSetElement>;
  return { event, seen };
};

describe("Escape on the group question", () => {
  test("is Cancel", () => {
    let cancelled = 0;
    const { event, seen } = keyEvent("Escape");
    questionKeyDown(() => {
      cancelled += 1;
    })(event);
    expect(cancelled).toBe(1);
    expect(seen.prevented).toBe(1);
  });

  test("leaves every other key, and an input method's Escape, to the buttons", () => {
    let cancelled = 0;
    const onKeyDown = questionKeyDown(() => {
      cancelled += 1;
    });
    for (const { event, seen } of [
      keyEvent("Enter"),
      keyEvent(" "),
      keyEvent("Tab"),
      keyEvent("Escape", { nativeEvent: { isComposing: true } }),
    ]) {
      onKeyDown(event);
      expect(seen.prevented).toBe(0);
    }
    expect(cancelled).toBe(0);
  });
});

const toolbar = (asking: Parameters<typeof TreeToolbar>[0]["asking"]) =>
  within(
    createElement(TreeToolbar, {
      ref: null,
      enabled: [true, true, true, true, true, true, true],
      onTool: NONE,
      asking,
      changes: 0,
      selecting: {
        selection: new Set<string>(),
        value: { nodes: [{ id: "a", label: "A" }] },
        disabled: false,
        onSelectAll: NONE,
        onSelectNone: NONE,
        onApply: NONE,
        onUndo: undefined,
      },
    }),
  );

describe("the Tree's toolbar row while a question is asked", () => {
  test("shows the tools when none is", () => {
    const html = toolbar(undefined);
    expect(html).toContain('role="toolbar"');
    expect(html).not.toContain("<fieldset");
  });

  test("shows the group question in place of the tools", () => {
    const html = toolbar({
      kind: "group",
      key: "group:portal",
      question: PORTAL,
      onConfirm: NONE,
      onCancel: NONE,
    });
    expect(html).toContain("becomes a group:");
    expect(html).not.toContain('role="toolbar"');
    expect(html.match(/<fieldset/g)).toHaveLength(1);
  });

  test("shows the delete question alone, never both", () => {
    const html = toolbar({
      kind: "delete",
      key: "delete:build",
      question: { label: "Build", under: 3, dependents: 0 },
      onConfirm: NONE,
      onCancel: NONE,
    });
    expect(html).toContain("will be deleted");
    expect(html).not.toContain("becomes a group");
    expect(html).not.toContain('role="toolbar"');
    expect(html.match(/<fieldset/g)).toHaveLength(1);
    expect(DeleteQuestion).toBeDefined();
  });
});

// The widget's pending edit is view state with no DOM here; the drop, indent, "Add child", Cancel
// and Escape run in the browser (wbs-linking.browser.ts). What a unit can pin is where the question
// sits in the paths the edits take, as the drag's own tests do.
const source = (path: string): Promise<string> => Bun.file(new URL(path, import.meta.url)).text();

describe("the widget's pending edit", () => {
  test("a drop asks before it moves anything, and a confirmed one re-decides the drop on the value as it is", async () => {
    const widget = await source("./widget.tsx");
    const body = widget.slice(
      widget.indexOf("const dropRow"),
      widget.indexOf("// The events every row"),
    );
    expect(body.indexOf("askGroup(")).toBeGreaterThan(0);
    expect(body.indexOf("askGroup(")).toBeLessThan(body.indexOf("change(moved.value)"));
    expect(body).toContain("!confirmed");
    expect(widget).toContain("dropRow(edit.nodeId, edit.drop.targetId, INTO, true)");
  });

  test("an indent and an Add child ask before the edit, and a confirmed one acts on the node it was asked of", async () => {
    const widget = await source("./widget.tsx");
    expect(widget).toContain("groupEditOf(edit, nodeId)");
    expect(widget).toContain("perform(edit.kind, edit.nodeId, from)");
    expect(widget).toContain("add(edit, anchorOf(view, nodeId))");
  });

  test("the question is view state: nothing in it reaches the draft", async () => {
    const widget = await source("./widget.tsx");
    const body = widget.slice(widget.indexOf("const askGroup"), widget.indexOf("const act ="));
    expect(body).toContain("setAsked(");
    expect(body).not.toContain("onValueChange");
    expect(body).not.toContain("change(");
  });

  test("a drag's end leaves the focus on a group question's Cancel", async () => {
    const widget = await source("./widget.tsx");
    expect(widget).toContain('if (asked?.kind !== "group") focus.moveFocusTo("grid")');
  });

  test("the Tree tells the widget whether a plan names it", async () => {
    expect(await source("./index.tsx")).toContain(
      "planned={linkedPlans(board, item.id).length > 0}",
    );
  });
});
