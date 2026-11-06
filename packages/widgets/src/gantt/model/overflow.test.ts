import { describe, expect, test } from "bun:test";
import { overflowEdges } from "./overflow.ts";

describe("the chart's overflow cue", () => {
  test.each([
    [0, 400, 400, false, false],
    [0, 400, 900, false, true],
    [250, 400, 900, true, true],
    [500, 400, 900, true, false],
    [499.4, 400, 900, true, false],
    [0.5, 400, 401, false, false],
  ])("at %d of %d in %d, before %p and after %p", (left, client, scroll, before, after) => {
    expect(overflowEdges(left, client, scroll)).toEqual({ before, after });
  });
});
