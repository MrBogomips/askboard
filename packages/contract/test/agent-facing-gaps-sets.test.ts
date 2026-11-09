// The `fetch` outcome `deleted` and the tool envelopes' minor (agent-facing-gaps, task 1.1;
// contract spec: The fetch outcome deleted; design decisions 2 and 5). The one number below is the
// minor this change binds, beside the constant (askboard-contract-versioning, Rule 1); the next
// change that widens the tool envelopes moves it.

import { describe, expect, test } from "bun:test";
import { OUTPUT_FORMAT_VERSION, SCHEMA_SETS, TOOL_ENVELOPES_VERSION } from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";

const ajv = ajvOver([]);
const check = (value: unknown) => errorsOf(ajv, SCHEMA_IDS.fetchOutcome, value);

const base = {
  versions: { result: TOOL_ENVELOPES_VERSION, output: OUTPUT_FORMAT_VERSION },
  epoch: "ep1234",
  askId: "ask-1",
};

describe("the fetch outcome deleted", () => {
  test("deleted names the item", () => {
    expect(check({ ...base, outcome: "deleted", itemId: "budget" })).toEqual([]);
  });

  test("deleted of an ask without an owner carries unchecked", () => {
    expect(check({ ...base, outcome: "deleted", itemId: "budget", unchecked: true })).toEqual([]);
  });

  test("deleted without itemId fails on itemId", () => {
    const errors = check({ ...base, outcome: "deleted" });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain("itemId");
  });

  test("discarded of the previous minor still passes", () => {
    expect(check({ ...base, outcome: "discarded" })).toEqual([]);
  });

  test("discarded with itemId or unchecked fails", () => {
    expect(check({ ...base, outcome: "discarded", itemId: "budget" }).length).toBeGreaterThan(0);
    expect(check({ ...base, outcome: "discarded", unchecked: true }).length).toBeGreaterThan(0);
  });

  test("an outcome other than the two, or an unchecked that is not true, fails", () => {
    expect(check({ ...base, outcome: "missing", itemId: "budget" }).length).toBeGreaterThan(0);
    expect(
      check({ ...base, outcome: "deleted", itemId: "budget", unchecked: false }).length,
    ).toBeGreaterThan(0);
  });

  test("an itemId that is not an item ID fails", () => {
    expect(check({ ...base, outcome: "deleted", itemId: "" }).length).toBeGreaterThan(0);
  });
});

describe("the tool envelopes' minor", () => {
  test("is the minor agent-facing-gaps binds, and the set carries the constant", () => {
    expect(TOOL_ENVELOPES_VERSION).toBe("1.13");
    expect(SCHEMA_SETS.find(({ name }) => name === "tool-envelopes")?.version).toBe(
      TOOL_ENVELOPES_VERSION,
    );
  });
});
