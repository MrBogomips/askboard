import { describe, expect, test } from "bun:test";
import { buttonRefOf, clickOf, type KeysPanelControl } from "./keys-button.ts";

// The Keys button's wiring (keyboard-shortcuts-help, design decision 5): its element reaches the
// frame beside the caller's ref, and a click opens the panel after the caller's handler.

const panel = () => {
  const log: string[] = [];
  const control: KeysPanelControl = {
    open: () => log.push("open"),
    anchor: (element) => log.push(element === null ? "anchor null" : "anchor element"),
  };
  return { control, log };
};

const button = {} as HTMLButtonElement;

describe("buttonRefOf", () => {
  test("tells the frame the element and a function ref after it", () => {
    const { control, log } = panel();
    const forwarded = (element: HTMLButtonElement | null): void => {
      log.push(element === null ? "ref null" : "ref element");
    };
    buttonRefOf(control, forwarded)(button);
    expect(log).toEqual(["anchor element", "ref element"]);
  });

  test("sets an object ref", () => {
    const { control } = panel();
    const ref = { current: null as HTMLButtonElement | null };
    buttonRefOf(control, ref)(button);
    expect(ref.current).toBe(button);
    buttonRefOf(control, ref)(null);
    expect(ref.current).toBeNull();
  });

  test("with no ref of the caller's only the frame hears it", () => {
    const { control, log } = panel();
    buttonRefOf(control, undefined)(null);
    buttonRefOf(control, null)(button);
    expect(log).toEqual(["anchor null", "anchor element"]);
  });
});

describe("clickOf", () => {
  test("the caller's handler first, then the panel opens", () => {
    const { control, log } = panel();
    clickOf(control, (event: string) => log.push(`click ${event}`))("e");
    expect(log).toEqual(["click e", "open"]);
  });

  test("without a handler the panel opens", () => {
    const { control, log } = panel();
    clickOf<string>(control, undefined)("e");
    expect(log).toEqual(["open"]);
  });
});
