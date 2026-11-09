// The Timeline's key table (keyboard-shortcuts-help, design decision 9): the keys its handlers take
// today, Up, Down, Home and End moving the current entry with no modifier (`timelineKeyOf`) and the
// toolbar's roving focus. Plain data, no DOM (AD-1).

import { vocabularyEntry } from "../../keys/vocabulary.ts";

const ENTRIES = "entries";
const TOOLBAR = "toolbar";

export const TIMELINE_KEYS = [
  vocabularyEntry("cursor.up", ENTRIES, "navigation"),
  vocabularyEntry("cursor.down", ENTRIES, "navigation"),
  vocabularyEntry("cursor.first", ENTRIES, "navigation"),
  vocabularyEntry("cursor.last", ENTRIES, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation"),
] as const;

/** The actions of the Timeline's table. */
export type TimelineKeyAction = (typeof TIMELINE_KEYS)[number]["action"];
