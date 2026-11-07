// A widget's Tab stops as a keyboard user meets them (approval-scale-ranking, task 5b.5): Tab from
// the question's text until the focus is inside a group, then one Tab more. Radix's roving focus
// gives the group one stop however many toggles it holds: its own element takes the Tab and hands
// the focus to the selected toggle, else the first enabled one, so counting `tabindex` attributes
// is no test of what a user reaches. Not a test file.

import type { Locator } from "playwright";
import type { Board } from "./dom.ts";

const holdsFocus = (group: Locator): Promise<boolean> =>
  group.evaluate((element) => element.contains(element.ownerDocument.activeElement));

// The focused element's own text without a check mark, which stands for a pressed toggle.
const focusedName = (group: Locator): Promise<string> =>
  group.evaluate((element) =>
    (element.ownerDocument.activeElement?.textContent ?? "").replace("✓", "").trim(),
  );

/**
 * Clicks the question's text, which sets where Tab starts, then presses Tab until the focus is
 * inside `group`, at most `limit` times. Returns the name of the focused element, which is the
 * toggle the group handed the focus to; throws when the group is never reached.
 */
export const tabIntoGroup = async (
  board: Board,
  questionText: string,
  group: Locator,
  limit = 8,
): Promise<string> => {
  await board.view.getByRole("heading", { name: questionText }).click();
  for (let presses = 0; presses < limit; presses += 1) {
    await board.page.keyboard.press("Tab");
    if (await holdsFocus(group)) return focusedName(group);
  }
  throw new Error(`${limit} presses of Tab never reached the group`);
};

/** Presses Tab once and says whether the focus left `group`: the group was one stop. */
export const tabLeavesGroup = async (board: Board, group: Locator): Promise<boolean> => {
  await board.page.keyboard.press("Tab");
  return !(await holdsFocus(group));
};
