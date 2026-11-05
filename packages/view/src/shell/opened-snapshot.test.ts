import { describe, expect, test } from "bun:test";
import { snapshotTitleOf, takenAtOf, topLineOf } from "./opened-snapshot.ts";

describe("an opened Snapshot's top line", () => {
  test("says when, in the viewer's zone, and by the agent", () => {
    expect(takenAtOf("2026-10-28T15:12:00Z", "Europe/Rome")).toBe("Oct 28, 2026, 4:12 PM");
    expect(topLineOf({ takenAt: "2026-10-28T15:12:00Z", takenBy: "agent" }, "Europe/Rome")).toEqual(
      {
        taken: " · taken Oct 28, 2026, 4:12 PM by the agent · read-only",
      },
    );
  });

  test("names the user, and notes unsent work only when the record says it", () => {
    const user = { takenAt: "2026-10-28T15:12:00Z", takenBy: "user", who: "Giulia Rossi" } as const;
    expect(topLineOf(user, "UTC").taken).toContain("by Giulia Rossi");
    expect(topLineOf(user, "UTC").note).toBeUndefined();
    expect(topLineOf({ ...user, unsentWork: true }, "UTC").note).toBe(
      "Your unsent work will not be in the Snapshot",
    );
  });

  test("the tab title keeps the ask's title as text", () => {
    expect(snapshotTitleOf("<b>x</b>")).toBe("Snapshot · <b>x</b>");
  });
});
