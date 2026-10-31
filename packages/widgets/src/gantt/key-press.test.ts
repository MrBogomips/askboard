import { describe, expect, test } from "bun:test";
import { keyPressOf } from "./key-press.ts";

const event = (key: string, fields: Partial<Parameters<typeof keyPressOf>[0]> = {}) => ({
  key,
  keyCode: 0,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  nativeEvent: { isComposing: false },
  ...fields,
});

describe("a key event as the Gantt's keys read it", () => {
  test("gives the key and its modifiers", () => {
    expect(keyPressOf(event("ArrowDown"))).toEqual({
      key: "ArrowDown",
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    });
    expect(keyPressOf(event("Home", { ctrlKey: true, shiftKey: true }))).toMatchObject({
      ctrlKey: true,
      shiftKey: true,
    });
  });

  test("is no key of the Gantt's while an input method composes", () => {
    expect(keyPressOf(event("Enter", { nativeEvent: { isComposing: true } }))).toBeUndefined();
    // WebKit sends the Enter that confirms a candidate after compositionend, with keyCode 229.
    expect(keyPressOf(event("Enter", { keyCode: 229 }))).toBeUndefined();
  });
});
