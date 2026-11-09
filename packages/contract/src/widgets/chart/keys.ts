// The Chart's key table (keyboard-shortcuts-help, design decision 9): the keys its handler takes
// today, the arrows, Home and End moving the current point (`isChartKey`) and Space or Enter
// highlighting it. `readOnly`: the cursor acts on every Chart; Space and Enter highlight a point
// only where the Chart takes highlights (`chart/widget.tsx`: `takesHighlights`, false when the
// Chart is disabled). Plain data, no DOM (AD-1).

import { keyBinding, ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const PLOT = "plot";

export const CHART_KEYS = [
  vocabularyEntry("cursor.up", PLOT, "navigation"),
  vocabularyEntry("cursor.down", PLOT, "navigation"),
  vocabularyEntry("cursor.left", PLOT, "navigation"),
  vocabularyEntry("cursor.right", PLOT, "navigation"),
  vocabularyEntry("cursor.first", PLOT, "navigation"),
  vocabularyEntry("cursor.last", PLOT, "navigation"),
  ownEntry("chart.highlight", PLOT, [keyBinding(" "), keyBinding("Enter")], "pointer", {
    readOnly: false,
  }),
] as const;

/** The actions of the Chart's table. */
export type ChartKeyAction = (typeof CHART_KEYS)[number]["action"];
