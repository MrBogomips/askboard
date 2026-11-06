// The Gantt's schemas alone (gantt-widget, task 2.1): compiled in plain strict mode with
// `createAjv`'s options beside E1's ID schema, which needs none of the widget seams. The validators
// on the shared widget validator come with task 2.2.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { ErrorObject } from "ajv/dist/2020";
import { SCHEMA_IDS, SCHEMA_SETS } from "../src/index.ts";
import { createAjv, validateAgainst } from "../src/validate.ts";
import {
  GANTT_ANSWER_DERIVED,
  GANTT_FIRST_DATE,
  GANTT_LABEL_MAX_CHARS,
  GANTT_LAST_DATE,
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_MIN_DURATION,
  GANTT_PLAN_ESTIMATES,
  GANTT_SCHEMA_IDS,
  ganttChangesSchema,
  ganttPropsSchema,
} from "../src/widgets/gantt/index.ts";

// The approved UJ-2 examples, read where the model-contract review archived them: E1's copies under
// `test/fixtures/` come with its integration.
const EXAMPLES = join(
  import.meta.dir,
  "../../../openspec/changes/archive/2026-10-29-review-model-contract/examples",
);
const ask = await Bun.file(join(EXAMPLES, "asks/uj2-wbs-gantt.json")).json();
const answer = await Bun.file(join(EXAMPLES, "answers/uj2-wbs-gantt.json")).json();

const ajv = createAjv();
// The contract's sets hold both schemas since widget-answers (task 1.1).
const props = ajv.getSchema(GANTT_SCHEMA_IDS.props);
const changes = ajv.getSchema(GANTT_SCHEMA_IDS.changes);
if (props === undefined || changes === undefined)
  throw new Error("the Gantt's schemas are missing");

const errorsOf = (validate: typeof props, value: unknown): readonly ErrorObject[] =>
  validate(value) ? [] : (validate.errors ?? []);

/** Whether an error names the field: at its path, or as the unknown or missing property. */
const names = (errors: readonly ErrorObject[], field: string): boolean =>
  errors.some(
    ({ instancePath, params }) =>
      instancePath.split("/").at(-1) === field ||
      (params as { additionalProperty?: string }).additionalProperty === field ||
      (params as { missingProperty?: string }).missingProperty === field,
  );

const OWN = {
  start: "2026-11-02",
  tasks: [
    { id: "ux", label: "UX design", duration: 6 },
    { id: "architecture", label: "Architecture", duration: 4 },
    { id: "prototype", label: "Clickable prototype", duration: 5, dependencies: ["ux"] },
    {
      id: "portal",
      label: "Customer portal",
      duration: 13,
      dependencies: ["architecture", "prototype"],
      start: "2026-11-23",
    },
  ],
};

// The approved `schedule` data, expanded: its dependencies map becomes the plan's entries.
const schedule = ask.items[0].props.items[1].props.data as {
  workPackages: string;
  start: string;
  dependencies: Record<string, string[]>;
};
const PLAN = {
  start: schedule.start,
  workPackages: schedule.workPackages,
  tasks: Object.fromEntries(
    Object.entries(schedule.dependencies).map(([task, dependencies]) => [task, { dependencies }]),
  ),
};

const withTask = (task: Record<string, unknown>) => ({ ...OWN, tasks: [task] });

describe("the Gantt's schemas", () => {
  test("are JSON Schema 2020-12 with their $ids, and no root combinator", () => {
    for (const [schema, id, namespace] of [
      [ganttPropsSchema, GANTT_SCHEMA_IDS.props, "urn:askboard:input:"],
      [ganttChangesSchema, GANTT_SCHEMA_IDS.changes, "urn:askboard:output:"],
    ] as const) {
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(schema.$id).toBe(id);
      expect(id.startsWith(namespace)).toBe(true);
      for (const keyword of ["oneOf", "anyOf", "allOf"]) expect(keyword in schema).toBe(false);
    }
    expect(GANTT_SCHEMA_IDS).toEqual({
      props: "urn:askboard:input:gantt-props",
      changes: "urn:askboard:output:gantt-changes",
    });
  });

  test("belong to the schema sets since widget-answers, so the shared validator holds them", () => {
    const ids = SCHEMA_SETS.flatMap((set) =>
      set.schemas.map((schema) => (schema as { $id?: string }).$id),
    );
    expect(ids).toContain(GANTT_SCHEMA_IDS.props);
    expect(ids).toContain(GANTT_SCHEMA_IDS.changes);
    expect(Object.values(SCHEMA_IDS)).toContain(GANTT_SCHEMA_IDS.props);
    expect(() => validateAgainst(GANTT_SCHEMA_IDS.props, OWN)).not.toThrow();
  });

  test("hold the contract's limits", () => {
    expect([
      GANTT_MAX_TASKS,
      GANTT_MAX_PREDECESSORS,
      GANTT_MAX_DEPENDENTS,
      GANTT_MIN_DURATION,
      GANTT_MAX_DURATION,
      GANTT_LABEL_MAX_CHARS,
    ]).toEqual([500, 50, 50, 1, 2_000, 200]);
    expect([GANTT_FIRST_DATE, GANTT_LAST_DATE]).toEqual(["1900-03-02", "9999-12-31"]);
    expect(GANTT_PLAN_ESTIMATES).toEqual(["optimistic", "mostLikely", "pessimistic"]);
    expect(GANTT_ANSWER_DERIVED).toEqual({ finish: "finishDate", criticalPath: "critical" });
  });

  test("write each limit as its constant says, in both schemas", () => {
    const { $defs } = ganttPropsSchema;
    const [duration] = ganttChangesSchema.$defs.set.properties.value.anyOf;
    expect({
      tasks: $defs.ownTasks.maxItems,
      entries: $defs.planTasks.maxProperties,
      predecessors: $defs.predecessors.maxItems,
      label: $defs.ownTask.properties.label.maxLength,
      duration: [
        $defs.ownTask.properties.duration.minimum,
        $defs.ownTask.properties.duration.maximum,
      ],
      changedDuration: [duration?.minimum, duration?.maximum],
    }).toEqual({
      tasks: GANTT_MAX_TASKS,
      entries: GANTT_MAX_TASKS,
      predecessors: GANTT_MAX_PREDECESSORS,
      label: GANTT_LABEL_MAX_CHARS,
      duration: [GANTT_MIN_DURATION, GANTT_MAX_DURATION],
      changedDuration: [GANTT_MIN_DURATION, GANTT_MAX_DURATION],
    });
  });
});

describe("the Gantt's props", () => {
  test("pass for a Gantt with its own tasks", () => {
    expect(errorsOf(props, OWN)).toEqual([]);
  });

  test("pass for the UJ-2 plan, its tasks a map from task ID to an entry", () => {
    expect(Object.keys(PLAN.tasks)).toEqual(["prototype", "portal", "billing", "reporting"]);
    expect(errorsOf(props, PLAN)).toEqual([]);
    expect(
      errorsOf(props, { ...PLAN, tasks: { ...PLAN.tasks, ux: { start: "2026-11-04" } } }),
    ).toEqual([]);
  });

  test.each([
    ["an unknown key", { ...OWN, calendar: "mon-fri" }, "calendar"],
    ["an entry holding a label", { ...PLAN, tasks: { portal: { label: "Portal" } } }, "label"],
    ["a fractional duration", withTask({ id: "a", label: "A", duration: 2.5 }), "duration"],
    ["a duration of 0", withTask({ id: "a", label: "A", duration: 0 }), "duration"],
    ["a duration past the limit", withTask({ id: "a", label: "A", duration: 2_001 }), "duration"],
    [
      "a predecessor listed twice",
      withTask({ id: "a", label: "A", duration: 1, dependencies: ["b", "b"] }),
      "dependencies",
    ],
    ["a 201-character label", withTask({ id: "a", label: "x".repeat(201), duration: 1 }), "label"],
    ["an empty label", withTask({ id: "a", label: "", duration: 1 }), "label"],
    ["a task without its duration", withTask({ id: "a", label: "A" }), "duration"],
    ["a task ID that is no ID", withTask({ id: "a b", label: "A", duration: 1 }), "id"],
    ["a malformed start", { ...OWN, start: "2026-11-2" }, "start"],
    [
      "a malformed requested start",
      withTask({ id: "a", label: "A", duration: 1, start: "11/2/2026" }),
      "start",
    ],
    ["no tasks", { start: "2026-11-02" }, "tasks"],
    ["no start", { tasks: [] }, "start"],
  ])("fail for %s, naming the field", (_, value, field) => {
    const errors = errorsOf(props, value);
    expect(errors.length).toBeGreaterThan(0);
    expect({ field, named: names(errors, field) }).toEqual({ field, named: true });
  });

  test("fail past the task and predecessor limits", () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ id: `t${i}`, label: "T", duration: 1 }));
    expect(errorsOf(props, { ...OWN, tasks: many }).length).toBeGreaterThan(0);
    expect(errorsOf(props, { ...OWN, tasks: many.slice(0, 500) })).toEqual([]);
    const entries = Object.fromEntries(many.map(({ id }) => [id, {}]));
    expect(errorsOf(props, { ...PLAN, tasks: entries }).length).toBeGreaterThan(0);
    const predecessors = Array.from({ length: 51 }, (_, i) => `p${i}`);
    expect(
      errorsOf(props, withTask({ id: "a", label: "A", duration: 1, dependencies: predecessors }))
        .length,
    ).toBeGreaterThan(0);
  });
});

describe("the Gantt's changes", () => {
  test("pass for the approved answer's schedule operation", () => {
    const events = answer.asks[0]?.events ?? [];
    const operations = (events[0]?.changes ?? []).filter((change: { target: string }) =>
      change.target.startsWith("schedule."),
    );
    expect(operations).toEqual([
      { op: "set", target: "schedule.u-1.dependencies", value: ["architecture", "prototype"] },
    ]);
    expect(errorsOf(changes, operations)).toEqual([]);
  });

  test("pass for a set of each field, null included where it clears", () => {
    expect(
      errorsOf(changes, [
        { op: "set", target: "release.portal.duration", value: 15 },
        { op: "set", target: "release.portal.start", value: "2026-11-23" },
        { op: "set", target: "release.portal.start", value: null },
        { op: "set", target: "release.portal.dependencies", value: ["ux"] },
        { op: "set", target: "release.portal.dependencies", value: null },
        { op: "set", target: "release.portal.dependencies", value: [] },
      ]),
    ).toEqual([]);
  });

  test.each([
    ["an add", { op: "add", target: "schedule.u-1", parent: null, value: {} }],
    ["a move", { op: "move", target: "release.ux", parent: null, after: null }],
    ["a remove", { op: "remove", target: "release.ux" }],
    ["a set of the label", { op: "set", target: "release.ux.label", value: "UX" }],
    ["a set of a whole task", { op: "set", target: "release.ux", value: {} }],
    ["a value of another kind", { op: "set", target: "release.ux.start", value: { at: 1 } }],
    ["a set without its value", { op: "set", target: "release.ux.start" }],
  ])("fail for %s", (_, operation) => {
    expect(errorsOf(changes, [operation]).length).toBeGreaterThan(0);
  });
});
