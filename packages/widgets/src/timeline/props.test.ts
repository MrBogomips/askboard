import { describe, expect, test } from "bun:test";
import type { TimelineProps } from "@askboard/contract";
import { TIMELINE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { checkedTimelineProps, shownProps, valueFits } from "./props.ts";

// The Timeline checks its props as an agent's before it shows (view-and-widgets spec: Timeline
// layout; design decision 10): the shape the view's unchecked props might lack, then the contract's
// own check; a problem throws, naming the item, and the item's error boundary fails it (AD-10). The
// draft's value is shown only while it is the agent's Timeline with entries moved.
const SENT = TIMELINE_FIXTURE_ITEM.props;
const lanes = [{ id: "web", label: "Web" }];
const entries = [{ id: "x", label: "X", lane: "web", date: "2026-01-05" }];

describe("checkedTimelineProps", () => {
  test("props of 1 to 20 lanes and 1 to 200 entries come back as they were", () => {
    expect(checkedTimelineProps("roadmap", SENT)).toBe(SENT);
  });

  test("props that are no object, or hold no list of lanes or entries, throw, naming the item", () => {
    for (const props of [
      undefined,
      null,
      [],
      "x",
      {},
      { lanes },
      { entries },
      { lanes: "a", entries },
      { lanes, entries: null },
    ]) {
      expect(() => checkedTimelineProps("roadmap", props)).toThrow(
        'the Timeline "roadmap" refuses its props',
      );
    }
  });

  test("a count outside the limits throws", () => {
    expect(() => checkedTimelineProps("roadmap", { lanes: [], entries })).toThrow("1 to 20 lanes");
    expect(() => checkedTimelineProps("roadmap", { lanes, entries: [] })).toThrow(
      "1 to 200 entries",
    );
    const many = Array.from({ length: 21 }, (_, at) => ({ id: `l${at}`, label: "L" }));
    expect(() => checkedTimelineProps("roadmap", { lanes: many, entries })).toThrow(
      "1 to 20 lanes",
    );
  });

  test("a lane or entry with no string ID, label or lane, or a date of the wrong type, throws", () => {
    const bad = [
      { lanes: [{ label: "W" }], entries },
      { lanes: [{ id: 1, label: "W" }], entries },
      { lanes: [{ id: "web" }], entries },
      { lanes, entries: [{ id: "x", label: "X", date: "2026-01-05" }] },
      { lanes, entries: [{ id: "x", lane: "web", date: "2026-01-05" }] },
      { lanes, entries: [{ label: "X", lane: "web", date: "2026-01-05" }] },
      { lanes, entries: [{ ...entries[0], date: 20260105 }] },
      { lanes, entries: [{ id: "x", label: "X", lane: "web", start: 1, end: "2026-01-06" }] },
      { lanes, entries: [null] },
    ];
    for (const props of bad) {
      expect(() => checkedTimelineProps("roadmap", props)).toThrow("refuses its props");
    }
  });

  test("the contract's own check runs after the shape: an ID held twice, a lane or day it refuses", () => {
    expect(() =>
      checkedTimelineProps("roadmap", {
        lanes,
        entries: [{ id: "web", label: "X", lane: "web", date: "2026-01-05" }],
      }),
    ).toThrow("held twice");
    expect(() =>
      checkedTimelineProps("roadmap", {
        lanes,
        entries: [{ id: "x", label: "X", lane: "zz", date: "2026-01-05" }],
      }),
    ).toThrow('its lane "zz" is no lane');
    expect(() =>
      checkedTimelineProps("roadmap", {
        lanes,
        entries: [{ id: "x", label: "X", lane: "web", date: "2026-02-30" }],
      }),
    ).toThrow("is not a day");
    expect(() =>
      checkedTimelineProps("roadmap", {
        lanes,
        entries: [{ id: "x", label: "X", lane: "web" }],
      }),
    ).toThrow("an entry holds `date` alone");
  });
});

describe("shownProps", () => {
  const moved: TimelineProps = {
    ...SENT,
    entries: SENT.entries.map((entry) =>
      entry.id === "launch" ? { ...entry, lane: "web", date: "2026-03-09" } : entry,
    ),
  };

  test("is the draft's value while it is a Timeline, else the agent's", () => {
    expect(shownProps("roadmap", SENT, moved)).toBe(moved);
    expect(shownProps("roadmap", SENT, undefined)).toBe(SENT);
  });

  test("falls back to the agent's props for a value that is no Timeline or holds other entries", () => {
    const [first, second] = SENT.entries;
    for (const value of [
      null,
      "x",
      {},
      { ...moved, entries: [] },
      { ...moved, entries: [{ id: "zz", label: "Z", lane: "web", date: "2026-01-05" }] },
      { ...moved, lanes: SENT.lanes.slice(0, 1) },
      { ...moved, lanes: SENT.lanes.map((lane) => ({ ...lane, label: "changed" })) },
      { ...moved, entries: [{ ...first, label: "changed" }, second] },
      // A milestone made a range, and a range a milestone.
      {
        ...moved,
        entries: [first, { ...second, date: undefined, start: "2026-03-02", end: "2026-03-03" }],
      },
      {
        ...moved,
        entries: [
          { id: "checkout", label: "New checkout", lane: "web", date: "2026-01-05" },
          second,
        ],
      },
    ]) {
      expect(shownProps("roadmap", SENT, value)).toBe(SENT);
    }
  });
});

// One predicate for "this value fits the shown revision" (security review X-2): the component's
// `shownProps` and the shell's drops of a held value (the fact it registers) both ask it.
describe("valueFits", () => {
  const moved: TimelineProps = {
    ...SENT,
    entries: SENT.entries.map((entry) =>
      entry.id === "launch" ? { ...entry, lane: "web", date: "2026-03-09" } : entry,
    ),
  };

  test("is true for the agent's Timeline with entries moved, and for the agent's own", () => {
    expect(valueFits(moved, SENT)).toBe(true);
    expect(valueFits(SENT, SENT)).toBe(true);
  });

  test("is false for a value of another Timeline: other lanes, labels or kinds, or no Timeline", () => {
    const [first, second] = SENT.entries;
    for (const value of [
      undefined,
      null,
      "x",
      {},
      { ...moved, lanes: SENT.lanes.slice(0, 1) },
      { ...moved, lanes: SENT.lanes.map((lane) => ({ ...lane, label: "changed" })) },
      { ...moved, entries: [{ ...first, label: "changed" }, second] },
    ]) {
      expect(valueFits(value, SENT)).toBe(false);
    }
  });

  test("is false against props that are no Timeline, and agrees with what shownProps shows", () => {
    expect(valueFits(moved, { lanes: [], entries: [] })).toBe(false);
    expect(valueFits(moved, undefined)).toBe(false);
    expect(shownProps("roadmap", SENT, moved) === moved).toBe(valueFits(moved, SENT));
  });
});
