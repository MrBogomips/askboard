import { describe, expect, test } from "bun:test";
import { t } from "./index.ts";

// Review F-22: the work breakdown's value headers are a short label and the full name as the tip,
// the label short enough to stay on one line in its 144px column.
describe("the Tree's work breakdown headers in both languages", () => {
  test("each reads as a label and a tip", () => {
    expect(t("en-US", "tree.expected")).toBe("Expected");
    expect(t("en-US", "tree.expectedEffort")).toBe("Expected effort");
    expect(t("it-IT", "tree.expected")).toBe("Atteso");
    expect(t("it-IT", "tree.expectedEffort")).toBe("Impegno atteso");
    expect(t("it-IT", "tree.spread")).toBe("Dispersione");
  });

  test("a label is at most 12 characters", () => {
    for (const language of ["en-US", "it-IT"] as const) {
      for (const key of ["tree.expected", "tree.spread"] as const) {
        expect(t(language, key).length).toBeLessThanOrEqual(12);
      }
    }
  });
});
