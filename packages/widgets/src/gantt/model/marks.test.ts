import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_SHAPE } from "@askboard/contract";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { requestStart, setDuration, setPredecessors } from "./edits.ts";
import { changeCount, changeCounter, ownTaskMarks } from "./marks.ts";
import type { GanttOwnProps } from "./tasks.ts";

const SENT = ganttBoardDocument.items[0].props.items[0].props as GanttOwnProps;

const UNMARKED = { start: false, duration: false, dependencies: false, changed: false };

describe("a Gantt's change marks", () => {
  test("mark nothing on the agent's value", () => {
    const marks = ownTaskMarks(SENT, SENT);
    expect([...marks.keys()]).toEqual(SENT.tasks.map((task) => task.id));
    for (const mark of marks.values()) expect(mark).toEqual(UNMARKED);
    expect(changeCount(marks)).toBe(0);
    // A copy compares by content, its predecessor lists element by element.
    const copied = ownTaskMarks(structuredClone(SENT), SENT);
    expect(changeCount(copied)).toBe(0);
  });

  test("mark each changed field against the agent's value, and nothing else", () => {
    const marks = ownTaskMarks(ganttEditedValue, SENT);
    expect(marks.get("billing")).toEqual({ ...UNMARKED, duration: true, changed: true });
    expect(marks.get("reporting")).toEqual({ ...UNMARKED, start: true, changed: true });
    // The portal moves with nothing: no task moved by a predecessor is marked.
    expect(marks.get("portal")).toEqual(UNMARKED);
    expect(changeCount(marks)).toBe(2);
  });

  test("mark changed predecessors", () => {
    const value = setPredecessors(SENT, SENT, "reporting", ["portal", "billing"]);
    expect(ownTaskMarks(value, SENT).get("reporting")).toEqual({
      ...UNMARKED,
      dependencies: true,
      changed: true,
    });
  });

  test("count a task changed in several fields once", () => {
    const value = setDuration(requestStart(SENT, SENT, "ux", "2026-11-04"), SENT, "ux", 3);
    const marks = ownTaskMarks(value, SENT);
    expect(marks.get("ux")).toEqual({
      start: true,
      duration: true,
      dependencies: false,
      changed: true,
    });
    expect(changeCount(marks)).toBe(1);
  });

  test("agree with the diff when the agent sent an empty list", () => {
    const tasks = [{ id: "a", label: "A", duration: 1, dependencies: [] }];
    const sent = { start: "2026-11-02", tasks };
    const value = { start: "2026-11-02", tasks: [{ id: "a", label: "A", duration: 1 }] };
    expect(ownTaskMarks(value, sent).get("a")?.dependencies).toBe(true);
    expect(elementChanges("g", sent, value, GANTT_SHAPE)).toHaveLength(1);
  });

  test("mark a task the agent did not send as changed", () => {
    const value = { ...SENT, tasks: [...SENT.tasks, { id: "extra", label: "Extra", duration: 2 }] };
    expect(ownTaskMarks(value, SENT).get("extra")).toEqual({
      start: false,
      duration: true,
      dependencies: false,
      changed: true,
    });
  });

  test("give frozen marks", () => {
    for (const mark of ownTaskMarks(ganttEditedValue, SENT).values()) {
      expect(Object.isFrozen(mark)).toBe(true);
    }
  });

  test.each([
    [0, "Changes vs agent's original · none yet"],
    [1, "Your changes: 1"],
    [2, "Your changes: 2"],
    [37, "Your changes: 37"],
  ])("read %i changes as %j on the toolbar", (count, text) => {
    expect(changeCounter(count)).toBe(text);
  });
});
