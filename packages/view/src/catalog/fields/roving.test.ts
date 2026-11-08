import { describe, expect, test } from "bun:test";
import { nextFocus, type RadioGroupState, radioAt, radioTabStop } from "./roving.ts";

describe("nextFocus (EXPERIENCE.md, Keyboard core: the arrow keys move focus through the options)", () => {
  test("the arrow keys move focus through the boxes, wrapping; Home and End jump", () => {
    expect(nextFocus("ArrowDown", 0, 3)).toBe(1);
    expect(nextFocus("ArrowRight", 2, 3)).toBe(0);
    expect(nextFocus("ArrowUp", 0, 3)).toBe(2);
    expect(nextFocus("ArrowLeft", 1, 3)).toBe(0);
    expect(nextFocus("Home", 2, 3)).toBe(0);
    expect(nextFocus("End", 0, 3)).toBe(2);
    expect(nextFocus("Enter", 1, 3)).toBeUndefined();
    expect(nextFocus("ArrowDown", 0, 0)).toBeUndefined();
  });

  test("a key named like an inherited object member moves nothing", () => {
    expect(nextFocus("constructor", 0, 3)).toBeUndefined();
    expect(nextFocus("toString", 0, 3)).toBeUndefined();
  });
});

describe("radioTabStop (view-and-widgets spec: Radios with manual activation, Tab enters on the checked radio)", () => {
  test("the checked radio is the tab stop", () => {
    expect(radioTabStop(2, 4)).toBe(2);
  });

  test("with none checked, the first radio is", () => {
    expect(radioTabStop(undefined, 4)).toBe(0);
  });

  test("an empty group has none", () => {
    expect(radioTabStop(undefined, 0)).toBeUndefined();
    expect(radioTabStop(0, 0)).toBeUndefined();
  });

  test("a checked index outside the group falls back to the first radio", () => {
    expect(radioTabStop(7, 4)).toBe(0);
    expect(radioTabStop(-1, 4)).toBe(0);
  });
});

type Calls = { readonly checks: number[]; readonly focuses: number[] };

const stub = (state: Partial<RadioGroupState> = {}): { group: RadioGroupState; calls: Calls } => {
  const calls: Calls = { checks: [], focuses: [] };
  const group: RadioGroupState = {
    count: 4,
    checked: undefined,
    disabled: false,
    onCheck: (index) => calls.checks.push(index),
    focus: (index) => calls.focuses.push(index),
    ...state,
  };
  return { group, calls };
};

const key = (name: string) => {
  const event = { key: name, prevented: false, preventDefault: () => {} };
  event.preventDefault = () => {
    event.prevented = true;
  };
  return event;
};

describe("radioAt's attributes", () => {
  test("an unchecked radio is a button with the radio role, unchecked and off the tab order", () => {
    const { group } = stub({ checked: 0 });
    const radio = radioAt(2, group);
    expect(radio.type).toBe("button");
    expect(radio.role).toBe("radio");
    expect(radio["aria-checked"]).toBe(false);
    expect(radio["data-state"]).toBe("unchecked");
    expect(radio["data-disabled"]).toBeUndefined();
    expect(radio.disabled).toBe(false);
    expect(radio.tabIndex).toBe(-1);
  });

  test("the checked radio shows its state and is the tab stop", () => {
    const radio = radioAt(2, stub({ checked: 2 }).group);
    expect(radio["aria-checked"]).toBe(true);
    expect(radio["data-state"]).toBe("checked");
    expect(radio.tabIndex).toBe(0);
  });

  test("with none checked the first radio is the tab stop and no other is", () => {
    const { group } = stub();
    expect(radioAt(0, group).tabIndex).toBe(0);
    expect(radioAt(1, group).tabIndex).toBe(-1);
    expect(radioAt(3, group).tabIndex).toBe(-1);
  });

  test("a disabled group disables each radio, keeps its checked state and has no tab stop", () => {
    const { group } = stub({ checked: 1, disabled: true });
    const radio = radioAt(1, group);
    expect(radio.disabled).toBe(true);
    expect(radio["data-disabled"]).toBe("");
    expect(radio["aria-checked"]).toBe(true);
    expect(radio["data-state"]).toBe("checked");
    expect(radio.tabIndex).toBe(-1);
    expect(radioAt(0, group).tabIndex).toBe(-1);
  });
});

describe("radioAt's keys (WAI-ARIA radio group in a toolbar: the arrow keys move the focus only)", () => {
  test.each([
    ["ArrowDown", 1, 2],
    ["ArrowRight", 1, 2],
    ["ArrowUp", 1, 0],
    ["ArrowLeft", 1, 0],
    ["ArrowDown", 3, 0],
    ["ArrowUp", 0, 3],
    ["Home", 2, 0],
    ["End", 1, 3],
  ])(
    "%s on radio %i moves the focus to radio %i, prevents its default and checks nothing",
    (name, from, to) => {
      const { group, calls } = stub({ checked: 1 });
      const event = key(name);
      radioAt(from, group).onKeyDown(event);
      expect(event.prevented).toBe(true);
      expect(calls.focuses).toEqual([to]);
      expect(calls.checks).toEqual([]);
    },
  );

  test.each(["Space", " ", "Enter", "Tab", "a", "Escape"])(
    "%j is left to the button: no focus move, no check, no prevented default",
    (name) => {
      const { group, calls } = stub();
      const event = key(name);
      radioAt(0, group).onKeyDown(event);
      expect(event.prevented).toBe(false);
      expect(calls.focuses).toEqual([]);
      expect(calls.checks).toEqual([]);
    },
  );
});

describe("radioAt's click (Space and Enter reach it through the button's own activation)", () => {
  test("a click on an unchecked radio checks it once", () => {
    const { group, calls } = stub({ checked: 0 });
    radioAt(2, group).onClick();
    expect(calls.checks).toEqual([2]);
  });

  test("a click on the checked radio changes nothing", () => {
    const { group, calls } = stub({ checked: 2 });
    radioAt(2, group).onClick();
    expect(calls.checks).toEqual([]);
  });

  test("a click with nothing checked checks that radio", () => {
    const { group, calls } = stub();
    radioAt(0, group).onClick();
    expect(calls.checks).toEqual([0]);
  });
});
