import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KeyOverridesContext } from "../catalog/keys/key-table.tsx";
import { LanguageContext } from "../catalog/port.ts";
import { BoardKeysPanelBody, type BoardPanel, useBoardPanel } from "./board-keys-panel.tsx";

// The board's keys panel's body (board-keys, design decision 5; spec: The board's keys panel).

const draw = (
  takesEdits: boolean,
  language: "en-US" | "it-IT" = "en-US",
  overrides?: Record<string, readonly string[]>,
) =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: language },
      createElement(
        KeyOverridesContext.Provider,
        { value: overrides },
        createElement(BoardKeysPanelBody, { takesEdits }),
      ),
    ),
  );

describe("the board's panel body", () => {
  test("the title and the note, in both languages", () => {
    const en = draw(true);
    expect(en).toContain("Board keys");
    expect(en).toContain("Sending all held answers has no key.");
    const it = draw(true, "it-IT");
    expect(it).toContain("Tasti della board");
    expect(it).toContain("non ha tasto");
  });

  test("the groups: Questions with the four actions, then Other with the keys panel", () => {
    const html = draw(true);
    const questions = html.indexOf('data-askboard-keys-group="board"');
    const other = html.indexOf('data-askboard-keys-group="other"');
    expect(questions).toBeGreaterThan(-1);
    expect(other).toBeGreaterThan(questions);
    for (const name of [
      "Next to do",
      "Previous open",
      "Answer the question in focus",
      "Send the follow-up",
    ]) {
      expect(html.indexOf(name)).toBeGreaterThan(questions);
      expect(html.indexOf(name)).toBeLessThan(other);
    }
    expect(html).toContain("Show the keys");
  });

  test("the customised mark and no key", () => {
    const html = draw(true, "en-US", { "board.nextOpen": ["j"], "board.answer": [] });
    expect(html).toContain("customised");
    expect(html).toContain(">J</kbd>");
    expect(html).toContain("no key");
  });

  test("with no edits, only the navigation keys", () => {
    const html = draw(false);
    expect(html).toContain("Next to do");
    expect(html).toContain("Previous open");
    expect(html).toContain("Show the keys");
    expect(html).not.toContain("Answer the question in focus");
    expect(html).not.toContain("Send the follow-up");
  });

  test("it holds nothing of the agent's: no markup but the panel's own", () => {
    const html = draw(true);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });
});

let caught: BoardPanel | undefined;
const Probe = () => {
  caught = useBoardPanel();
  return null;
};

describe("useBoardPanel", () => {
  const held = (): BoardPanel => {
    caught = undefined;
    renderToStaticMarkup(createElement(Probe));
    if (caught === undefined) throw new Error("the hook did not run");
    return caught;
  };

  test("starts closed; opening it records the element that had the focus and anchors by it", () => {
    const panel = held();
    expect(panel.open).toBe(false);
    const from = { focus: () => {} } as unknown as HTMLElement;
    panel.opening(from);
    expect(panel.elements.opener.current).toBe(from);
    expect(panel.elements.anchor.current).toBe(from);
  });

  test("the control opens from the Keys button, and anchors by the element it is given", () => {
    const panel = held();
    const button = { focus: () => {} } as unknown as HTMLElement;
    panel.control.anchor(button);
    panel.control.open();
    expect(panel.elements.opener.current).toBe(button);
    expect(panel.elements.anchor.current).toBe(button);
  });
});
