import { describe, expect, test } from "bun:test";
import {
  snapshotPresentationOf,
  snapshotTitleOf,
  takenAtOf,
  topLineOf,
} from "./opened-snapshot.ts";
import { DEFAULT_PRESENTATION } from "./presentation-controls.ts";

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

describe("the presentation an opened Snapshot starts in (snapshot-toolbar, design decision 4)", () => {
  const record = { takenAt: "2026-10-28T15:12:00Z", takenBy: "agent" } as const;

  test("is the record's theme and density, the placement beside, nothing locked", () => {
    expect(
      snapshotPresentationOf({
        ...record,
        presentation: { theme: "light", density: "comfortable" },
      }),
    ).toEqual({ theme: "light", density: "comfortable", contextPlacement: "beside", locked: [] });
  });

  test("a record with no presentation gives the defaults", () => {
    expect(snapshotPresentationOf(record)).toEqual(DEFAULT_PRESENTATION);
  });

  test("a hand-edited presentation gives the defaults, never a class name", () => {
    for (const presentation of [
      { theme: "sepia", density: "compact" },
      { theme: "dark" },
      { theme: "dark", density: "huge" },
      "dark",
      null,
    ]) {
      expect(snapshotPresentationOf({ ...record, presentation } as never)).toEqual(
        DEFAULT_PRESENTATION,
      );
    }
  });
});
