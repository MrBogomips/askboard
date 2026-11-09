import { describe, expect, test } from "bun:test";
import {
  controlOf,
  type FrameElements,
  keyDownOf,
  type Measurable,
  noteClose,
  openFrom,
  restoreFocus,
  stopKey,
} from "./keys-frame-actions.ts";

// What an item frame's keys panel does (keyboard-shortcuts-help, design decision 5; spec: The keys
// panel), without a DOM: opened from the Keys button or a key, anchored by the button, `?` only
// where the key was not taken, panel keys kept inside it, the focus given back.

type Spot = HTMLElement & { readonly name: string; focused: number };

const spot = (name: string): Spot =>
  ({
    name,
    focused: 0,
    focus() {
      (this as Spot).focused += 1;
    },
  }) as unknown as Spot;

const frame = (): FrameElements => ({
  button: { current: null },
  anchor: { current: null },
  opener: { current: null },
  closedBy: { current: undefined },
});

describe("openFrom", () => {
  test("remembers where the focus was and places the panel by the Keys button", () => {
    const elements = frame();
    const button = spot("button");
    const row = spot("row");
    elements.button.current = button;
    const opened: boolean[] = [];
    openFrom(elements, (open) => opened.push(open))(row);
    expect(elements.opener.current).toBe(row);
    expect(elements.anchor.current as unknown).toBe(button);
    expect(opened).toEqual([true]);
  });

  test("with no Keys button the panel is placed by the element that had the focus", () => {
    const elements = frame();
    const row = spot("row");
    openFrom(elements, () => {})(row);
    expect(elements.anchor.current as unknown).toBe(row);
  });
});

describe("controlOf", () => {
  test("`open` opens from the Keys button; `anchor` records it", () => {
    const elements = frame();
    const button = spot("button");
    const from: (HTMLElement | null)[] = [];
    const control = controlOf(elements, (element) => from.push(element));
    control.anchor(button);
    expect(elements.button.current).toBe(button);
    control.open();
    expect(from).toEqual([button]);
    control.anchor(null);
    control.open();
    expect(from).toEqual([button, null]);
  });
});

const keyEvent = (key: string, fields: Record<string, unknown> = {}) => {
  const event = {
    key,
    keyCode: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    nativeEvent: { isComposing: false },
    target: spot("row"),
    preventDefault() {
      event.defaultPrevented = true;
    },
    ...fields,
  };
  return event;
};

describe("keyDownOf", () => {
  const press = (event: ReturnType<typeof keyEvent>) => {
    const opened: (HTMLElement | null)[] = [];
    keyDownOf((from) => opened.push(from))(event as never);
    return opened;
  };

  test("`?` outside a text field opens the panel from the target and prevents the key", () => {
    const event = keyEvent("?");
    const opened = press(event);
    expect(opened).toEqual([event.target]);
    expect(event.defaultPrevented).toBe(true);
  });

  test("a key already prevented, by a widget or a nested frame, opens nothing: the nearest frame wins", () => {
    const event = keyEvent("?", { defaultPrevented: true });
    expect(press(event)).toEqual([]);
  });

  test("not in a text field, not while composing, not another key", () => {
    expect(press(keyEvent("?", { target: { tagName: "TEXTAREA" } }))).toEqual([]);
    expect(press(keyEvent("?", { nativeEvent: { isComposing: true } }))).toEqual([]);
    expect(press(keyEvent("?", { keyCode: 229 }))).toEqual([]);
    expect(press(keyEvent("/"))).toEqual([]);
    expect(press(keyEvent("?", { ctrlKey: true }))).toEqual([]);
  });

  test("a target that cannot take the focus opens from nothing", () => {
    const opened = press(keyEvent("?", { target: null }));
    expect(opened).toEqual([null]);
  });
});

describe("stopKey and restoreFocus", () => {
  test("stopKey stops the key's bubbling", () => {
    let stopped = 0;
    stopKey({ stopPropagation: () => (stopped += 1) });
    expect(stopped).toBe(1);
  });

  test("after a close by Escape or by Close, restoreFocus prevents Radix's choice and focuses the opener", () => {
    for (const reason of ["escape", "close"] as const) {
      const elements = frame();
      const row = spot("row");
      elements.opener.current = row;
      noteClose(elements, reason)();
      let prevented = 0;
      restoreFocus(elements)({ preventDefault: () => (prevented += 1) });
      expect(prevented).toBe(1);
      expect(row.focused).toBe(1);
    }
  });

  test("after a close from an interaction outside, it prevents Radix's move and focuses nothing", () => {
    const elements = frame();
    const row = spot("row");
    elements.opener.current = row;
    noteClose(elements, "outside")();
    let prevented = 0;
    restoreFocus(elements)({ preventDefault: () => (prevented += 1) });
    expect(prevented).toBe(1);
    expect(row.focused).toBe(0);
  });

  test("the recorded reason is cleared at each open: an outside close never leaks into the next", () => {
    const elements = frame();
    const row = spot("row");
    noteClose(elements, "outside")();
    openFrom(elements, () => {})(row);
    expect(elements.closedBy.current).toBeUndefined();
    let prevented = 0;
    restoreFocus(elements)({ preventDefault: () => (prevented += 1) });
    expect(prevented).toBe(1);
    expect(row.focused).toBe(1);
  });

  test("with no opener it prevents and focuses nothing", () => {
    let prevented = 0;
    restoreFocus(frame())({ preventDefault: () => (prevented += 1) });
    expect(prevented).toBe(1);
  });

  test("a Measurable is anything that has a rectangle", () => {
    const measurable: Measurable = { getBoundingClientRect: () => ({}) as DOMRect };
    expect(typeof measurable.getBoundingClientRect).toBe("function");
  });
});
