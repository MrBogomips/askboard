import { describe, expect, test } from "bun:test";
import { movedBox, resizedBox } from "./preview.ts";

const BOX = { x: 480, y: 223, width: 120, height: 14 };
const ORIGIN = "2026-11-02";

describe("a bar while it is dragged", () => {
  test("is drawn at the day it would land on, its width kept", () => {
    expect(movedBox(BOX, { kind: "request", start: "2026-12-14" }, ORIGIN, "week")).toEqual({
      ...BOX,
      x: 630,
    });
    expect(movedBox(BOX, { kind: "clear", start: "2026-12-04" }, ORIGIN, "week").x).toBe(480);
  });

  test("stays where it is for a press that is still a click", () => {
    expect(movedBox(BOX, { kind: "click" }, ORIGIN, "week")).toBe(BOX);
  });
});

describe("a bar while its end is dragged", () => {
  test("ends on the nearest day under its end", () => {
    expect(resizedBox(BOX, 30, "week")).toEqual({ ...BOX, width: 150 });
    expect(resizedBox(BOX, 37, "week").width).toBe(150);
    expect(resizedBox(BOX, -38, "week").width).toBe(75);
  });

  test("keeps at least its first day", () => {
    expect(resizedBox(BOX, -400, "week").width).toBe(15);
    expect(resizedBox({ ...BOX, width: 32 }, -64, "day").width).toBe(32);
  });
});
