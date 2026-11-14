// The Timeline's key table (keyboard-shortcuts-help, design decision 9): the keys its handlers take
// today, Up, Down, Home and End moving the current entry with no modifier (`timelineKeyOf`) and the
// toolbar's roving focus, and its three tools, which no key takes, as entries of the type's own with
// no keys (decision 6: a table lists every tool and menu that acts on the content). `readOnly`: a
// read-only Timeline keeps its cursor; its three tools are off (`timelineTools`: `disabled`), so
// `toolbarStop` (`widgets/src/shared/toolbar-focus.ts:48`: no Tab stop when every tool is off)
// leaves the toolbar no focus and `toolbar.*` is `readOnly: false`. Plain data, no DOM (AD-1).

import { ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const ENTRIES = "entries";
const TOOLBAR = "toolbar";

export const TIMELINE_KEYS = [
  vocabularyEntry("cursor.up", ENTRIES, "navigation"),
  vocabularyEntry("cursor.down", ENTRIES, "navigation"),
  vocabularyEntry("cursor.first", ENTRIES, "navigation"),
  vocabularyEntry("cursor.last", ENTRIES, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation", { readOnly: false }),
  ownEntry("timeline.moveEarlier", TOOLBAR, [], "tool", {
    readOnly: false,
    label: "timeline.moveEarlier",
  }),
  ownEntry("timeline.moveLater", TOOLBAR, [], "tool", {
    readOnly: false,
    label: "timeline.moveLater",
  }),
  ownEntry("timeline.moveToLane", TOOLBAR, [], "menu", {
    readOnly: false,
    label: "timeline.moveToLane",
  }),
] as const;

/** The actions of the Timeline's table. */
export type TimelineKeyAction = (typeof TIMELINE_KEYS)[number]["action"];
