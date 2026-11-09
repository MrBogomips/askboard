// The Ranking's key table (keyboard-shortcuts-help, design decision 8): the keys of its list and of
// its toolbar, built from the vocabulary. Enter keeps the order, which is the Ranking's own action
// (`ranking.keep`, a key the PO approved with question 1), and Escape selects none while rows are
// selected. A read-only Ranking keeps its cursor, its toolbar's roving focus and `?`: its tools stay
// focusable (`aria-disabled`, `ranking/toolbar.tsx`) and its rows show no check box, so every other
// entry's `readOnly` is false (`ranking/widget.tsx`: `editable={!disabled}`, `rankingTools`).
// Plain data, no DOM (AD-1).

import { keyBinding, ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const LIST = "list";
const TOOLBAR = "toolbar";

export const RANKING_KEYS = [
  vocabularyEntry("cursor.up", LIST, "navigation"),
  vocabularyEntry("cursor.down", LIST, "navigation"),
  vocabularyEntry("cursor.first", LIST, "navigation"),
  vocabularyEntry("cursor.last", LIST, "navigation"),
  vocabularyEntry("select.toggle", LIST, "pointer"),
  vocabularyEntry("select.extendUp", LIST, "pointer"),
  vocabularyEntry("select.extendDown", LIST, "pointer"),
  vocabularyEntry("move.up", LIST, "tool", { label: "ranking.moveUp" }),
  vocabularyEntry("move.down", LIST, "tool", { label: "ranking.moveDown" }),
  vocabularyEntry("move.top", LIST, "tool", { label: "ranking.toTop" }),
  vocabularyEntry("move.bottom", LIST, "tool", { label: "ranking.toBottom" }),
  ownEntry("ranking.keep", LIST, [keyBinding("Enter")], "tool", {
    readOnly: false,
    label: "ranking.keep",
  }),
  vocabularyEntry("select.none", LIST, "tool", { label: "ranking.selectNone" }),
  vocabularyEntry("keys.open", LIST, "panel"),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation"),
] as const;

/** The actions of the Ranking's table: a handler maps each through a typed record. */
export type RankingKeyAction = (typeof RANKING_KEYS)[number]["action"];
