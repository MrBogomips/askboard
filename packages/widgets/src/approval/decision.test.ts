import { describe, expect, test } from "bun:test";
import { approvalPropsError, decisionOf, heldApprove, resultFor, selectable } from "./decision.ts";

// The Approval's decisions as plain data (view-and-widgets spec: Approval decisions, Approving a
// question that holds changes; design decision 8): what the held result says, what a press puts
// in the draft, what "Approve" does beside changes.

describe("the held decision", () => {
  test("is read from a result of one of the three decisions, else none", () => {
    expect(decisionOf({ decision: "approve" })).toBe("approve");
    expect(decisionOf({ decision: "approve-with-changes" })).toBe("approve-with-changes");
    expect(decisionOf({ decision: "reject" })).toBe("reject");
    for (const other of [undefined, null, "reject", 3, [], {}, { decision: "maybe" }]) {
      expect(decisionOf(other)).toBeUndefined();
    }
  });

  test("a press puts the decision, and the pressed one again, which the group reports as empty, puts none", () => {
    expect(resultFor("reject")).toEqual({ decision: "reject" });
    expect(resultFor("")).toBeUndefined();
    expect(resultFor("maybe")).toBeUndefined();
  });
});

describe("beside changes", () => {
  test("Approve is not selectable once the question holds a change; the others stay", () => {
    expect(selectable("approve", 0)).toBe(true);
    expect(selectable("approve", 1)).toBe(false);
    expect(selectable("approve-with-changes", 0)).toBe(true);
    expect(selectable("approve-with-changes", 3)).toBe(true);
    expect(selectable("reject", 3)).toBe(true);
  });

  test("a held Approve is stale exactly when a change appears; no other decision is", () => {
    expect(heldApprove({ decision: "approve" }, 1)).toBe(true);
    expect(heldApprove({ decision: "approve" }, 0)).toBe(false);
    expect(heldApprove({ decision: "reject" }, 4)).toBe(false);
    expect(heldApprove({ decision: "approve-with-changes" }, 4)).toBe(false);
    expect(heldApprove(undefined, 4)).toBe(false);
  });
});

describe("the props", () => {
  test("an Approval has none: an object with no key passes, anything else is refused with the item's name", () => {
    expect(approvalPropsError("verdict", {})).toBeUndefined();
    expect(approvalPropsError("verdict", { summary: "x" })).toContain('"verdict"');
    for (const props of [undefined, null, [], "x", 3]) {
      expect(approvalPropsError("verdict", props)).toContain('"verdict"');
    }
  });
});
