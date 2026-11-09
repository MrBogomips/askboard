import { describe, expect, test } from "bun:test";
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
  const press = (key: string, at: number, enabled = [true, true]) => {
    const { log, node } = stub();
    const buttons = { current: [node("comment"), node("suggestion")] };
    let prevented = false;
    toolbarKeys(enabled, at, buttons)({ key, preventDefault: () => (prevented = true) });
    return { log, prevented };
  };

  test("the arrows, Home and End move the focus among the tools and stop at the ends", () => {
    expect(press("ArrowRight", 0)).toEqual({ log: ["suggestion"], prevented: true });
    expect(press("ArrowLeft", 1)).toEqual({ log: ["comment"], prevented: true });
    expect(press("End", 0)).toEqual({ log: ["suggestion"], prevented: true });
    expect(press("Home", 1)).toEqual({ log: ["comment"], prevented: true });
    expect(press("ArrowLeft", 0)).toEqual({ log: ["comment"], prevented: true });
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
