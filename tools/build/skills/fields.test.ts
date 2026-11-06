// The field summaries of the generated skill (askboard-skills, design decision 4): one line per
// field of a props or parameter schema, `$ref`s resolved, citations dropped from the descriptions.

import { describe, expect, test } from "bun:test";
import { SCHEMA_IDS, WIDGET_TYPES } from "@askboard/contract";
import { contractSchemaResolver, fieldLines, stripCitations } from "./fields.ts";

const resolve = contractSchemaResolver();
const tree = WIDGET_TYPES.find(({ type }) => type === "tree");
const gantt = WIDGET_TYPES.find(({ type }) => type === "gantt");
if (tree === undefined || gantt === undefined) throw new Error("the registry lost a type");

const lineOf = (lines: readonly string[], path: string): string => {
  const line = lines.find((entry) => entry.startsWith(`- \`${path}\` `));
  if (line === undefined) throw new Error(`no line for ${path} in:\n${lines.join("\n")}`);
  return line;
};

describe("fieldLines of the Tree's props", () => {
  const lines = fieldLines(tree.props, resolve);

  test("gives one line for each field, the node's expanded once", () => {
    for (const path of [
      "columns",
      "columns[].field",
      "columns[].label",
      "columns[].type",
      "nodes",
      "nodes[].id",
      "nodes[].label",
      "nodes[].children",
      "pert",
      "openDepth",
    ]) {
      expect(lineOf(lines, path)).toBeString();
    }
    expect(new Set(lines).size).toBe(lines.length);
  });

  test("shows `nodes[].children` as the node above, and goes no deeper", () => {
    expect(lineOf(lines, "nodes[].children")).toContain("as `node` above");
    expect(lines.some((line) => line.startsWith("- `nodes[].children[]"))).toBe(false);
  });

  test("names what is required, the enum, the constant and the bounds", () => {
    expect(lineOf(lines, "nodes")).toContain("required");
    expect(lineOf(lines, "columns")).not.toContain("required");
    expect(lineOf(lines, "columns[].type")).toContain('one of "text", "number"');
    expect(lineOf(lines, "pert")).toContain("always true");
    expect(lineOf(lines, "openDepth")).toContain("1 to 8");
    expect(lineOf(lines, "columns")).toContain("at most 8");
    expect(lineOf(lines, "columns[].label")).toContain("1 to 200 characters");
  });

  test("resolves a `$ref` by `$id` through the contract's schemas", () => {
    expect(lineOf(lines, "nodes[].id")).toContain("[A-Za-z0-9_-]{1,64}");
  });

  test("shows the keys a pattern admits", () => {
    expect(lines.some((line) => line.startsWith("- `nodes[].<field>`"))).toBe(true);
  });

  test("holds no citation", () => {
    expect(lines.join("\n")).not.toMatch(/\((FR|NFR|AD|SM)-\d/);
    expect(lines.join("\n")).not.toContain("design decision");
  });
});

describe("fieldLines of the Gantt's props", () => {
  const lines = fieldLines(gantt.props, resolve);

  test("lists the branches of a combinator and the fields of each", () => {
    expect(lineOf(lines, "tasks")).toContain("one of:");
    expect(lineOf(lines, "tasks")).toContain("ownTasks");
    expect(lineOf(lines, "tasks")).toContain("planTasks");
    expect(lineOf(lines, "tasks[].duration")).toContain("1 to 2000");
    expect(lineOf(lines, "tasks.<key>.duration")).toContain("1 to 2000");
  });

  test("states the start's format and that it is required", () => {
    expect(lineOf(lines, "start")).toContain("required");
    expect(lineOf(lines, "start")).toContain("^[0-9]{4}-");
  });
});

describe("fieldLines", () => {
  test("stops at four levels and says to see the example", () => {
    const level = (inner: object) => ({
      type: "object",
      properties: { next: inner },
    });
    const deep = level(level(level(level(level({ type: "string" })))));
    const lines = fieldLines(deep, () => undefined);
    expect(lines.map((line) => line.slice(0, line.indexOf("`", 3) + 1))).toEqual([
      "- `next`",
      "- `next.next`",
      "- `next.next.next`",
      "- `next.next.next.next`",
      "- `next.next.next.next.…`",
    ]);
    expect(lines.at(-1)).toContain("see the example");
  });

  test("resolves a reference by its `$id` with the resolver it is given", () => {
    const lines = fieldLines({ type: "object", properties: { a: { $ref: "urn:x:a" } } }, (id) =>
      id === "urn:x:a" ? { type: "string", description: "An A." } : undefined,
    );
    expect(lines).toEqual(["- `a` (string): An A."]);
  });

  test("resolves a fragment inside another document", () => {
    const other = { $id: "urn:x:b", $defs: { n: { type: "integer", minimum: 0 } } };
    const lines = fieldLines(
      { type: "object", properties: { n: { $ref: "urn:x:b#/$defs/n" } } },
      (id) => (id === "urn:x:b" ? other : undefined),
    );
    expect(lines[0]).toContain("at least 0");
  });

  test("throws, naming a reference it cannot resolve", () => {
    expect(() =>
      fieldLines({ type: "object", properties: { a: { $ref: "urn:x:missing" } } }, () => undefined),
    ).toThrow("urn:x:missing");
    expect(() =>
      fieldLines(
        { type: "object", properties: { a: { $ref: "#/$defs/none" } }, $defs: {} },
        () => undefined,
      ),
    ).toThrow("#/$defs/none");
  });

  test("describes a boolean, a number and a list of text", () => {
    const lines = fieldLines(
      {
        type: "object",
        properties: {
          on: { type: "boolean" },
          n: { type: "number", maximum: 9 },
          names: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string" } },
        },
        required: ["on"],
      },
      () => undefined,
    );
    expect(lines[0]).toBe("- `on` (required, true or false)");
    expect(lines[1]).toContain("at most 9");
    expect(lines[2]).toContain("list of string");
    expect(lines[2]).toContain("at least 1 item");
    expect(lines[2]).toContain("each once");
  });

  test("a description given for a path replaces the schema's, citations dropped", () => {
    const schema = {
      type: "object",
      properties: {
        a: { type: "string", description: "Long." },
        b: { type: "string", minLength: 1 },
      },
    };
    const lines = fieldLines(schema, () => undefined, { a: "Short (FR-1)." });
    expect(lines[0]).toBe("- `a` (string): Short.");
    expect(lines[1]).toBe("- `b` (string, at least 1 character)");
  });

  test("the contract's resolver knows every id the shipped widget props name", () => {
    expect(resolve(SCHEMA_IDS.treeProps)).toBeObject();
    expect(resolve("urn:askboard:input:id")).toBeObject();
    expect(resolve("urn:askboard:input:nothing")).toBeUndefined();
  });
});

describe("stripCitations", () => {
  test("drops a parenthesis that cites a requirement, a decision or a design decision", () => {
    expect(stripCitations("A node (FR-11, design decision 2): its name.")).toBe(
      "A node: its name.",
    );
    expect(stripCitations("A date (AD-7, Values).")).toBe("A date.");
    expect(stripCitations("The plan (FR-15) starts.")).toBe("The plan starts.");
    expect(stripCitations("A limit (NFR-1) and (SM-2) and (R5).")).toBe("A limit and and.");
    expect(stripCitations("A wins (since input format 1.5) here.")).toBe("A wins here.");
  });

  test("keeps a parenthesis that says something else", () => {
    expect(stripCitations("Days (working days) and (`path#Heading`) and (a, b).")).toBe(
      "Days (working days) and (`path#Heading`) and (a, b).",
    );
    expect(stripCitations("Rows (Rows) and (RFC 3339) are kept.")).toBe(
      "Rows (Rows) and (RFC 3339) are kept.",
    );
  });
});
