import { describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  OUTPUT_FORMAT_VERSION,
  RESULT_VERSIONS,
  SCHEMA_IDS,
  TOOL_ENVELOPES_VERSION,
  UNRESOLVED_REASONS,
} from "../src/index.ts";
import warningSchema from "../src/schemas/output/warning.json" with { type: "json" };
import { validateAgainst } from "../src/validate.ts";

// The output format's `unresolved-pointer` warning, `update`'s warnings and the draft record's
// context placement (excerpts, task 1.4; contract spec: The unresolved-pointer warning, Context
// placement in the draft record).
const warning = (value: unknown) => validateAgainst(SCHEMA_IDS.warning, value);
const unresolved = (extra: Record<string, unknown> = {}) => ({
  code: "unresolved-pointer",
  itemId: "retry-adr",
  pointer: "docs/adr/0012-payment-retries.md#Decision",
  reason: "anchor-not-found",
  message: 'retry-adr: the file has no heading "Decision"',
  ...extra,
});
const NO_HOOKS = { code: "no-hooks", message: "This session runs without hooks." };

describe("the versions (design decision 2)", () => {
  test("the output format, the tool envelopes and the board protocol take the minor after 1.1", () => {
    expect({
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      protocol: BOARD_PROTOCOL_VERSION,
      // E7 (snapshot) took the envelopes and the protocol to 1.3 after E5's 1.2.
    }).toEqual({ output: "1.2", envelopes: "1.3", protocol: "1.3" });
    expect(RESULT_VERSIONS).toEqual({ result: "1.3", output: "1.2" });
  });
});

describe("the unresolved-pointer warning", () => {
  test("a heading that does not exist: the warning validates with its item, pointer and reason", () => {
    expect(warning(unresolved())).toMatchObject({ ok: true });
  });

  test("its reasons are the contract's list", () => {
    expect(warningSchema.properties.reason.enum).toEqual([...UNRESOLVED_REASONS]);
  });

  test.each(UNRESOLVED_REASONS)("the reason %s validates", (reason) => {
    expect(warning(unresolved({ reason }))).toMatchObject({ ok: true });
  });

  test.each(["itemId", "pointer", "reason", "message"])("one without %s is refused", (field) => {
    const value: Record<string, unknown> = unresolved();
    delete value[field];
    expect(warning(value)).toMatchObject({ ok: false, problems: [{ path: `/${field}` }] });
  });

  test.each([
    ["an unknown reason", { reason: "gone" }, "/reason"],
    ["an item ID of another shape", { itemId: "retry adr" }, "/itemId"],
    ["an empty pointer", { pointer: "" }, "/pointer"],
    ["an unknown field", { path: "/etc/passwd" }, "/path"],
  ])("one with %s is refused", (_, extra, path) => {
    expect(warning(unresolved(extra))).toMatchObject({ ok: false, problems: [{ path }] });
  });

  test("a no-hooks warning validates as before, and takes no item, pointer or reason", () => {
    expect(warning(NO_HOOKS)).toMatchObject({ ok: true });
    for (const field of ["itemId", "pointer", "reason"]) {
      const value = { ...NO_HOOKS, [field]: unresolved()[field as "itemId"] };
      expect(warning(value)).toMatchObject({ ok: false, problems: [{ path: `/${field}` }] });
    }
  });

  test("an unknown code is refused", () => {
    expect(warning({ code: "formula", message: "x" })).toMatchObject({ ok: false });
  });
});

describe("update's warnings", () => {
  const result = (extra: Record<string, unknown> = {}) => ({
    versions: RESULT_VERSIONS,
    epoch: "k3m9q2x7",
    askId: "payment-retry-fix-q4m8",
    state: "waiting",
    applied: [{ action: "change", itemId: "fix", rev: 2 }],
    ...extra,
  });
  const updateResult = (value: unknown) => validateAgainst(SCHEMA_IDS.updateResult, value);

  test("an update result without warnings validates as before", () => {
    expect(updateResult(result())).toMatchObject({ ok: true });
  });

  test("an update result with an unresolved-pointer warning beside no-hooks validates", () => {
    expect(updateResult(result({ warnings: [NO_HOOKS, unresolved()] }))).toMatchObject({
      ok: true,
    });
  });

  test("an empty list of warnings is refused, as in the ask result", () => {
    expect(updateResult(result({ warnings: [] }))).toMatchObject({
      ok: false,
      problems: [{ path: "/warnings" }],
    });
  });

  test("an ask result with an unresolved-pointer warning validates", () => {
    const value = {
      versions: RESULT_VERSIONS,
      epoch: "k3m9q2x7",
      askId: "payment-retry-fix-q4m8",
      cursor: "k3m9q2x7.0",
      boardUrl: "http://127.0.0.1:47200/b/payment-retry-fix-q4m8#t=abc",
      warnings: [unresolved()],
    };
    const checked = validateAgainst(SCHEMA_IDS.askResult, value);
    expect(
      checked.ok ? [] : checked.problems.filter(({ path }) => path.startsWith("/warnings")),
    ).toEqual([]);
  });
});

describe("context placement in the draft record", () => {
  const record = (question: Record<string, unknown>) => ({
    delivery: "immediate",
    questions: { fix: { rev: 1, ...question } },
  });
  const draft = (value: unknown) => validateAgainst(SCHEMA_IDS.draftRecord, value);

  test.each(["beside", "inline"])("a question holding context %s validates", (context) => {
    expect(draft(record({ context }))).toMatchObject({ ok: true });
  });

  test("a draft record question without context validates as before", () => {
    expect(draft(record({ note: "x" }))).toMatchObject({ ok: true });
  });

  test.each(["left", "", true])("a context of %p is refused", (context) => {
    expect(draft(record({ context }))).toMatchObject({
      ok: false,
      problems: [{ path: "/questions/fix/context" }],
    });
  });
});
