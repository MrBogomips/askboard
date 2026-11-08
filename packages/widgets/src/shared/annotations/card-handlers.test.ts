import { describe, expect, test } from "bun:test";
import {
  closeFocus,
  editPress,
  fieldInput,
  focusAfterEdit,
  openFocus,
  recordNode,
} from "./card-handlers.ts";

// The card's handlers as plain functions (document-review, design decision 9), tested without a DOM:
// the card's elements only hand them to React.
describe("pressing Edit", () => {
  test("marks the switch and starts writing", () => {
    const switched = { current: false };
    const writing: boolean[] = [];
    editPress(switched, (next) => writing.push(next))();
    expect(switched.current).toBe(true);
    expect(writing).toEqual([true]);
  });
});

describe("typing in a field", () => {
  test("writes the textarea's text through the caller's callback", () => {
    const written: string[] = [];
    fieldInput({ onChange: (value) => written.push(value) })({
      currentTarget: { value: "Say how long." },
    });
    expect(written).toEqual(["Say how long."]);
  });
});

describe("the first field's ref", () => {
  test("records the node, and forgets it when the field goes", () => {
    const first = { current: null as { focus(): void } | null };
    const node = { focus: () => {} };
    recordNode(first)(node);
    expect(first.current).toBe(node);
    recordNode(first)(null);
    expect(first.current).toBeNull();
  });
});

describe("focus after Edit", () => {
  const field = () => {
    const calls: string[] = [];
    return { calls, node: { focus: () => calls.push("focus") } };
  };

  test("moves to the first field once the card is writing after a switch", () => {
    const { calls, node } = field();
    focusAfterEdit(true, { current: true }, { current: node })();
    expect(calls).toEqual(["focus"]);
  });

  test("leaves focus alone on open, when reading, or with no field", () => {
    const { calls, node } = field();
    focusAfterEdit(true, { current: false }, { current: node })();
    focusAfterEdit(false, { current: true }, { current: node })();
    expect(() => focusAfterEdit(true, { current: true }, { current: null })()).not.toThrow();
    expect(calls).toEqual([]);
  });
});

describe("the popover's focus", () => {
  const event = () => {
    const state = { prevented: false };
    return { state, event: { preventDefault: () => (state.prevented = true) } };
  };

  test("opening focuses the field marked for it, else the card itself", () => {
    const calls: string[] = [];
    const field = { focus: () => calls.push("field") };
    const card = {
      focus: () => calls.push("card"),
      querySelector: (selector: string) => (selector === "[data-annotation-focus]" ? field : null),
    };
    const opening = event();
    openFocus({ current: card })(opening.event);
    expect(opening.state.prevented).toBe(true);
    expect(calls).toEqual(["field"]);
    const reading = event();
    openFocus({ current: { ...card, querySelector: () => null } })(reading.event);
    expect(calls).toEqual(["field", "card"]);
    expect(() => openFocus({ current: null })(event().event)).not.toThrow();
  });

  test("closing returns focus to the caller's target, or leaves it when there is none", () => {
    const calls: string[] = [];
    const closing = event();
    closeFocus(() => ({ focus: () => calls.push("pin") }))(closing.event);
    expect(closing.state.prevented).toBe(true);
    expect(calls).toEqual(["pin"]);
    expect(() => closeFocus(() => null)(event().event)).not.toThrow();
    expect(() => closeFocus(() => undefined)(event().event)).not.toThrow();
  });
});
