import { describe, expect, test } from "bun:test";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { GANTT_COLUMNS, type GanttOwnProps, isOwnGantt, ownTaskRows } from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
const SENT = release.props as GanttOwnProps;

describe("a Gantt's rows", () => {
  test("lists its own tasks in their order, each with its fields", () => {
    const rows = ownTaskRows(SENT);
    expect(rows.map((row) => row.id)).toEqual([
      "ux",
      "architecture",
      "prototype",
      "portal",
      "billing",
      "reporting",
    ]);
    expect(rows[0]).toEqual({
      id: "ux",
      label: "UX design",
      sent: true,
      start: undefined,
      duration: 6,
      dependencies: [],
      cells: [
        { column: "task", editable: false },
        { column: "start", editable: true },
        { column: "duration", editable: true },
        { column: "dependencies", editable: true },
      ],
    });
    expect(rows[3]?.dependencies).toEqual(["architecture", "prototype"]);
  });

  test("shows the edited value's requested starts and durations", () => {
    const rows = ownTaskRows(ganttEditedValue);
    expect(rows.find((row) => row.id === "reporting")?.start).toBe("2026-12-09");
    expect(rows.find((row) => row.id === "billing")?.duration).toBe(11);
  });

  test("keeps a name as the characters the agent sent", () => {
    const label = "<img src=x onerror=alert(1)>";
    const [row] = ownTaskRows({ start: "2026-11-02", tasks: [{ id: "a", label, duration: 1 }] });
    expect(row?.label).toBe(label);
  });

  test("gives no row for a Gantt with no task", () => {
    expect(ownTaskRows({ start: "2026-11-02", tasks: [] })).toEqual([]);
  });

  test("gives frozen rows", () => {
    const rows = ownTaskRows(SENT);
    expect(Object.isFrozen(rows)).toBe(true);
    for (const row of rows) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.dependencies)).toBe(true);
      expect(Object.isFrozen(row.cells)).toBe(true);
    }
  });

  test("puts the grid's columns in order", () => {
    expect(GANTT_COLUMNS).toEqual(["task", "start", "duration", "dependencies"]);
  });

  test("tells a Gantt with its own tasks from a plan", () => {
    expect(isOwnGantt(SENT)).toBe(true);
    expect(isOwnGantt({ start: "2026-11-02", workPackages: "wbs", tasks: {} })).toBe(false);
  });
});
