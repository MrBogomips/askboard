// What the chart's legend lists and how the chart draws a critical task (design decision 8): the
// "Critical path" switch is a presentation filter, so off, every bar and arrow is drawn as an
// ordinary one and the legend drops its critical entry, while the computed flags stay as they are.
// Plain ECMAScript.

export type LegendEntry = "task" | "critical" | "change" | "baseline";

/** The legend's entries in order: the critical one only while the highlighting is on. */
export const legendEntries = (highlight: boolean, baseline: boolean): readonly LegendEntry[] => [
  "task",
  ...(highlight ? (["critical"] as const) : []),
  "change",
  ...(baseline ? (["baseline"] as const) : []),
];

/** Whether a bar or an arrow takes the critical look: it is critical, and the switch is on. */
export const looksCritical = (critical: boolean, highlight: boolean): boolean =>
  critical && highlight;
