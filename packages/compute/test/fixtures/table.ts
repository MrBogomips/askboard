// The Table fixtures of the determinism check (table-widget, task 2.4): a Table with a date column
// computed by WORKDAY and a money column, through `boardGraphSource` as the view and `ask-core` map
// it. The values are Excel's: work from Monday 2026-11-02, a money amount in USD.

import type { BoardSourceItem } from "../../src/board.ts";
import type { Address } from "../../src/types.ts";
import type { Expected } from "./index.ts";

export type TableSourceFixture = {
  readonly name: string;
  readonly items: readonly BoardSourceItem[];
  readonly expected: Readonly<Record<Address, Expected>>;
};

const SCHEDULE: BoardSourceItem = {
  type: "table",
  id: "work",
  props: {
    columns: [
      { field: "start", label: "Start", type: "date" },
      { field: "days", label: "Days", type: "number", total: "sum" },
      { field: "rate", label: "Rate", type: "money", currency: "USD" },
      { field: "due", label: "Due", type: "date", formula: "WORKDAY([@start], [@days])" },
      {
        field: "cost",
        label: "Cost",
        type: "money",
        currency: "USD",
        formula: "[@days] * [@rate]",
        total: "sum",
      },
      { field: "done", label: "Done", type: "toggle" },
    ],
    rows: [
      { id: "a", start: "2026-11-02", days: 5, rate: "100.10", done: true },
      { id: "b", start: "2026-11-02", days: 10, rate: "33.33" },
      { id: "c", start: "2026-11-06", days: 1, rate: "0.10" },
    ],
  },
};

export const TABLE_SOURCE_FIXTURES: readonly TableSourceFixture[] = [
  {
    name: "schedule",
    items: [SCHEDULE],
    expected: {
      "work.a.due": "2026-11-09",
      "work.b.due": "2026-11-16",
      "work.c.due": "2026-11-09",
      "work.a.cost": 500.5,
      "work.b.cost": 333.3,
      "work.c.cost": 0.1,
      "work.days": 16,
      "work.cost": 833.9,
      "work.a.done": true,
      "work.b.done": null,
    },
  },
];
