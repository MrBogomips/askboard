// The fixture Gantt's parts and dates the Gantt's browser scenarios share (gantt-widget design
// decisions 9 and 12): its question `schedule` and the Gantt `release` it holds, the dates
// compute's UJ-2 plan gives its tasks, and the week scale's first day and day width, which the
// chart's geometry is checked against. Only the widget host shows a Gantt: the board page refuses
// one for now.

import { ganttBoardDocument } from "@askboard/contract/fixtures";

/** The fixture's question `schedule`, and the Gantt `release` it holds. */
export const [schedule] = ganttBoardDocument.items;
export const [release] = schedule.props.items;

// The fixture Gantt as compute's UJ-2 plan schedules it: each task's start and finish, and the
// critical path UX design, the prototype, the portal and reporting.
export const UJ2 = [
  ["ux", "2026-11-02", "2026-11-09", true],
  ["architecture", "2026-11-02", "2026-11-05", false],
  ["prototype", "2026-11-10", "2026-11-16", true],
  ["portal", "2026-11-17", "2026-12-03", true],
  ["billing", "2026-11-06", "2026-11-18", false],
  ["reporting", "2026-12-04", "2026-12-11", true],
] as const;

/** The chart's first day, and a day's width in pixels at the week scale. */
export const ORIGIN = "2026-11-02";
export const WEEK_PX = 15;
