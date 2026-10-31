import { describe, expect, test } from "bun:test";
import { tabTitle } from "./tab-title.ts";

describe("the board's tab (EXPERIENCE.md, Voice and Tone)", () => {
  test('reads "<title> · AskBoard"', () => {
    expect(tabTitle("Which database should the order service use?")).toBe(
      "Which database should the order service use? · AskBoard",
    );
  });

  test("keeps markup as the characters it is: the title is text (AD-8)", () => {
    expect(tabTitle("<b>Bold title</b>")).toBe("<b>Bold title</b> · AskBoard");
  });
});
