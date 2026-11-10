import { describe, expect, test } from "bun:test";
import type { Modifiers } from "@askboard/contract";
import { MODIFIED_FLAGS, NO_MODIFIER } from "../../test/key-presses.ts";
import { holdStop, keepSelection, pressTool, recordTool, toolbarKeys } from "./frame-handlers.ts";

// The toolbar's handlers (view-and-widgets spec: A Document review at the keyboard; design decision
// 9), without a DOM.
const stub = () => {
  const log: string[] = [];
  return {
    log,
    node: (name: string) => ({
      focus: () => {
        log.push(name);
      },
    }),
  };
};

describe("recordTool", () => {
  test("records the node at its place and clears it when React hands none", () => {
    const buttons: { current: ({ focus(): void } | null)[] } = { current: [] };
    const node = stub().node("a");
    recordTool(buttons, 1)(node);
    expect(buttons.current[1]).toBe(node);
    recordTool(buttons, 1)(null);
    expect(buttons.current[1]).toBeNull();
  });
});

describe("toolbarKeys", () => {
  const press = (
    key: string,
    at: number,
    enabled = [true, true],
    held: Partial<Modifiers> = {},
  ) => {
    const { log, node } = stub();
    const buttons = { current: [node("comment"), node("suggestion")] };
    let prevented = false;
    toolbarKeys(
      enabled,
      at,
      buttons,
    )({
      key,
      keyCode: 0,
      target: null,
      ...NO_MODIFIER,
      ...held,
      preventDefault: () => (prevented = true),
    });
    return { log, prevented };
  };

  test("the arrows, Home and End move the focus among the tools and stop at the ends", () => {
    expect(press("ArrowRight", 0)).toEqual({ log: ["suggestion"], prevented: true });
    expect(press("ArrowLeft", 1)).toEqual({ log: ["comment"], prevented: true });
    expect(press("End", 0)).toEqual({ log: ["suggestion"], prevented: true });
    expect(press("Home", 1)).toEqual({ log: ["comment"], prevented: true });
    expect(press("ArrowLeft", 0)).toEqual({ log: ["comment"], prevented: true });
  });

  test("a key with any modifier held is left to the browser, its default not prevented", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      for (const flags of MODIFIED_FLAGS) {
        expect({ key, flags, ...press(key, 0, [true, true], flags) }).toEqual({
          key,
          flags,
          log: [],
          prevented: false,
        });
      }
    }
  });

  test("a key an input method composes is left alone", () => {
    const { log, node } = stub();
    let prevented = false;
    toolbarKeys([true, true], 0, { current: [node("comment"), node("suggestion")] })({
      key: "ArrowRight",
      keyCode: 0,
      target: null,
      ...NO_MODIFIER,
      nativeEvent: { isComposing: true },
      preventDefault: () => (prevented = true),
    });
    expect({ log, prevented }).toEqual({ log: [], prevented: false });
  });

  test("another key is left alone", () => {
    expect(press("Enter", 0)).toEqual({ log: [], prevented: false });
    expect(press("ArrowDown", 0)).toEqual({ log: [], prevented: false });
  });
});

describe("keepSelection, holdStop and pressTool", () => {
  test("a mousedown is prevented, so that the selection stays", () => {
    let prevented = false;
    keepSelection({ preventDefault: () => (prevented = true) });
    expect(prevented).toBe(true);
  });

  test("the focused tool takes the stop, and a press runs its tool", () => {
    const stops: number[] = [];
    holdStop((place) => stops.push(place), 1)();
    expect(stops).toEqual([1]);
    const pressed: string[] = [];
    pressTool("comment", (tool) => pressed.push(tool))();
    expect(pressed).toEqual(["comment"]);
  });
});
