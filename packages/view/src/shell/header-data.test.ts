import { describe, expect, test } from "bun:test";
import { headerDataOf } from "./header-data.ts";

// The context header's data in the view (task 8.5, design decision 12): who asked and where and
// the agent status, from the boot block, then from each update that carries them.

const origin = { who: { label: "Main agent" }, project: "order-service", directory: "." };

describe("the header's data", () => {
  test("starts from the boot block, with what it holds", () => {
    expect(headerDataOf({}, { origin, agent: "working" })).toEqual({ origin, agent: "working" });
    expect(headerDataOf({}, {})).toEqual({});
  });

  test("takes each update's values", () => {
    const before = headerDataOf({}, { origin, agent: "working" });
    const other = { ...origin, branch: "fix/retry" };
    expect(headerDataOf(before, { origin: other, agent: "waiting" })).toEqual({
      origin: other,
      agent: "waiting",
    });
  });

  test("keeps what it has when an update carries neither", () => {
    const before = headerDataOf({}, { origin, agent: "waiting" });
    expect(headerDataOf(before, {})).toBe(before);
  });

  test("is the same value when an update changes nothing, so the header does not render again", () => {
    const before = headerDataOf({}, { origin, agent: "waiting" });
    expect(headerDataOf(before, { origin: { ...origin }, agent: "waiting" })).toBe(before);
  });
});
