import { describe, expect, test } from "bun:test";
import type { ScaleProps } from "@askboard/contract";
import { type Say, say } from "@askboard/view/catalog";
import { ratingLabels, valueLabel } from "./text.ts";

// The Scale's texts in the ask's locale and language (view-and-widgets spec: Scale as a slider,
// Scale as a rating; ux-update-draft.md blocks 2 and 9): "Not set" while unset, values and the
// unit in the locale ("12.5 %", "12,5 %"), a range as two values.
const EN: Say = (key, slots) => say("en-US", key, slots);
const IT: Say = (key, slots) => say("it-IT", key, slots);

const percent: ScaleProps = { min: 0, max: 100, step: 0.5, unit: "%" };

describe("valueLabel", () => {
  test("is Not set while nothing is set, in both languages", () => {
    expect(valueLabel(percent, undefined, "en-US", EN)).toBe("Not set");
    expect(valueLabel(percent, undefined, "it-IT", IT)).toBe("Non impostato");
  });

  test("shows a value with its unit in the locale's decimal separator", () => {
    expect(valueLabel(percent, [12.5], "en-US", EN)).toBe("12.5 %");
    expect(valueLabel(percent, [12.5], "it-IT", IT)).toBe("12,5 %");
  });

  test("shows a value with no unit as the number alone", () => {
    expect(valueLabel({ min: 0, max: 10 }, [4], "en-US", EN)).toBe("4");
  });

  test("shows a range as two values and the unit once", () => {
    expect(valueLabel({ ...percent, range: true }, [20, 60], "en-US", EN)).toBe("20 – 60 %");
    expect(valueLabel({ ...percent, range: true }, [2.5, 6], "it-IT", IT)).toBe("2,5 – 6 %");
  });
});

describe("ratingLabels", () => {
  test("gives one label per step from min to max, in the locale", () => {
    expect(ratingLabels({ min: 1, max: 5, display: "rating" }, "en-US")).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(ratingLabels({ min: 0, max: 1, step: 0.5, display: "rating" }, "it-IT")).toEqual([
      "0",
      "0,5",
      "1",
    ]);
  });
});
