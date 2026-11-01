import { describe, expect, test } from "bun:test";
import { systemClock } from "../src/clock.ts";

// The Clock adapter the session entry point gives ask-core (ask-lifecycle, design decision 3).

describe("the system clock", () => {
  test("now is the runtime's time in milliseconds", () => {
    const before = Date.now();
    const now = systemClock.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  test("after runs once when its time comes, and a cancelled timer never runs", async () => {
    const ran: string[] = [];
    systemClock.after(1, () => ran.push("kept"));
    const cancel = systemClock.after(1, () => ran.push("cancelled"));
    cancel();
    await Bun.sleep(20);
    expect(ran).toEqual(["kept"]);
  });
});
