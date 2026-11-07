// The Gantt's request wording read against its props schema, so that a field added to the schema
// cannot go unworded again: a plan's task map entry gained `duration` in widget-editing-plus and
// its wording kept saying `{start?, dependencies?}`. Each braced field list and each "holds only"
// list names exactly the schema's properties, each optional one marked `?`, and every property has
// its own key in the expected shapes.

import { describe, expect, test } from "bun:test";
import ganttProps from "../src/widgets/gantt/gantt-props.json" with { type: "json" };
import { GANTT_EXPECTED, GANTT_FIELDS } from "../src/widgets/gantt/wording.ts";

interface ObjectSchema {
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
}

const defs = ganttProps.$defs as unknown as Readonly<Record<string, ObjectSchema>>;

/** The schemas behind the three keys whose wording lists fields. */
const OBJECTS: ReadonlyArray<readonly [key: string, schema: ObjectSchema]> = [
  ["gantt.props", ganttProps as unknown as ObjectSchema],
  ["gantt.props.tasks[]", defs.ownTask as ObjectSchema],
  ["gantt.props.tasks.{task}", defs.planEntry as ObjectSchema],
];

/** The schema's fields as the wording writes them, optional ones with `?`, sorted. */
const bracedFields = (schema: ObjectSchema): readonly string[] =>
  Object.keys(schema.properties)
    .map((name) => (schema.required?.includes(name) ? name : `${name}?`))
    .sort();

/** Every `{…}` field list in a wording, each sorted. */
const bracesIn = (wording: string): readonly (readonly string[])[] =>
  [...wording.matchAll(/\{([^{}]*)\}/g)].map((match) =>
    (match[1] ?? "")
      .split(",")
      .map((field) => field.trim())
      .sort(),
  );

/** The fields of a "holds only a, b and c" wording, sorted. */
const heldFields = (wording: string): readonly string[] =>
  (wording.split(" only ")[1] ?? "")
    .split(/, | and /)
    .map((field) => field.trim())
    .sort();

describe("the Gantt's wording names its schema's fields", () => {
  test.each(OBJECTS)("%s: the expected shape lists every field", (key, schema) => {
    const braces = bracesIn(GANTT_EXPECTED[key] ?? "");
    expect(braces.length).toBeGreaterThan(0);
    expect(braces.at(-1)).toEqual(bracedFields(schema));
  });

  test.each(OBJECTS)("%s: the fields wording lists every field", (key, schema) => {
    expect(heldFields(GANTT_FIELDS[key] ?? "")).toEqual(Object.keys(schema.properties).sort());
  });

  test.each(OBJECTS)("%s: every field has its own expected shape", (key, schema) => {
    for (const name of Object.keys(schema.properties)) {
      expect(GANTT_EXPECTED[`${key}.${name}`]).toBeString();
    }
  });

  test("tasks: both forms list their fields", () => {
    const braces = bracesIn(GANTT_EXPECTED["gantt.props.tasks"] ?? "");
    expect(braces).toEqual([
      bracedFields(defs.ownTask as ObjectSchema),
      bracedFields(defs.planEntry as ObjectSchema),
    ]);
  });
});
