import { describe, expect, test } from "bun:test";
import { TIMELINE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { otherLanes, timelineKeyOf, timelineTools } from "./keys.ts";

// The Timeline at the keyboard (view-and-widgets spec: Timeline at the keyboard; design decision
// 10): the vertical arrows, Home and End are the entries'; "Move earlier" and "Move later" act
// while the entry has a day to go to, "Move to lane…" while there is another lane, and none for a
// read-only Timeline or with no current entry.
const SENT = TIMELINE_FIXTURE_ITEM.props;
const ONE_LANE = { lanes: SENT.lanes.slice(0, 1), entries: SENT.entries.slice(0, 1) };

describe("timelineKeyOf", () => {
  test("names Up, Down, Home and End and no other key", () => {
    expect(["ArrowUp", "ArrowDown", "Home", "End"].map(timelineKeyOf)).toEqual([
      "up",
      "down",
      "home",
      "end",
    ]);
    for (const key of ["ArrowLeft", "ArrowRight", "Enter", " ", "a", "toString", "__proto__"]) {
      expect(timelineKeyOf(key)).toBeUndefined();
    }
  });
});

describe("timelineTools", () => {
  test("every tool acts for a current entry in the middle of the days, with another lane", () => {
    expect(timelineTools(SENT, "launch", false, "week")).toEqual({
      earlier: true,
      later: true,
      lane: true,
    });
  });

  test("Move later is off at the last day, Move earlier at the first, each only while the step cannot move at all", () => {
    const last = {
      ...SENT,
      entries: [{ id: "launch", label: "L", lane: "mobile", date: "9999-12-31" }],
    };
    expect(timelineTools(last, "launch", false, "week")).toMatchObject({
      earlier: true,
      later: false,
    });
    const first = {
      ...SENT,
      entries: [{ id: "launch", label: "L", lane: "mobile", date: "1900-03-02" }],
    };
    expect(timelineTools(first, "launch", false, "week")).toMatchObject({
      earlier: false,
      later: true,
    });
    // One day short of the last: a week's step still moves it, to the last day.
    const near = {
      ...SENT,
      entries: [{ id: "launch", label: "L", lane: "mobile", date: "9999-12-30" }],
    };
    expect(timelineTools(near, "launch", false, "week").later).toBe(true);
  });

  test("Move to lane is off with a single lane", () => {
    expect(timelineTools(ONE_LANE, "checkout", false, "day")).toMatchObject({
      earlier: true,
      later: true,
      lane: false,
    });
  });

  test("none acts for no current entry, one the item lacks, or a read-only Timeline", () => {
    const off = { earlier: false, later: false, lane: false };
    expect(timelineTools(SENT, undefined, false, "week")).toEqual(off);
    expect(timelineTools(SENT, "zz", false, "week")).toEqual(off);
    expect(timelineTools(SENT, "launch", true, "week")).toEqual(off);
  });
});

describe("otherLanes", () => {
  test("are the lanes but the current entry's, in the agent's order, by ID and label", () => {
    expect(otherLanes(SENT, "checkout")).toEqual([{ id: "mobile", label: "Mobile" }]);
    expect(otherLanes(SENT, "launch")).toEqual([{ id: "web", label: "Web" }]);
  });

  test("are none for no current entry or one the item lacks", () => {
    expect(otherLanes(SENT, undefined)).toEqual([]);
    expect(otherLanes(SENT, "zz")).toEqual([]);
  });
});
