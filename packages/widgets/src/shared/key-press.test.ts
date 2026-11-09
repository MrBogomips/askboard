import { describe, expect, test } from "bun:test";
import { FLAG_SETS, NO_MODIFIER } from "../../test/key-presses.ts";
import { pressOfEvent } from "./key-press.ts";

// A keyboard event as a KeyPress (keyboard-shortcuts-help, design decision 7): the key, the hold
// the four modifiers make, and whether an input method is composing.
describe("pressOfEvent", () => {
  test("reads the key and the hold of every set of modifiers", () => {
    const holds = FLAG_SETS.map((flags) => pressOfEvent({ key: "a", ...flags }).hold);
    expect(holds[0]).toBe("none");
    expect(new Set(holds)).toEqual(
      new Set(["none", "shift", "alt+shift", "mod", "mod+shift", "other"]),
    );
    expect(pressOfEvent({ key: "ArrowLeft", ...NO_MODIFIER, altKey: true })).toEqual({
      key: "ArrowLeft",
      hold: "other",
      composing: false,
      inText: false,
    });
  });

  test("an input method's key is composing: isComposing, or the keyCode 229", () => {
    expect(
      pressOfEvent({ key: "Enter", ...NO_MODIFIER, nativeEvent: { isComposing: true } }).composing,
    ).toBe(true);
    expect(pressOfEvent({ key: "Enter", ...NO_MODIFIER, keyCode: 229 }).composing).toBe(true);
    expect(
      pressOfEvent({
        key: "Enter",
        ...NO_MODIFIER,
        keyCode: 13,
        nativeEvent: { isComposing: false },
      }).composing,
    ).toBe(false);
  });

  test("says whether the target is a text field", () => {
    expect(pressOfEvent({ key: "a", ...NO_MODIFIER }, true).inText).toBe(true);
  });
});
