// The Gantt fixtures (gantt-widget, tasks 3.1 and 3.2): UJ-2's six work packages as a Gantt with
// its own tasks, its durations those the UJ-2 plan computes, so its schedule is the plan's, taken
// from `uj2-wbs-gantt.json`'s expected values; and the same Gantt and plan with reporting
// requested to start on 2026-12-09, three working days after its earliest start.

import type { GanttItem, GanttPlanItem, GraphItem } from "../../src/source.ts";
import type { Address } from "../../src/types.ts";
import type { Expected } from "./index.ts";
import uj2 from "./uj2-wbs-gantt.json" with { type: "json" };

export type GanttFixture = {
  readonly name: string;
  readonly items: readonly GraphItem[];
  readonly expected: Readonly<Record<Address, Expected>>;
};

const RELEASE: GanttItem = {
  kind: "gantt",
  id: "release",
  start: "2026-11-02",
  tasks: [
    { id: "ux", duration: 6 },
    { id: "architecture", duration: 4 },
    { id: "prototype", duration: 5 },
    { id: "portal", duration: 13 },
    { id: "billing", duration: 9 },
    { id: "reporting", duration: 6 },
  ],
  dependencies: {
    prototype: ["ux"],
    portal: ["architecture", "prototype"],
    billing: ["architecture"],
    reporting: ["portal"],
  },
};

const [WBS, PLAN] = uj2.items as unknown as readonly [GraphItem, GanttPlanItem];

const asRelease = Object.fromEntries(
  Object.entries(uj2.expected as Record<Address, Expected>)
    .filter(([address]) => address.startsWith("schedule."))
    .map(([address, value]) => [address.replace(/^schedule\./, "release."), value]),
);

const REQUESTED = {
  "reporting.earliest": 24,
  "reporting.earliestDate": "2026-12-04",
  "reporting.startOffset": 27,
  "reporting.es": 27,
  "reporting.startDate": "2026-12-09",
  "reporting.finishDate": "2026-12-16",
  "reporting.critical": true,
  // The wait before reporting's requested start is the portal's slack.
  "portal.critical": false,
  "portal.slack": 3,
  finish: 33,
  finishDate: "2026-12-16",
} as const;

const prefixed = (item: string): Record<Address, Expected> =>
  Object.fromEntries(Object.entries(REQUESTED).map(([at, value]) => [`${item}.${at}`, value]));

export const GANTT_FIXTURES: readonly GanttFixture[] = [
  { name: "release", items: [RELEASE], expected: asRelease },
  {
    name: "release-requested",
    items: [{ ...RELEASE, starts: { reporting: "2026-12-09" } }],
    expected: prefixed("release"),
  },
  {
    name: "uj2-requested",
    items: [WBS, { ...PLAN, starts: { reporting: "2026-12-09" } }],
    expected: prefixed("schedule"),
  },
];
