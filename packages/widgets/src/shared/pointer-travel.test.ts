import { describe, expect, test } from "bun:test";
import { dragOf, type Held } from "./pointer-travel.ts";

const held: Held<"move" | "resize"> = {
  id: "t1",
  kind: "move",
  pointerId: 3,
  from: { x: 100, y: 40 },
};

describe("a pointer drag reports its travel from the press (latex-kanban-timeline, design decision 10)", () => {
  test("the horizontal travel is dx and the vertical travel is dy, each signed", () => {
    expect(dragOf(held, { x: 130, y: 40 })).toEqual({ id: "t1", kind: "move", dx: 30, dy: 0 });
    expect(dragOf(held, { x: 90, y: 25 })).toEqual({ id: "t1", kind: "move", dx: -10, dy: -15 });
    expect(dragOf(held, { x: 100, y: 88 })).toEqual({ id: "t1", kind: "move", dx: 0, dy: 48 });
  });

  test("a pointer back at the press has no travel", () => {
    expect(dragOf(held, held.from)).toEqual({ id: "t1", kind: "move", dx: 0, dy: 0 });
  });

  test("the drag keeps the kind of what was pressed", () => {
    expect(dragOf({ ...held, kind: "resize" }, { x: 101, y: 41 }).kind).toBe("resize");
  });
});
