import { describe, expect, test } from "bun:test";
import { isCriticalLink } from "./critical-link.ts";

const bar = (start: string, finish: string, critical: boolean) => ({ start, finish, critical });

describe("a critical link", () => {
  test("joins two critical tasks, the successor starting the working day after the predecessor", () => {
    expect(
      isCriticalLink(bar("2026-11-02", "2026-11-03", true), bar("2026-11-04", "2026-11-06", true)),
    ).toBe(true);
  });

  test("steps over a weekend", () => {
    expect(
      isCriticalLink(bar("2026-11-02", "2026-11-06", true), bar("2026-11-09", "2026-11-10", true)),
    ).toBe(true);
  });

  test("is not one when the successor starts later: the link has slack though both tasks are critical", () => {
    expect(
      isCriticalLink(bar("2026-11-02", "2026-11-03", true), bar("2026-11-09", "2026-11-10", true)),
    ).toBe(false);
  });

  test("is not one when either task is not critical", () => {
    expect(
      isCriticalLink(bar("2026-11-02", "2026-11-03", false), bar("2026-11-04", "2026-11-05", true)),
    ).toBe(false);
    expect(
      isCriticalLink(bar("2026-11-02", "2026-11-03", true), bar("2026-11-04", "2026-11-05", false)),
    ).toBe(false);
  });

  test("follows a milestone, which finishes the working day before it starts", () => {
    const milestone = bar("2026-11-04", "2026-11-03", true);
    expect(isCriticalLink(bar("2026-11-02", "2026-11-03", true), milestone)).toBe(true);
    expect(isCriticalLink(milestone, bar("2026-11-04", "2026-11-06", true))).toBe(true);
  });
});
