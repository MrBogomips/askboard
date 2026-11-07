// The Timeline's entry (latex-kanban-timeline, task 1.5; contract spec: Timeline items, Timeline
// changes), composed over the shipped registry with `withWidgetTypes` while the type is not yet
// registered (design decision 12), in a fresh Ajv.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  EDIT_WIDGETS_SESSION,
  TIMELINE_CHANGES,
  TIMELINE_EDITED_PROPS,
  TIMELINE_FIXTURE_ITEM,
  timelineAct,
  timelineAnswerEvent,
  timelineFetchItemResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  applyElementChanges,
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  elementChanges,
  TIMELINE_MAX_ENTRIES,
  TIMELINE_MAX_LANES,
  TIMELINE_SCHEMA_IDS,
  TIMELINE_SHAPE,
  TIMELINE_WIDGET,
  timelinePropsProblems,
  widgetChangesProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { elementShapeOf, validateBoardMessage } from "../src/validate.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(TIMELINE_WIDGET);
const ITEM = TIMELINE_FIXTURE_ITEM;
const LANES = ITEM.props.lanes;
const timeline = (props: unknown, id = "roadmap") => ({ type: "timeline", id, props });
const withEntries = (entries: unknown, lanes: unknown = LANES) => timeline({ lanes, entries });
const problems = (item: unknown) => askProblems(TYPES, item as ReturnType<typeof timeline>);
const fieldsOf = (item: unknown) => problems(item).map(({ field }) => field);
const lanes = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `l${index}`, label: `Lane ${index}` }));
const entries = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `e${index}`,
    label: `Entry ${index}`,
    lane: "web",
    date: "2026-01-05",
  }));
const milestone = (extra: object = {}) => ({
  id: "launch",
  label: "Launch",
  lane: "web",
  date: "2026-03-02",
  ...extra,
});
const range = (extra: object = {}) => ({
  id: "checkout",
  label: "Checkout",
  lane: "web",
  start: "2026-01-05",
  end: "2026-02-27",
  ...extra,
});
const without = (entry: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(entry).filter(([name]) => name !== key));

describe("Timeline items", () => {
  test("a roadmap of two lanes, a range and a milestone passes, in an ask and a board document", () => {
    expect(problems(ITEM)).toEqual([]);
    expect(askAccepted(TYPES, ITEM)).toBe(true);
    const document = {
      version: BOARD_DOCUMENT_VERSION,
      askId: "timeline-check-a1b2",
      title: "Does the roadmap hold?",
      items: [{ type: "question", id: "q", rev: 1, props: { text: "Move it", items: [ITEM] } }],
    };
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.boardDocument, document)).toEqual([]);
    expect(ITEM.props.lanes.map(({ id }) => id)).toEqual(["web", "mobile"]);
    expect(ITEM.props.entries.map((entry) => entry.id)).toEqual(["checkout", "launch"]);
  });

  test("a one-day range passes", () => {
    expect(problems(withEntries([range({ start: "2026-01-05", end: "2026-01-05" })]))).toEqual([]);
  });

  test("an entry that is neither a milestone nor a range fails, naming the item and the entry", () => {
    const bad = [
      milestone({ end: "2026-03-05" }),
      without(range(), "end"),
      without(range(), "start"),
      range({ date: "2026-03-02" }),
      without(milestone(), "date"),
    ];
    for (const entry of bad) {
      const [problem, ...rest] = problems(withEntries([entry]));
      expect(rest).toEqual([]);
      expect(problem?.itemId).toBe("roadmap");
      expect(problem?.field).toBe("props.entries[0]");
      expect(problem?.message).toContain('item "roadmap"');
      expect(problem?.message).toContain(`entry "${entry.id}"`);
      expect(problem?.message).toContain("`date` alone");
      expect(problem?.message).toContain("`start` and `end`");
    }
  });

  test("a range that ends before it starts fails, naming the item, the entry and end", () => {
    const [problem, ...rest] = problems(
      withEntries([range({ start: "2026-01-05", end: "2026-01-04" })]),
    );
    expect(rest).toEqual([]);
    expect(problem?.field).toBe("props.entries[0].end");
    expect(problem?.message).toContain('item "roadmap"');
    expect(problem?.message).toContain('entry "checkout"');
    expect(problem?.message).toContain("2026-01-04");
  });

  test("a day that does not exist fails, naming the item, the entry and date", () => {
    const [problem, ...rest] = problems(withEntries([milestone({ date: "2027-02-29" })]));
    expect(rest).toEqual([]);
    expect(problem?.field).toBe("props.entries[0].date");
    expect(problem?.message).toContain('item "roadmap"');
    expect(problem?.message).toContain('entry "launch"');
    expect(problem?.message).toContain("2027-02-29");
    expect(fieldsOf(withEntries([range({ start: "2026-04-31" })]))).toEqual([
      "props.entries[0].start",
    ]);
    expect(fieldsOf(withEntries([range({ end: "2026-13-01" })]))).toEqual(["props.entries[0].end"]);
  });

  test("the Gantt's first and last days: 1900-03-01 fails, 1900-03-02 and 9999-12-31 pass", () => {
    expect(fieldsOf(withEntries([milestone({ date: "1900-03-01" })]))).toEqual([
      "props.entries[0].date",
    ]);
    expect(problems(withEntries([milestone({ date: "1900-03-02" })]))).toEqual([]);
    expect(problems(withEntries([milestone({ date: "9999-12-31" })]))).toEqual([]);
    expect(fieldsOf(withEntries([range({ start: "1899-12-31", end: "1900-03-02" })]))).toEqual([
      "props.entries[0].start",
    ]);
    expect(askAccepted(TYPES, withEntries([milestone({ date: "9999-12-31" })]))).toBe(true);
  });

  test("a leap day: 2028-02-29 passes, 2027-02-29 fails; a century that is no leap year fails", () => {
    expect(problems(withEntries([milestone({ date: "2028-02-29" })]))).toEqual([]);
    expect(fieldsOf(withEntries([milestone({ date: "2027-02-29" })]))).toEqual([
      "props.entries[0].date",
    ]);
    expect(problems(withEntries([milestone({ date: "2000-02-29" })]))).toEqual([]);
    expect(fieldsOf(withEntries([milestone({ date: "2100-02-29" })]))).toEqual([
      "props.entries[0].date",
    ]);
  });

  test("a date that is no full-date fails by the schema, naming the field", () => {
    for (const date of ["2026-1-5", "05/01/2026", "2026-01-05T00:00:00Z", 20260105, null, ""]) {
      expect(fieldsOf(withEntries([milestone({ date })]))).toEqual(["props.entries[0].date"]);
    }
    expect(askAccepted(TYPES, withEntries([milestone({ date: "2026-1-5" })]))).toBe(false);
  });

  test("1 lane passes, none fails, 20 pass and 21 fail", () => {
    expect([TIMELINE_MAX_LANES, TIMELINE_MAX_ENTRIES]).toEqual([20, 200]);
    expect(problems(withEntries([milestone({ lane: "l0" })], lanes(1)))).toEqual([]);
    expect(fieldsOf(withEntries([milestone()], []))).toEqual(["props.lanes"]);
    expect(problems(withEntries([milestone({ lane: "l0" })], lanes(20)))).toEqual([]);
    expect(askAccepted(TYPES, withEntries([milestone({ lane: "l0" })], lanes(20)))).toBe(true);
    expect(fieldsOf(withEntries([milestone({ lane: "l0" })], lanes(21)))).toEqual(["props.lanes"]);
    expect(askAccepted(TYPES, withEntries([milestone({ lane: "l0" })], lanes(21)))).toBe(false);
  });

  test("1 entry passes, none fails, 200 pass and 201 fail", () => {
    expect(problems(withEntries(entries(1)))).toEqual([]);
    expect(fieldsOf(withEntries([]))).toEqual(["props.entries"]);
    expect(problems(withEntries(entries(200)))).toEqual([]);
    expect(askAccepted(TYPES, withEntries(entries(200)))).toBe(true);
    expect(fieldsOf(withEntries(entries(201)))).toEqual(["props.entries"]);
    expect(askAccepted(TYPES, withEntries(entries(201)))).toBe(false);
  });

  test("labels: a lane's 60 pass and 61 fail, an entry's 200 pass and 201 fail, none fails", () => {
    const lane = (label: unknown) =>
      withEntries([milestone({ lane: "web" })], [{ id: "web", label }]);
    expect(problems(lane("l".repeat(60)))).toEqual([]);
    const [long] = problems(lane("l".repeat(61)));
    expect(long?.field).toBe("props.lanes[0].label");
    expect(long?.message).toContain('lane "web"');
    expect(fieldsOf(lane(""))).toEqual(["props.lanes[0].label"]);
    expect(problems(withEntries([milestone({ label: "l".repeat(200) })]))).toEqual([]);
    const [entry] = problems(withEntries([milestone({ label: "l".repeat(201) })]));
    expect(entry?.field).toBe("props.entries[0].label");
    expect(entry?.message).toContain('entry "launch"');
    expect(fieldsOf(withEntries([milestone({ label: "" })]))).toEqual(["props.entries[0].label"]);
  });

  test("an entry in no lane fails, naming the item, the entry and lane", () => {
    const [problem, ...rest] = problems(withEntries([milestone({ lane: "ops" })]));
    expect(rest).toEqual([]);
    expect(problem?.field).toBe("props.entries[0].lane");
    expect(problem?.message).toContain('item "roadmap"');
    expect(problem?.message).toContain('entry "launch"');
    expect(problem?.message).toContain('"ops"');
  });

  test("an ID held twice, a lane's and an entry's included, fails, naming the ID", () => {
    const entryTwice = problems(withEntries([milestone(), milestone({ label: "Again" })]));
    expect(entryTwice.map(({ field }) => field)).toEqual(["props.entries[1].id"]);
    expect(entryTwice[0]?.message).toContain('"launch"');
    const clash = problems(withEntries([milestone({ id: "web" })]));
    expect(clash.map(({ field }) => field)).toEqual(["props.entries[0].id"]);
    expect(clash[0]?.message).toContain('"web"');
    const laneTwice = problems(
      withEntries([milestone()], [...LANES, { id: "web", label: "Again" }]),
    );
    expect(laneTwice.map(({ field }) => field)).toEqual(["props.lanes[2].id"]);
  });

  test("an ID outside the pattern, a missing or an unknown field fails", () => {
    expect(fieldsOf(withEntries([milestone({ id: "a b" })]))).toEqual(["props.entries[0].id"]);
    expect(fieldsOf(withEntries([milestone({ colour: "red" })]))).toEqual([
      "props.entries[0].colour",
    ]);
    expect(fieldsOf(withEntries([without(milestone(), "lane")]))).toEqual([
      "props.entries[0].lane",
    ]);
    expect(fieldsOf(withEntries([without(milestone(), "label")]))).toEqual([
      "props.entries[0].label",
    ]);
    expect(fieldsOf(timeline({ lanes: LANES, entries: [milestone()], zoom: "week" }))).toEqual([
      "props.zoom",
    ]);
    expect(fieldsOf(timeline({ entries: [milestone()] }))).toEqual(["props.lanes"]);
    expect(askAccepted(TYPES, timeline("x"))).toBe(false);
  });

  test("the plain check never throws and gives a problem for what it cannot read", () => {
    expect(timelinePropsProblems(ITEM.props)).toEqual([]);
    for (const props of [
      null,
      3,
      "x",
      [],
      {},
      { lanes: null, entries: null },
      { lanes: [null, 3, {}], entries: [null, 3, {}, { id: "a", date: 3, start: [], end: {} }] },
    ]) {
      expect(() => timelinePropsProblems(props)).not.toThrow();
    }
    expect(timelinePropsProblems(null)).not.toEqual([]);
    expect(TIMELINE_WIDGET.propsProblems(ITEM.props, "agent")).toEqual([]);
    expect(TIMELINE_WIDGET.propsProblems(TIMELINE_EDITED_PROPS, "edited")).toEqual([]);
  });

  test("an edited value is checked as the agent's is: a moved entry that leaves the lanes fails", () => {
    const edited = { ...ITEM.props, entries: [milestone({ lane: "nowhere" })] };
    expect(TIMELINE_WIDGET.propsProblems(edited, "edited")).not.toEqual([]);
    const inverted = {
      ...ITEM.props,
      entries: [range({ start: "2026-02-01", end: "2026-01-01" })],
    };
    expect(TIMELINE_WIDGET.propsProblems(inverted, "edited")).not.toEqual([]);
  });
});

describe("Timeline changes", () => {
  const item = { type: "timeline", id: "roadmap" };
  const check = (changes: unknown) => widgetChangesProblems(item, changes, TYPES);

  test("the shape is the flat list of the entries, and the entry's shape is that one", () => {
    expect(TIMELINE_SHAPE).toEqual({ elements: "entries" });
    expect(Object.isFrozen(TIMELINE_SHAPE)).toBe(true);
    expect(elementShapeOf(ITEM, TYPES)).toEqual(TIMELINE_SHAPE);
    expect(TIMELINE_WIDGET.edits?.changes.$id).toBe(TIMELINE_SCHEMA_IDS.changes);
  });

  test("a range moved a week later and to another lane is sets of end, lane and start", () => {
    const changes = elementChanges("roadmap", ITEM.props, TIMELINE_EDITED_PROPS, TIMELINE_SHAPE);
    expect(changes).toEqual([
      { op: "set", target: "roadmap.checkout.end", value: "2026-03-06" },
      { op: "set", target: "roadmap.checkout.lane", value: "mobile" },
      { op: "set", target: "roadmap.checkout.start", value: "2026-01-12" },
    ]);
    expect(changes).toEqual(TIMELINE_CHANGES);
    expect(check(changes)).toEqual([]);
    expect(applyElementChanges("roadmap", ITEM.props, changes, TIMELINE_SHAPE)).toEqual(
      TIMELINE_EDITED_PROPS,
    );
  });

  test("a milestone moved in time is one set of date", () => {
    const edited = {
      ...ITEM.props,
      entries: [ITEM.props.entries[0], { ...ITEM.props.entries[1], date: "2026-03-03" }],
    };
    const changes = elementChanges("roadmap", ITEM.props, edited, TIMELINE_SHAPE);
    expect(changes).toEqual([{ op: "set", target: "roadmap.launch.date", value: "2026-03-03" }]);
    expect(check(changes)).toEqual([]);
  });

  test("an entry moved only across lanes is one set of lane, and a lane is an ID", () => {
    expect(check([{ op: "set", target: "roadmap.launch.lane", value: "web" }])).toEqual([]);
    expect(check([{ op: "set", target: "roadmap.launch.lane", value: "2026-01-05" }])).toEqual([]);
    expect(check([{ op: "set", target: "roadmap.launch.lane", value: "not a lane" }])).not.toEqual(
      [],
    );
    expect(check([{ op: "set", target: "roadmap.launch.date", value: "web" }])).not.toEqual([]);
    expect(check([{ op: "set", target: "roadmap.launch.start", value: "2026-1-1" }])).not.toEqual(
      [],
    );
  });

  test("a set of end to null, or of a label, fails, naming the item and the operation", () => {
    for (const change of [
      { op: "set", target: "roadmap.checkout.end", value: null },
      { op: "set", target: "roadmap.checkout.date", value: null },
      { op: "set", target: "roadmap.checkout.lane", value: null },
      { op: "set", target: "roadmap.checkout.label", value: "x" },
    ]) {
      const [problem] = check([change]);
      expect(problem?.message).toContain("item roadmap");
      expect(problem?.message).toContain("operation 0");
      expect(problem?.message).toContain("set");
    }
  });

  test("a move, an add, a remove, a long target and an extra key fail", () => {
    for (const change of [
      { op: "move", target: "roadmap.checkout", after: "launch" },
      { op: "add", target: "roadmap.new", value: { label: "x" } },
      { op: "remove", target: "roadmap.launch" },
      { op: "set", target: "roadmap.launch", value: "2026-01-05" },
      { op: "set", target: "roadmap.a.b.date", value: "2026-01-05" },
      { op: "set", target: "roadmap.launch.date", value: "2026-01-05", extra: true },
    ]) {
      expect(check([change])).not.toEqual([]);
    }
  });

  test("a reordered entry list is a move, which the check refuses", () => {
    const [first, second] = ITEM.props.entries;
    const changes = elementChanges(
      "roadmap",
      ITEM.props,
      { ...ITEM.props, entries: [second, first] },
      TIMELINE_SHAPE,
    );
    expect(changes.map(({ op }) => op)).toEqual(["move"]);
    expect(check(changes)[0]?.message).toContain("move");
  });
});

describe("the Timeline's fixtures", () => {
  test("take their version from the constants and hold the move as the diff gives it", () => {
    expect(timelineAct.version).toBe(BOARD_PROTOCOL_VERSION);
    const [act] = timelineAct.acts;
    expect(act).toMatchObject({ type: "answer", itemId: EDIT_WIDGETS_SESSION.question });
    expect((act as { values?: unknown }).values).toEqual({ roadmap: TIMELINE_EDITED_PROPS });
    expect(timelineAnswerEvent.changes).toEqual(TIMELINE_CHANGES);
  });

  test("the answer event, the act and the fetch of the item validate", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.answerEvent, timelineAnswerEvent)).toEqual([]);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, timelineFetchItemResult)).toEqual([]);
    expect(validateBoardMessage("toHost", timelineAct).ok).toBe(true);
  });
});

describe("the Timeline's entry in the registry's own check", () => {
  test("passes over the registry holding it, edits declared and no result or derived", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(TIMELINE_WIDGET.props.$id).toBe(TIMELINE_SCHEMA_IDS.props);
    expect(TIMELINE_WIDGET.result).toBeUndefined();
    expect(TIMELINE_WIDGET.derived).toBeUndefined();
    expect(TIMELINE_WIDGET.noun).toBe("a Timeline");
  });

  test("its teaching text is within bounds and its example is accepted in an ask", () => {
    const { skill, example } = TIMELINE_WIDGET;
    expect(skill?.use.length).toBeGreaterThanOrEqual(1);
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    expect(skill?.use).toContain("milestones");
    for (const note of skill?.notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
    expect(skill?.notes?.join(" ")).toContain("lane");
    expect(skill?.notes?.join(" ")).toContain("start");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
  });
});

describe("the registry's other modules", () => {
  test("no module of src/widgets outside timeline/ and registry.ts names the type", () => {
    const root = new URL("../src/widgets/", import.meta.url);
    const named: string[] = [];
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.parentPath.includes("/timeline")) continue;
      if (entry.name === "registry.ts") continue;
      const text = readFileSync(`${entry.parentPath}/${entry.name}`, "utf8");
      // The change's own name is how comments cite it; the type's name is what must not appear.
      if (/timeline/i.test(text.replaceAll("latex-kanban-timeline", ""))) named.push(entry.name);
    }
    expect(named).toEqual([]);
  });
});
