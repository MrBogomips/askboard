import { describe, expect, test } from "bun:test";
import { isTextTarget, keyPressOf } from "./press.ts";

// The port's press reader (keyboard-shortcuts-help, design decision 3; spec: Keys left to the
// browser): a DOM or React event into the contract's `KeyPress`, an input method's key and a text
// field's included.

type Target = {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
  attributes?: Record<string, string>;
};

const target = (fields: Target) => ({
  tagName: fields.tagName,
  type: fields.type,
  isContentEditable: fields.isContentEditable ?? false,
  getAttribute: (name: string) => fields.attributes?.[name] ?? null,
});

const event = (key: string, fields: Record<string, unknown> = {}) => ({
  key,
  keyCode: 0,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  nativeEvent: { isComposing: false },
  target: target({ tagName: "DIV" }),
  ...fields,
});

describe("keyPressOf", () => {
  test("a plain key outside a field", () => {
    expect(keyPressOf(event("ArrowDown"))).toEqual({
      key: "ArrowDown",
      hold: "none",
      composing: false,
      inText: false,
    });
  });

  test("the hold from the modifiers", () => {
    expect(keyPressOf(event("Home", { altKey: true, shiftKey: true })).hold).toBe("alt+shift");
    expect(keyPressOf(event("a", { metaKey: true })).hold).toBe("mod");
    expect(keyPressOf(event("ArrowUp", { ctrlKey: true, shiftKey: true })).hold).toBe("mod+shift");
    expect(keyPressOf(event("ArrowLeft", { altKey: true })).hold).toBe("other");
    expect(keyPressOf(event("a", { ctrlKey: true, metaKey: true })).hold).toBe("other");
  });

  test("composing: isComposing, and the keyCode 229 of an input method's key", () => {
    expect(keyPressOf(event("Enter", { nativeEvent: { isComposing: true } })).composing).toBe(true);
    expect(keyPressOf(event("Enter", { keyCode: 229 })).composing).toBe(true);
    expect(keyPressOf(event("Enter", { keyCode: 13 })).composing).toBe(false);
  });

  test("inText from the target", () => {
    expect(keyPressOf(event("?", { target: target({ tagName: "TEXTAREA" }) })).inText).toBe(true);
    expect(keyPressOf(event("?")).inText).toBe(false);
    expect(keyPressOf(event("?", { target: null })).inText).toBe(false);
  });
});

describe("isTextTarget", () => {
  test("an input that takes text", () => {
    for (const type of [undefined, "text", "search", "email", "url", "tel", "password", "number"]) {
      expect(isTextTarget(target({ tagName: "INPUT", type }))).toBe(true);
    }
  });

  test("an input that takes no text", () => {
    for (const type of ["checkbox", "radio", "button", "submit", "range", "color", "file"]) {
      expect(isTextTarget(target({ tagName: "INPUT", type }))).toBe(false);
    }
  });

  test("a textarea, a contenteditable and a role textbox", () => {
    expect(isTextTarget(target({ tagName: "TEXTAREA" }))).toBe(true);
    expect(isTextTarget(target({ tagName: "DIV", isContentEditable: true }))).toBe(true);
    expect(isTextTarget(target({ tagName: "DIV", attributes: { role: "textbox" } }))).toBe(true);
  });

  test("a button, a div, a grid cell, nothing", () => {
    expect(isTextTarget(target({ tagName: "BUTTON" }))).toBe(false);
    expect(isTextTarget(target({ tagName: "DIV" }))).toBe(false);
    expect(isTextTarget(target({ tagName: "DIV", attributes: { role: "gridcell" } }))).toBe(false);
    expect(isTextTarget(null)).toBe(false);
    expect(isTextTarget({})).toBe(false);
  });
});
