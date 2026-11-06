import { describe, expect, test } from "bun:test";
import { ERROR_TEXT_MAX_CHARS, type FormulaWarning, SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst, validateAskRequest } from "@askboard/contract/validate";
import type { AskOutcome, UpdateOutcome } from "@askboard/core";
import { ASK_ID, connect, depsWith, EPOCH, fakeCore, jsonOf, LINK, textOf } from "./helpers.ts";

// MCP adapter spec: Widget asks refused with worded problems, Formula warnings in results
// (widget-answers task 3.1), against a fake core.

const formula: FormulaWarning = {
  code: "formula",
  itemId: "schedule",
  address: "schedule.portal.es",
  error: "cycle",
  message: "The formula at schedule.portal.es is in error (cycle).",
};

const run = async (name: "ask" | "update", core: ReturnType<typeof fakeCore>, args: unknown) => {
  const { deps } = depsWith(core);
  const { client, close } = await connect(deps);
  const result = await client.callTool({ name, arguments: args as never });
  await close();
  return result;
};

describe("formula warnings in results", () => {
  test("an ask result holds the no-hooks warning and then each formula warning, and validates", async () => {
    const outcome: AskOutcome = {
      kind: "created",
      ask: { askId: ASK_ID, state: "waiting", cursor: `${EPOCH}.0`, board: LINK },
      warnings: [formula],
    } as unknown as AskOutcome;
    const result = await run("ask", fakeCore({ ask: async () => outcome }), { askId: ASK_ID });
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result) as { warnings: { code: string }[] };
    expect(json.warnings.map(({ code }) => code)).toEqual(["no-hooks", "formula"]);
    expect(validateAgainst(SCHEMA_IDS.askResult, json).ok).toBe(true);
  });

  test("an update result carries the formula warning and validates", async () => {
    const outcome = {
      kind: "updated",
      askId: ASK_ID,
      state: "waiting",
      applied: [{ action: "change", itemId: "schedule", rev: 2 }],
      warnings: [formula],
    } as unknown as UpdateOutcome;
    const result = await run("update", fakeCore({ update: () => outcome }), {
      askId: ASK_ID,
      actions: [{ action: "close" }],
    });
    const json = jsonOf(result) as { warnings: { code: string }[] };
    expect(json.warnings.map(({ code }) => code)).toEqual(["formula"]);
    expect(validateAgainst(SCHEMA_IDS.updateResult, json).ok).toBe(true);
  });
});

describe("widget problems as isError text", () => {
  const badTree = {
    askId: ASK_ID,
    items: [
      {
        type: "question",
        id: "plan",
        props: {
          text: "Estimate?",
          items: [{ type: "tree", id: "wbs", props: { nodes: [{ id: "ux" }] } }],
        },
      },
    ],
  };

  test("an ask refused for a Tree's node names the item, the field and the expected shape", async () => {
    const checked = validateAskRequest(badTree);
    expect(checked.ok).toBe(false);
    const problems = checked.ok ? [] : checked.problems;
    const core = fakeCore({ ask: async () => ({ kind: "invalid", problems }) });
    const result = await run("ask", core, badTree);
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('item "wbs"');
    expect(text).toContain("label");
    expect(text.length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
    expect(text.indexOf(problems[0]?.message ?? "?")).toBeGreaterThan(-1);
  });

  test("many widget problems stay under the limit, the first first", async () => {
    const nodes = Array.from({ length: 400 }, (_, n) => ({ id: `n${n}` }));
    const request = structuredClone(badTree);
    const item = request.items[0]?.props.items[0];
    if (item !== undefined) item.props.nodes = nodes as never;
    const checked = validateAskRequest(request);
    const problems = checked.ok ? [] : checked.problems;
    expect(problems.length).toBeGreaterThan(100);
    const result = await run(
      "ask",
      fakeCore({ ask: async () => ({ kind: "invalid", problems }) }),
      request,
    );
    const text = textOf(result);
    expect(text.length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
    expect(text.split("\n")[1]).toContain(problems[0]?.message ?? "?");
    expect(text).toContain("more problems");
  });
});
