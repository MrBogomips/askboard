import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useRadios } from "./radios.ts";

type Radio = ReturnType<ReturnType<typeof useRadios>>;

type Capture = { radio?: (index: number) => Radio };

type GroupProps = {
  readonly capture: Capture;
  readonly checked: number | undefined;
  readonly onCheck: (index: number) => void;
};

const Group = ({ capture, checked, onCheck }: GroupProps) => {
  capture.radio = useRadios({ count: 3, checked, disabled: false, onCheck });
  return null;
};

/** Draws a group once and hands back its `radio` function, as a component would hold it. */
const drawn = (checked: number | undefined, onCheck: (index: number) => void = () => {}) => {
  const capture: Capture = {};
  renderToStaticMarkup(createElement(Group, { capture, checked, onCheck }));
  if (capture.radio === undefined) throw new Error("the group did not draw");
  return capture.radio;
};

const button = (log: string[], name: string) => ({
  focus: () => {
    log.push(name);
  },
});

describe("useRadios (view-and-widgets spec: Radios with manual activation)", () => {
  test("gives each radio the attributes of radioAt", () => {
    const radio = drawn(1);
    expect(radio(1).role).toBe("radio");
    expect(radio(1)["aria-checked"]).toBe(true);
    expect(radio(0)["aria-checked"]).toBe(false);
    expect(radio(1).tabIndex).toBe(0);
    expect(radio(0).tabIndex).toBe(-1);
  });

  test("an arrow key focuses the button the radio's ref was given, without checking", () => {
    const checks: number[] = [];
    const radio = drawn(undefined, (index) => checks.push(index));
    const log: string[] = [];
    radio(0).ref(button(log, "first") as unknown as HTMLButtonElement);
    radio(1).ref(button(log, "second") as unknown as HTMLButtonElement);
    radio(2).ref(button(log, "third") as unknown as HTMLButtonElement);
    radio(2).onKeyDown({ key: "ArrowDown", preventDefault: () => {} });
    radio(0).onKeyDown({ key: "ArrowDown", preventDefault: () => {} });
    expect(log).toEqual(["first", "second"]);
    expect(checks).toEqual([]);
  });

  test("a radio whose button has left the page is skipped, and a click checks through onCheck", () => {
    const checks: number[] = [];
    const radio = drawn(undefined, (index) => checks.push(index));
    const log: string[] = [];
    radio(1).ref(button(log, "second") as unknown as HTMLButtonElement);
    radio(1).ref(null);
    radio(0).onKeyDown({ key: "ArrowDown", preventDefault: () => {} });
    radio(2).onClick();
    expect(log).toEqual([]);
    expect(checks).toEqual([2]);
  });
});
