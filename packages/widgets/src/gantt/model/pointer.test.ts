import { describe, expect, test } from "bun:test";
import { doubleClickAction } from "./pointer.ts";

const open = { editable: true, busy: false } as const;

describe("a double click on a Gantt grid cell", () => {
  test("opens the editor of an editable start or duration", () => {
    expect(doubleClickAction({ column: "start", ...open })).toEqual({
      kind: "edit",
      column: "start",
    });
    expect(doubleClickAction({ column: "duration", ...open })).toEqual({
      kind: "edit",
      column: "duration",
    });
  });

  test("opens the predecessors panel on an editable predecessors cell", () => {
    expect(doubleClickAction({ column: "dependencies", ...open })).toEqual({ kind: "panel" });
  });

  test("does nothing on a name, which no editor takes", () => {
    expect(doubleClickAction({ column: "task", editable: false, busy: false })).toBeUndefined();
    expect(doubleClickAction({ column: "task", ...open })).toBeUndefined();
  });

  test("does nothing on a cell that is not editable, as in a read-only Gantt", () => {
    for (const column of ["start", "duration", "dependencies"] as const) {
      expect(doubleClickAction({ column, editable: false, busy: false })).toBeUndefined();
    }
  });

  test("does nothing while an editor or a panel is open", () => {
    for (const column of ["start", "duration", "dependencies"] as const) {
      expect(doubleClickAction({ column, editable: true, busy: true })).toBeUndefined();
    }
  });
});
