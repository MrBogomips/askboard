// Where the settings sheet sits (answering-flow-visual, design decision 12): at the inset the view
// measured, so that it starts under the header's last row and runs to the viewport's foot.

import { describe, expect, test } from "bun:test";
import { placementOf } from "./settings-placement.ts";

describe("the settings sheet's placement", () => {
  test("takes the view's measured inset", () => {
    expect(placementOf({ top: 96, bottom: 0 })).toEqual({ top: "96px", bottom: "0px" });
    expect(placementOf({ top: 128, bottom: 48 })).toEqual({ top: "128px", bottom: "48px" });
  });

  test("has no inset before the view has said one: from the viewport's top", () => {
    expect(placementOf(undefined)).toEqual({ top: "0px", bottom: "0px" });
  });
});
