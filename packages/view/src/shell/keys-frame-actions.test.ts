import { describe, expect, test } from "bun:test";
import { keysOpenEntryOf } from "../catalog/keys/effective.ts";
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

// The panel's own key in effect (keyboard-shortcuts-help, task 10.6; spec: The keys panel's own key,
// No key for the keys panel): the frame reads `keys.open` with the user's overrides applied.
describe("keyDownOf with the keys of keys.open in effect", () => {
  const bound = keysOpenEntryOf({ "keys.open": ["Mod+Alt+Enter"] });
  const removed = keysOpenEntryOf({ "keys.open": [] });
  const press = (event: ReturnType<typeof keyEvent>, entry: typeof bound) => {
    const opened: (HTMLElement | null)[] = [];
    keyDownOf((from) => opened.push(from), entry)(event as never);
    return opened;
  };

  test("given Mod+Alt+Enter, Ctrl+Alt+Enter and Cmd+Alt+Enter open the panel and prevent the key", () => {
    for (const fields of [
      { ctrlKey: true, altKey: true },
      { metaKey: true, altKey: true },
    ]) {
      const event = keyEvent("Enter", fields);
      expect(press(event, bound)).toEqual([event.target]);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  test("given Mod+Alt+Enter, `?` opens nothing and its default is kept", () => {
    const event = keyEvent("?");
    expect(press(event, bound)).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test("given no key, none opens the panel, `?` keeps its default, and the rebound key is not taken", () => {
    for (const event of [
      keyEvent("?"),
      keyEvent("?", { shiftKey: true }),
      keyEvent("Enter", { ctrlKey: true, altKey: true }),
    ]) {
      expect(press(event, removed)).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  test("the text-field, composing and already-prevented rules hold for a rebound key", () => {
    const hold = { ctrlKey: true, altKey: true };
    expect(press(keyEvent("Enter", { ...hold, target: { tagName: "TEXTAREA" } }), bound)).toEqual(
      [],
    );
    expect(
      press(keyEvent("Enter", { ...hold, nativeEvent: { isComposing: true } }), bound),
    ).toEqual([]);
    expect(press(keyEvent("Enter", { ...hold, keyCode: 229 }), bound)).toEqual([]);
    expect(press(keyEvent("Enter", { ...hold, defaultPrevented: true }), bound)).toEqual([]);
  });

  test("another modifier on the rebound key opens nothing", () => {
    expect(press(keyEvent("Enter", { ctrlKey: true }), bound)).toEqual([]);
    expect(press(keyEvent("Enter", { altKey: true, shiftKey: true }), bound)).toEqual([]);
    expect(
      press(keyEvent("Enter", { ctrlKey: true, altKey: true, shiftKey: true }), bound),
    ).toEqual([]);
  });

  test("a panel a rebound key opened closes under the close rule: Escape gives the focus back, a click elsewhere leaves it", () => {
    const row = spot("row");
    for (const [reason, focused] of [
      ["escape", 1],
      ["close", 1],
      ["outside", 0],
    ] as const) {
      const elements = frame();
      keyDownOf(
        openFrom(elements, () => {}),
        bound,
      )(keyEvent("Enter", { ctrlKey: true, altKey: true, target: row }) as never);
      expect(elements.opener.current as unknown).toBe(row);
      row.focused = 0;
      noteClose(elements, reason)();
      restoreFocus(elements)({ preventDefault: () => {} });
      expect(row.focused).toBe(focused);
    }
  });
});
