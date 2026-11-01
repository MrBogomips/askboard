import { describe, expect, test } from "bun:test";
import { treeKeyOf } from "./key-event.ts";

const keydown = (fields: Partial<Parameters<typeof treeKeyOf>[0]>) => ({
  key: "Enter",
  keyCode: 13,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  nativeEvent: { isComposing: false },
  ...fields,
});

describe("treeKeyOf", () => {
  test("the key and its modifiers, as the model's keyAction reads them", () => {
    expect(
      treeKeyOf(keydown({ key: "ArrowUp", keyCode: 38, altKey: true, shiftKey: true })),
    ).toEqual({
      key: "ArrowUp",
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      isComposing: false,
    });
  });

  test("a key while an input method composes", () => {
    expect(treeKeyOf(keydown({ nativeEvent: { isComposing: true } })).isComposing).toBe(true);
  });

  test("WebKit's Enter that confirms an input method's candidate, after compositionend: keyCode 229", () => {
    expect(treeKeyOf(keydown({ keyCode: 229 })).isComposing).toBe(true);
  });
});
