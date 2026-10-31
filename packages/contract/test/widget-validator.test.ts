import { describe, expect, test } from "bun:test";
import { validateAgainst, widgetValidator } from "../src/validate.ts";

// The standalone widget validator (design decision 2) on test-only `probe` schemas, never a
// widget's own: the props schema references E1's ID schema, and the list schema references it.
const SCHEMA = "https://json-schema.org/draft/2020-12/schema";
const PROPS_ID = "urn:askboard:test:probe-props";
const LIST_ID = "urn:askboard:test:probe-list";

const PROPS = {
  $schema: SCHEMA,
  $id: PROPS_ID,
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name"],
        properties: { id: { $ref: "urn:askboard:input:id" }, name: { type: "string" } },
      },
    },
  },
};

const LIST = { $schema: SCHEMA, $id: LIST_ID, type: "array", items: { $ref: PROPS_ID } };

type Props = { parts: { id: string; name: string }[] };
const valid: Props = { parts: [{ id: "a", name: "A" }] };

describe("a widget validator", () => {
  test("does nothing when made, and E1's shared validator never learns its schemas", () => {
    const unused = widgetValidator<Props>([PROPS], "urn:askboard:test:never-there");
    expect(typeof unused).toBe("function");
    expect(() => validateAgainst(PROPS_ID, valid)).toThrow(
      `the contract has no schema ${PROPS_ID}`,
    );
    widgetValidator<Props>([PROPS], PROPS_ID)(valid);
    expect(() => validateAgainst(PROPS_ID, valid)).toThrow(
      `the contract has no schema ${PROPS_ID}`,
    );
  });

  test("passes a valid value, as E1's validators do", () => {
    expect(widgetValidator<Props>([PROPS], PROPS_ID)(valid)).toEqual({ ok: true, value: valid });
  });

  test("names an unknown or a missing field in E1's wording, at its path", () => {
    const validate = widgetValidator<Props>([PROPS], PROPS_ID);
    expect(validate({ parts: [{ id: "a", name: "A", owner: "me" }] })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/parts/0/owner", message: 'unknown field "owner"' }],
    });
    expect(validate({ parts: [{ id: "a" }] })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/parts/0/name", message: 'missing field "name"' }],
    });
  });

  test("refuses a bad ID through the reference to E1's ID schema", () => {
    const checked = widgetValidator<Props>([PROPS], PROPS_ID)({ parts: [{ id: "u 1", name: "" }] });
    expect(checked.ok).toBe(false);
    const problems = checked.ok ? [] : checked.problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe("/parts/0/id");
    expect(problems[0]?.message).toContain("pattern");
  });

  test("two validators sharing a schema both work, whichever runs first", () => {
    const list = widgetValidator<Props[]>([PROPS, LIST], LIST_ID);
    const props = widgetValidator<Props>([PROPS], PROPS_ID);
    expect(list([valid, valid]).ok).toBe(true);
    expect(list([valid, { parts: "none" }]).ok).toBe(false);
    expect(props(valid).ok).toBe(true);
    expect(widgetValidator<Props>([PROPS], PROPS_ID)(valid).ok).toBe(true);
  });

  test("an unknown $id throws on first use, not when the validator is made", () => {
    const validate = widgetValidator([PROPS], "urn:askboard:test:none");
    expect(() => validate(valid)).toThrow("the contract has no schema urn:askboard:test:none");
  });

  test("a schema without an $id throws on first use", () => {
    const { $id: _, ...anonymous } = PROPS;
    expect(() => widgetValidator([anonymous], PROPS_ID)(valid)).toThrow("$id");
  });

  test("compiles in strict mode: an unknown keyword fails", () => {
    const loose = {
      $schema: SCHEMA,
      $id: "urn:askboard:test:probe-loose",
      type: "string",
      wobble: 1,
    };
    const validate = widgetValidator([loose], loose.$id);
    expect(() => validate("text")).toThrow("strict mode");
  });
});
