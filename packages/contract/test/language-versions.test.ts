import { describe, expect, test } from "bun:test";
import { INPUT_FORMAT_VERSION } from "../src/index.ts";

// settings-languages, design decision 2: each set E8 changes takes the next minor after `main`'s at
// group 0, where the input format was at 1.1.
describe("the minors settings-languages takes", () => {
  test("the input format is at 1.2, which accepts it-IT", () => {
    expect(INPUT_FORMAT_VERSION).toBe("1.2");
  });
});
