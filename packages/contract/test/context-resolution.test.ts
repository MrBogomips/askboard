import { describe, expect, test } from "bun:test";
import { UNRESOLVED_REASONS } from "../src/index.ts";

// Contract spec, The unresolved-pointer warning (excerpts, proposal B9): the reasons a pointer
// stays unresolved, which `excerpts`, `ask-core`, the warning and the board document share.

describe("why a pointer stays unresolved (proposal B9)", () => {
  test("there are the ten reasons the PO accepted, in their order", () => {
    expect(UNRESOLVED_REASONS).toEqual([
      "no-root",
      "invalid-pointer",
      "outside-root",
      "not-found",
      "not-a-file",
      "anchor-not-found",
      "not-text",
      "not-image",
      "too-large",
      "timeout",
    ]);
  });
});
