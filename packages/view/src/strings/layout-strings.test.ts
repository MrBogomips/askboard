import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The Tabs layout's string (layouts, task 3.3; view-and-widgets spec: A tab holding a field to
// correct; ux-update-draft.md block 4): the mark's accessible text, in both tables, the Italian
// text to review.

describe("the Tabs mark's text", () => {
  test("is in both tables, in English and in Italian", () => {
    expect(Object.hasOwn(STRINGS["en-US"], "tabs.needsCorrection")).toBe(true);
    expect(Object.hasOwn(STRINGS["it-IT"], "tabs.needsCorrection")).toBe(true);
    expect(t("en-US", "tabs.needsCorrection")).toBe("needs a correction");
    expect(t("it-IT", "tabs.needsCorrection")).toBe("da correggere");
  });
});
