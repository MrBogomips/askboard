import { describe, expect, test } from "bun:test";
import { ERROR_TEXT_MAX_CHARS, RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import { lifecycleUpdate, lifecycleUpdateResult } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import type { UpdateOutcome } from "@askboard/core";
import { ASK_ID, connect, depsWith, EPOCH, fakeCore, jsonOf, textOf } from "./helpers.ts";
import { worstCore, worstPlanItems, worstPointerItems } from "./worst-ask.ts";

// MCP adapter spec: Updating an ask, Refused updates, Closed and discarded asks in update and fetch
// (ask-lifecycle, task 4.2), against a fake core.

const A = "checkout-plan-p8r3";

const call = async (outcome: UpdateOutcome | (() => UpdateOutcome), args: unknown) => {
  const requests: unknown[] = [];
  const core = fakeCore({
    update: (request) => {
      requests.push(request);
      return typeof outcome === "function" ? outcome() : outcome;
    },
  });
  const { deps, written } = depsWith(core);
  const { client, close } = await connect(deps);
  const result = await client.callTool({ name: "update", arguments: args as never });
  await close();
  return { result, requests, core, written };
};

const rewording = {
  askId: A,
  actions: [
    { action: "add", item: { type: "question", id: "q4", props: { text: "When?" } } },
    { action: "change", itemId: "q2", props: { text: "Which database, for the EU?" } },
  ],
};

describe("updating an ask", () => {
  test("adding and rewording: each item with its new rev, the ask's state, unchecked, no cursor", async () => {
    const applied = [
      { action: "add", itemId: "q4", rev: 1 },
      { action: "change", itemId: "q2", rev: 2 },
    ] as const;
    const { result, requests } = await call(
      { kind: "updated", askId: A, state: "partly-answered", applied },
      rewording,
    );
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: EPOCH,
      askId: A,
      state: "partly-answered",
      applied,
      unchecked: true,
    });
    expect(validateAgainst(SCHEMA_IDS.updateResult, json).ok).toBe(true);
    expect(textOf(result)).not.toContain("cursor");
    expect(requests).toEqual([rewording]);
  });

  test("a recorded answer is reported with who and when, and every action in order", async () => {
    const { result } = await call(
      {
        kind: "updated",
        askId: A,
        state: "closed",
        applied: lifecycleUpdateResult.applied,
      },
      lifecycleUpdate,
    );
    const json = jsonOf(result);
    expect(json).toEqual({ ...lifecycleUpdateResult, epoch: EPOCH });
    expect(validateAgainst(SCHEMA_IDS.updateResult, json).ok).toBe(true);
  });

  test("touches nothing but update: no read, no markRead", async () => {
    const { core } = await call({ kind: "updated", askId: A, state: "waiting", applied: [] }, {});
    expect(core.calls).toEqual(["update"]);
  });
});

describe("refused updates", () => {
  test("changing an answered question names the action, the question and its answer's cursor", async () => {
    const cursor = `${EPOCH}.2`;
    const { result } = await call(
      {
        kind: "refused",
        askId: A,
        index: 1,
        itemId: "q2",
        cursor,
        refusal: "answered",
        detail: `the question "q2" was answered at ${cursor}; reopen it first to change it`,
      },
      rewording,
    );
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain("actions[1]");
    expect(text).toContain('"q2"');
    expect(text).toContain(cursor);
    expect(text).toContain("reopen it first");
    expect(text).toContain("nothing was changed");
  });

  test("names the answer's cursor even when the reason does not", async () => {
    const { result } = await call(
      {
        kind: "refused",
        askId: A,
        index: 0,
        itemId: "q1",
        cursor: `${EPOCH}.7`,
        refusal: "answered",
        detail: "the question is answered",
      },
      rewording,
    );
    expect(textOf(result)).toContain(`${EPOCH}.7`);
  });

  test("a refusal without an item names the action only", async () => {
    const { result } = await call(
      {
        kind: "refused",
        askId: A,
        index: 2,
        refusal: "closed",
        detail: "an action after close in the same update",
      },
      rewording,
    );
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("actions[2]");
    expect(textOf(result)).not.toContain("item");
  });

  test("stays under 4,000 characters, however long the reason", async () => {
    const { result } = await call(
      {
        kind: "refused",
        askId: A,
        index: 0,
        itemId: "q1",
        refusal: "props",
        detail: "x".repeat(10_000),
      },
      rewording,
    );
    expect(textOf(result).length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
  });

  test("a request outside the input format lists its problems", async () => {
    const { result } = await call(
      {
        kind: "invalid",
        problems: [
          {
            path: "/actions/0/itemId",
            field: "actions[0].itemId",
            expected: "an item ID",
            message: "actions[0].itemId must be an item ID",
          },
        ],
      },
      { askId: A, actions: [{ action: "change", itemId: "" }] },
    );
    expect(result.isError).toBe(true);
    expect(textOf(result)).toStartWith("The update was not applied");
    expect(textOf(result)).toContain("actions[0].itemId must be an item ID");
  });
});

describe("closed and discarded asks", () => {
  test.each(["closed", "discarded"] as const)(
    "%s is a typed result, not an error",
    async (kind) => {
      const { result } = await call(
        { kind, askId: A },
        { askId: A, actions: [{ action: "close" }] },
      );
      expect(result.isError).toBeFalsy();
      const json = jsonOf(result);
      expect(json).toEqual({ versions: RESULT_VERSIONS, epoch: EPOCH, askId: A, outcome: kind });
      expect(validateAgainst(SCHEMA_IDS.updateOutcome, json).ok).toBe(true);
    },
  );

  test("a failure inside is an error, and stderr names only its class", async () => {
    const { result, written } = await call(() => {
      throw new Error(`update of ${A} failed`);
    }, rewording);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("failed inside");
    expect(written).toEqual(["askboard: update failed: Error"]);
  });
});

// Excerpts, task 4.1 (mcp-adapter spec, "Unresolved pointers in ask and update results", "An update
// that adds a missing image").
describe("unresolved pointers", () => {
  const missingImage = {
    code: "unresolved-pointer",
    itemId: "shot",
    pointer: ".askboard/media/shot.png",
    reason: "not-found",
    message: "The file does not exist.",
  } as const;
  const addition = {
    askId: A,
    actions: [
      {
        action: "change",
        itemId: "q2",
        props: {
          text: "Which database?",
          options: [{ label: "A" }, { label: "B" }],
          items: [
            { type: "image", id: "shot", props: { pointer: missingImage.pointer, alt: "Shot" } },
          ],
        },
      },
    ],
  };

  test("an update that adds a missing image is applied, and its result names the image", async () => {
    const applied = [{ action: "change", itemId: "q2", rev: 2 }] as const;
    const { result } = await call(
      { kind: "updated", askId: A, state: "waiting", applied, warnings: [missingImage] },
      addition,
    );
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: EPOCH,
      askId: A,
      state: "waiting",
      applied,
      unchecked: true,
      warnings: [missingImage],
    });
    expect(validateAgainst(SCHEMA_IDS.updateResult, json).ok).toBe(true);
  });

  test("an update with no unresolved pointer has no warnings", async () => {
    const { result } = await call({ kind: "updated", askId: A, state: "waiting", applied: [] }, {});
    expect(jsonOf(result)).not.toHaveProperty("warnings");
  });
});

// The mcp-adapter spec's "The same on update" (result-bound, Refs #98): the worst ask's question is
// sent again by an update, through the real `ask-core`.
describe("the worst ask sent again by an update", () => {
  const question = (items: readonly unknown[]) => ({ text: "Does this fit?", items });

  test("is applied, and each kind of warning ends in its closing warning, at most 20,000 characters in all", async () => {
    const { deps } = depsWith(worstCore());
    const { client, close } = await connect(deps);
    const asked = await client.callTool({
      name: "ask",
      arguments: {
        askId: ASK_ID,
        items: [
          {
            type: "question",
            id: "plan",
            props: { text: "Does this fit?", options: [{ label: "Yes" }, { label: "No" }] },
          },
        ],
      },
    });
    expect(asked.isError).toBeFalsy();
    const result = await client.callTool({
      name: "update",
      arguments: {
        askId: ASK_ID,
        actions: [
          {
            action: "change",
            itemId: "plan",
            props: question([...worstPlanItems(), ...worstPointerItems()]),
          },
        ],
      },
    });
    await close();
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result) as {
      applied: { action: string; itemId: string; rev: number }[];
      warnings: { code: string; message: string }[];
    };
    expect(json.applied).toEqual([{ action: "change", itemId: "plan", rev: 2 }]);
    expect(validateAgainst(SCHEMA_IDS.updateResult, json).ok).toBe(true);
    expect(JSON.stringify(json.warnings).length).toBeLessThanOrEqual(20_000);
    const unresolved = json.warnings.filter((warning) => warning.code === "unresolved-pointer");
    const formula = json.warnings.filter((warning) => warning.code === "formula");
    expect(unresolved.length + formula.length).toBe(json.warnings.length);
    // The unresolved warnings come first, each kind ending in its closing warning.
    expect(json.warnings.slice(0, unresolved.length)).toEqual(unresolved);
    expect(unresolved.at(-1)?.message).toMatch(/more unresolved pointers are left out: /);
    expect(formula.at(-1)?.message).toMatch(/more formula warnings are left out\.$/);
    expect(JSON.stringify(unresolved).length).toBeLessThanOrEqual(10_000);
    expect(JSON.stringify(formula).length).toBeLessThanOrEqual(10_000);
  });
});
