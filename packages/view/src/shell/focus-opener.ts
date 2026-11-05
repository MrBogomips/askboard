// After the reading panel closes (EXPERIENCE.md, Accessibility Floor: Focus), the focus goes back
// to the control that opened it: the reference's chip, or the excerpt's "Open in reading panel".
// The board page names the item; the control is its first button in the view.

/** Focuses the button of the item the reading panel was opened from; says whether it found one. */
export const focusOpener = (itemId: string, doc: Document = document): boolean => {
  for (const item of doc.querySelectorAll("[data-askboard-item]")) {
    if (item.getAttribute("data-askboard-item") !== itemId) continue;
    const button = item.querySelector("button");
    if (button === null) return false;
    button.focus();
    return true;
  }
  return false;
};
