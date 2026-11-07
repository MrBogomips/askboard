// The Timeline's model (latex-kanban-timeline, task 4.3; view-and-widgets spec: Timeline moves by
// drag, Timeline at the keyboard; design decision 10): an entry's move in time and across lanes,
// what a drag's drop makes of its travel, the keyboard's step and order, the draft's value and the
// moved entries.

import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  elementChanges,
  GANTT_FIRST_DATE,
  GANTT_LAST_DATE,
  TIMELINE_SHAPE,
  TIMELINE_WIDGET,
  type TimelineEntry,
  type TimelineProps,
  widgetChangesProblems,
} from "@askboard/contract";
import { TIMELINE_FIXTURE_ITEM, withWidgetTypes } from "@askboard/contract/fixtures";
import { widgetItemProblems } from "@askboard/contract/validate";
import { generator } from "../../test/tree-model.ts";
import { DRAG_THRESHOLD } from "../gantt/model/drag.ts";
import { dateOfDay, dayNumber, FIRST_DAY, LAST_DAY } from "../shared/time/date.ts";
import {
  dropOf,
  moveBy,
  movedOf,
  moveToLane,
  neighbour,
  orderOf,
  stepOf,
  TIMELINE_DRAG_THRESHOLD,
  valueFor,
} from "./model.ts";

const TYPES = withWidgetTypes(TIMELINE_WIDGET);
const ITEM = { type: "timeline", id: "roadmap" } as const;
const SENT = TIMELINE_FIXTURE_ITEM.props;
const entry = (props: TimelineProps, id: string): TimelineEntry =>
  props.entries.find((held) => held.id === id) as TimelineEntry;

/** The problems of a value as an edited Timeline and of its diff against `sent`, and the diff. */
const checked = (sent: TimelineProps, value: TimelineProps) => {
  const changes = elementChanges("roadmap", sent, value, TIMELINE_SHAPE);
  return {
    value: widgetItemProblems({ ...ITEM, props: value }, {}, "edited", TYPES),
    changes: widgetChangesProblems(ITEM, changes, TYPES),
    list: changes,
  };
};

describe("moveBy", () => {
  test("moves a milestone by days, a range with its length", () => {
    expect(entry(moveBy(SENT, "launch", 7), "launch")).toEqual({
      id: "launch",
      label: "Public launch",
      lane: "mobile",
      date: "2026-03-09",
    });
    const moved = entry(moveBy(SENT, "checkout", -4), "checkout");
    expect(moved).toMatchObject({ start: "2026-01-01", end: "2026-02-23" });
    expect(dayNumber(moved.end as string) - dayNumber(moved.start as string)).toBe(
      dayNumber("2026-02-27") - dayNumber("2026-01-05"),
    );
  });

  test("carries a range across a month, a year and a leap day", () => {
    const given: TimelineProps = {
      lanes: SENT.lanes,
      entries: [{ id: "r", label: "R", lane: "web", start: "2027-12-30", end: "2028-02-27" }],
    };
    expect(entry(moveBy(given, "r", 3), "r")).toMatchObject({
      start: "2028-01-02",
      end: "2028-03-01",
    });
  });

  test("leaves the other entries, the lanes and the label as they were, by identity", () => {
    const moved = moveBy(SENT, "launch", 1);
    expect(moved.lanes).toBe(SENT.lanes);
    expect(moved.entries[0]).toBe(SENT.entries[0] as TimelineEntry);
    expect(entry(moved, "launch").label).toBe("Public launch");
  });

  test("stops a milestone at the last day, and a range there with its length", () => {
    const given: TimelineProps = {
      lanes: SENT.lanes,
      entries: [
        { id: "m", label: "M", lane: "web", date: "9999-12-20" },
        { id: "r", label: "R", lane: "web", start: "9999-12-20", end: "9999-12-25" },
      ],
    };
    expect(entry(moveBy(given, "m", 400), "m").date).toBe(GANTT_LAST_DATE);
    expect(entry(moveBy(given, "r", 400), "r")).toMatchObject({
      start: "9999-12-26",
      end: GANTT_LAST_DATE,
    });
    expect(entry(moveBy(given, "r", Number.MAX_SAFE_INTEGER), "r").end).toBe(GANTT_LAST_DATE);
  });

  test("stops at the first day too", () => {
    const given: TimelineProps = {
      lanes: SENT.lanes,
      entries: [{ id: "r", label: "R", lane: "web", start: "1900-03-05", end: "1900-03-09" }],
    };
    expect(entry(moveBy(given, "r", -100), "r")).toMatchObject({
      start: GANTT_FIRST_DATE,
      end: "1900-03-06",
    });
    expect(GANTT_FIRST_DATE).toBe(dateOfDay(FIRST_DAY));
    expect(GANTT_LAST_DATE).toBe(dateOfDay(LAST_DAY));
  });

  test.each([
    ["no days", "launch", 0],
    ["a card the item does not hold", "zz", 3],
    ["a day count that is no whole number", "launch", 1.5],
    ["not a number", "launch", Number.NaN],
  ])("is the same value, by identity, for %s", (_name, id, days) => {
    expect(moveBy(SENT, id, days)).toBe(SENT);
  });

  test("is the same value when the move stops at the edge it is already on", () => {
    const given: TimelineProps = {
      lanes: SENT.lanes,
      entries: [{ id: "m", label: "M", lane: "web", date: GANTT_LAST_DATE }],
    };
    expect(moveBy(given, "m", 5)).toBe(given);
  });

  test("gives a frozen value and leaves a frozen input untouched", () => {
    const frozen = Object.freeze({
      ...SENT,
      entries: Object.freeze(SENT.entries.map((held) => Object.freeze({ ...held }))),
    });
    const before = JSON.stringify(frozen);
    const moved = moveBy(frozen, "checkout", 2);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(Object.isFrozen(moved)).toBe(true);
    expect(Object.isFrozen(moved.entries)).toBe(true);
    expect(Object.isFrozen(entry(moved, "checkout"))).toBe(true);
  });
});

describe("moveToLane", () => {
  test("changes the entry's lane and nothing else", () => {
    const moved = moveToLane(SENT, "checkout", "mobile");
    expect(entry(moved, "checkout")).toEqual({ ...entry(SENT, "checkout"), lane: "mobile" });
    expect(moved.entries[1]).toBe(SENT.entries[1] as TimelineEntry);
    expect(Object.isFrozen(moved)).toBe(true);
    expect(Object.isFrozen(entry(moved, "checkout"))).toBe(true);
  });

  test.each([
    ["the entry's own lane", "checkout", "web"],
    ["an entry the item does not hold", "zz", "mobile"],
    ["a lane the item does not hold", "checkout", "elsewhere"],
    ["an entry's ID as the lane", "checkout", "launch"],
  ])("is the same value, by identity, for %s", (_name, id, lane) => {
    expect(moveToLane(SENT, id, lane)).toBe(SENT);
  });
});

describe("dropOf", () => {
  test("is a click for a travel under the threshold in both directions", () => {
    expect(TIMELINE_DRAG_THRESHOLD).toBe(DRAG_THRESHOLD);
    for (const zoom of ["day", "week", "month"] as const) {
      expect(dropOf({ dx: 2.9, dy: -2.9, laneAt: "mobile" }, zoom)).toEqual({ kind: "click" });
      expect(dropOf({ dx: 0, dy: 0, laneAt: undefined }, zoom)).toEqual({ kind: "click" });
    }
  });

  test.each([
    ["day", 32, 1],
    ["day", 47, 1],
    ["day", 49, 2],
    ["day", -49, -2],
    ["day", 224, 7],
    ["week", 105, 7],
    ["week", 7, 0],
    ["week", 8, 1],
    ["week", -8, -1],
    ["week", -7, 0],
    ["month", 28, 7],
    ["month", 5, 1],
    ["month", -5, -1],
  ] as const)("at %s zoom %p pixels snap to %p days", (zoom, dx, days) => {
    expect(dropOf({ dx, dy: 0, laneAt: "web" }, zoom)).toEqual({ kind: "move", days, lane: "web" });
  });

  test("snaps halves away from zero, and never to negative zero", () => {
    expect(dropOf({ dx: 48, dy: 0, laneAt: undefined }, "day")).toEqual({
      kind: "move",
      days: 2,
      lane: undefined,
    });
    expect(dropOf({ dx: -48, dy: 0, laneAt: undefined }, "day")).toEqual({
      kind: "move",
      days: -2,
      lane: undefined,
    });
    const nothing = dropOf({ dx: 5, dy: 0, laneAt: "web" }, "day");
    expect(Object.is((nothing as { days: number }).days, 0)).toBe(true);
  });

  test("a vertical drag moves no days, whatever the zoom rounds a stray few pixels to", () => {
    expect(dropOf({ dx: 2, dy: 40, laneAt: "mobile" }, "month")).toEqual({
      kind: "move",
      days: 0,
      lane: "mobile",
    });
  });

  test("a drop over no lane keeps the entry's own", () => {
    expect(dropOf({ dx: 64, dy: 400, laneAt: undefined }, "day")).toEqual({
      kind: "move",
      days: 2,
      lane: undefined,
    });
  });
});

describe("stepOf", () => {
  test("is a day at day zoom and a week at week and month zoom", () => {
    expect(stepOf("day")).toBe(1);
    expect(stepOf("week")).toBe(7);
    expect(stepOf("month")).toBe(7);
  });
});

describe("movedOf and valueFor", () => {
  test("name the entries whose lane or days differ from the props as sent, in `entries` order", () => {
    expect(movedOf(SENT, SENT)).toEqual([]);
    const moved = moveToLane(moveBy(SENT, "launch", 7), "checkout", "mobile");
    expect(movedOf(SENT, moved)).toEqual(["checkout", "launch"]);
    expect(movedOf(SENT, moveBy(SENT, "launch", 1))).toEqual(["launch"]);
  });

  test("count an entry moved away and back as not moved, and leave the draft no value", () => {
    const away = moveToLane(moveBy(SENT, "checkout", 9), "checkout", "mobile");
    const back = moveToLane(moveBy(away, "checkout", -9), "checkout", "web");
    expect(back).toEqual(SENT);
    expect(movedOf(SENT, back)).toEqual([]);
    expect(valueFor(SENT, back)).toBeUndefined();
    expect(valueFor(SENT, SENT)).toBeUndefined();
  });

  test("give the edited props while any entry has moved", () => {
    const moved = moveBy(SENT, "launch", 7);
    expect(valueFor(SENT, moved)).toBe(moved);
  });

  test("see a milestone that became a range, or lost a date, as moved", () => {
    const given: TimelineProps = {
      lanes: SENT.lanes,
      entries: [{ id: "x", label: "X", lane: "web", date: "2026-01-05" }],
    };
    const range: TimelineProps = {
      lanes: SENT.lanes,
      entries: [{ id: "x", label: "X", lane: "web", start: "2026-01-05", end: "2026-01-05" }],
    };
    expect(movedOf(given, range)).toEqual(["x"]);
  });
});

describe("orderOf", () => {
  test("lists the entries by lane order, then by start, then by `entries` order", () => {
    const given: TimelineProps = {
      lanes: [
        { id: "web", label: "Web" },
        { id: "mobile", label: "Mobile" },
      ],
      entries: [
        { id: "m-late", label: "", lane: "mobile", date: "2026-03-01" },
        { id: "w-b", label: "", lane: "web", start: "2026-01-05", end: "2026-01-06" },
        { id: "w-late", label: "", lane: "web", date: "2026-02-01" },
        { id: "w-a", label: "", lane: "web", date: "2026-01-05" },
        { id: "m-early", label: "", lane: "mobile", start: "2026-02-01", end: "2026-02-09" },
      ],
    };
    expect(orderOf(given)).toEqual(["w-b", "w-a", "w-late", "m-early", "m-late"]);
  });

  test("puts an entry in no lane of the item last, and one with no days after its lane's", () => {
    const given: TimelineProps = {
      lanes: SENT.lanes,
      entries: [
        { id: "lost", label: "", lane: "nowhere", date: "2026-01-01" },
        { id: "none", label: "", lane: "web" },
        { id: "dated", label: "", lane: "web", date: "2026-05-01" },
      ],
    };
    expect(orderOf(given)).toEqual(["dated", "none", "lost"]);
  });
});

describe("neighbour", () => {
  const order = ["a", "b", "c"];

  test.each([
    ["b", "up", "a"],
    ["b", "down", "c"],
    ["a", "up", "a"],
    ["c", "down", "c"],
    ["b", "home", "a"],
    ["b", "end", "c"],
    ["c", "home", "a"],
    ["a", "end", "c"],
  ] as const)("from %s, %s reaches %s", (current, key, reached) => {
    expect(neighbour(order, current, key)).toBe(reached);
  });

  test("names no entry for a current entry the order does not hold, and none for an empty order", () => {
    expect(neighbour(order, "zz", "down")).toBeUndefined();
    expect(neighbour([], "a", "end")).toBeUndefined();
  });
});

describe("any sequence of moves", () => {
  const dayOf = (random: ReturnType<typeof generator>): string => {
    // Mostly near today's, now and then at an edge of the days a Gantt may name.
    const edge = random.int(10);
    if (edge === 0) return dateOfDay(FIRST_DAY + random.int(40));
    if (edge === 1) return dateOfDay(LAST_DAY - 40 - random.int(40));
    return dateOfDay(dayNumber("2026-01-01") + random.int(400));
  };
  const timelineOf = (random: ReturnType<typeof generator>): TimelineProps => {
    const lanes = Array.from({ length: 1 + random.int(5) }, (_, at) => ({
      id: `l${at}`,
      label: `Lane ${at}`,
    }));
    const entries = Array.from({ length: 1 + random.int(12) }, (_, at): TimelineEntry => {
      const lane = random.pick(lanes).id;
      const start = dayOf(random);
      const room = Math.min(40, LAST_DAY - dayNumber(start));
      return random.int(2) === 0
        ? { id: `e${at}`, label: `Entry ${at}`, lane, date: start }
        : {
            id: `e${at}`,
            label: `Entry ${at}`,
            lane,
            start,
            end: dateOfDay(dayNumber(start) + random.int(room + 1)),
          };
    });
    return { lanes, entries };
  };

  test("500 seeded sequences stay valid, diff to `set`s of lane and days only, and round-trip", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const random = generator(seed);
      const sent = timelineOf(random);
      expect({ seed, problems: checked(sent, sent).value }).toEqual({ seed, problems: [] });
      let value = sent;
      for (let step = 0; step < 30; step++) {
        const id = random.pick(sent.entries).id;
        const before = entry(value, id);
        const lengthBefore =
          before.start === undefined
            ? undefined
            : dayNumber(before.end as string) - dayNumber(before.start);
        value =
          random.int(3) === 0
            ? moveToLane(value, id, random.pick(sent.lanes).id)
            : moveBy(
                value,
                id,
                random.int(2) === 0 ? random.int(400) - 200 : random.int(20_000_000) - 10_000_000,
              );
        const where = { seed, step };
        const { value: valueProblems, changes: changesProblems, list } = checked(sent, value);
        expect({ ...where, valueProblems }).toEqual({ ...where, valueProblems: [] });
        expect({ ...where, changesProblems }).toEqual({ ...where, changesProblems: [] });
        expect({ ...where, ops: list.filter(({ op }) => op !== "set") }).toEqual({
          ...where,
          ops: [],
        });
        const after = entry(value, id);
        if (lengthBefore !== undefined) {
          expect(dayNumber(after.end as string) - dayNumber(after.start as string)).toBe(
            lengthBefore,
          );
        }
        expect(value.entries.map(({ id: held }) => held)).toEqual(
          sent.entries.map(({ id: held }) => held),
        );
        expect(applyElementChanges("roadmap", sent, list, TIMELINE_SHAPE)).toEqual(value);
        expect({ ...where, kept: valueFor(sent, value) === undefined }).toEqual({
          ...where,
          kept: list.length === 0,
        });
        expect(movedOf(sent, value).length).toBeLessThanOrEqual(list.length);
      }
    }
  });
});
