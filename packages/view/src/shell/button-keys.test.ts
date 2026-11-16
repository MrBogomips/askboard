import { describe, expect, test } from "bun:test";
import { BOARD_KEYS, type KeyEntry } from "@askboard/contract";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { keyTableOf } from "../catalog/keys/effective.ts";
import { KEY_CAP } from "../catalog/keys/key-help.tsx";
import { LanguageContext } from "../catalog/port.ts";
import { ButtonKeys } from "./button-keys.tsx";

// The key caps inside the header's "Next to do" and a question's primary button (answering-flow-
// visual, design decision 10; spec: Key caps on the board's main controls): the first combination of
// the entry in effect, `aria-hidden`, nothing for an entry with no keys.
const inEffect = (overrides?: Record<string, readonly string[]>) =>
  keyTableOf(BOARD_KEYS as readonly KeyEntry[], overrides);
const entryOf = (action: string, overrides?: Record<string, readonly string[]>) =>
  inEffect(overrides).find((entry) => entry.action === action);

const draw = (
  entry: ReturnType<typeof entryOf>,
  platform: "mac" | "other" | undefined = undefined,
) =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: "en-US" },
      createElement(ButtonKeys, { entry, ...(platform === undefined ? {} : { platform }) }),
    ),
  );

describe("ButtonKeys", () => {
  test("draws the first key of next open as a cap, hidden from assistive technology", () => {
    const html = draw(entryOf("board.nextOpen"), "other");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`class="${KEY_CAP}"`);
    expect(html).toMatch(/<kbd[^>]*>N<\/kbd>/);
  });

  test("draws the answer key as macOS and as Linux write it", () => {
    expect(draw(entryOf("board.answer"), "mac")).toMatch(/<kbd[^>]*>⌘↩<\/kbd>/);
    expect(draw(entryOf("board.answer"), "other")).toMatch(/<kbd[^>]*>Ctrl\+Enter<\/kbd>/);
  });

  test("draws the user's key at once, and only the first of several", () => {
    expect(draw(entryOf("board.nextOpen", { "board.nextOpen": ["j", "k"] }), "other")).toMatch(
      /<kbd[^>]*>J<\/kbd>/,
    );
    expect([
      ...draw(entryOf("board.nextOpen", { "board.nextOpen": ["j", "k"] }), "other").matchAll(
        /<kbd/g,
      ),
    ]).toHaveLength(1);
  });

  test("draws nothing for an action the user's file left without a key, and for no entry", () => {
    expect(draw(entryOf("board.answer", { "board.answer": [] }), "mac")).toBe("");
    expect(draw(undefined, "mac")).toBe("");
  });
});
