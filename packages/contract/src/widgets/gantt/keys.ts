// The Gantt's key table (keyboard-shortcuts-help, design decision 9): the keys its handlers take
// today, as `widgets/src/gantt/model/keys.ts` (`gridKeyAction`, `toolbarKeyMove`) and
// `model/column-width.ts` (`keyWidth`) bind them, and as the predecessors panel and the "Critical
// path" switch take them. Its parts: the grid, its cell editor, the plan's zoom, the Task column's
// edge, the predecessors panel and the switch. The panel's Space and the switch's Space are `native`
// entries: keys Radix takes by its documentation, listed and taught but not matched by AskBoard's
// handler.
//
// `readOnly`: a read-only Gantt keeps its grid's cursor, its zoom, the Task column's edge and the
// "Critical path" switch, all view state (`gantt/frame.tsx`: "a read-only Gantt keeps its zoom and
// its navigation and turns its editors, its panel and its pointer edits off"; the edge is rendered
// at `frame.tsx:248` on every Gantt). Its editor, its Delete and Enter or F2 on a cell
// (`grid-keys.ts`: `editable`) and its predecessors panel, which only an editable "Depends on"
// opens, do not act; the panel's cursor keys say so by override. Plain data, no DOM (AD-1).

import { keyBinding, ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const GRID = "grid";
const EDITOR = "editor";
const ZOOM = "zoom";
const EDGE = "edge";
const PANEL = "panel";
const SWITCH = "switch";

const SPACE = [keyBinding(" ")];
const EDITS = { readOnly: false } as const;
const VIEW = { readOnly: true } as const;

export const GANTT_KEYS = [
  vocabularyEntry("cursor.up", GRID, "navigation"),
  vocabularyEntry("cursor.down", GRID, "navigation"),
  vocabularyEntry("cursor.left", GRID, "navigation"),
  vocabularyEntry("cursor.right", GRID, "navigation"),
  vocabularyEntry("cursor.first", GRID, "navigation"),
  vocabularyEntry("cursor.last", GRID, "navigation"),
  vocabularyEntry("edit.start", GRID, "pointer"),
  // Delete clears a start's request, or a plan task's requested duration: no deletion.
  ownEntry("gantt.clear", GRID, [keyBinding("Delete"), keyBinding("Backspace")], "pointer", EDITS),
  vocabularyEntry("edit.commit", EDITOR, "navigation"),
  vocabularyEntry("edit.cancel", EDITOR, "navigation"),
  vocabularyEntry("toolbar.previous", ZOOM, "navigation"),
  vocabularyEntry("toolbar.next", ZOOM, "navigation"),
  vocabularyEntry("toolbar.first", ZOOM, "navigation"),
  vocabularyEntry("toolbar.last", ZOOM, "navigation"),
  ownEntry("gantt.narrower", EDGE, [keyBinding("ArrowLeft")], "pointer", VIEW),
  ownEntry("gantt.wider", EDGE, [keyBinding("ArrowRight")], "pointer", VIEW),
  ownEntry("gantt.narrowerMore", EDGE, [keyBinding("ArrowLeft", "shift")], "pointer", VIEW),
  ownEntry("gantt.widerMore", EDGE, [keyBinding("ArrowRight", "shift")], "pointer", VIEW),
  ownEntry("gantt.narrowest", EDGE, [keyBinding("Home")], "pointer", VIEW),
  ownEntry("gantt.widest", EDGE, [keyBinding("End")], "pointer", VIEW),
  ownEntry("gantt.fit", EDGE, [keyBinding("Enter")], "pointer", VIEW),
  vocabularyEntry("cursor.up", PANEL, "navigation", EDITS),
  vocabularyEntry("cursor.down", PANEL, "navigation", EDITS),
  vocabularyEntry("edit.commit", PANEL, "navigation", { label: "gantt.panel.done" }),
  vocabularyEntry("edit.cancel", PANEL, "navigation"),
  ownEntry("gantt.togglePredecessor", PANEL, SPACE, "native", EDITS),
  vocabularyEntry("toolbar.previous", SWITCH, "navigation"),
  vocabularyEntry("toolbar.first", SWITCH, "navigation"),
  ownEntry("gantt.criticalPath", SWITCH, SPACE, "native", {
    readOnly: true,
    label: "gantt.critical.switch",
  }),
] as const;

/** The actions of the Gantt's table. */
export type GanttKeyAction = (typeof GANTT_KEYS)[number]["action"];
