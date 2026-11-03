// `sourceOf` and `editorTarget` for `board-host` (excerpts, task 3.4; design decision 4, For
// `board-host`; core spec, "A source's current state for the reading panel", "The editor target is
// confined again at the click"), with a fake `SourceFiles` port.

import { describe, expect, test } from "bun:test";
import type { ContextItem } from "@askboard/contract";
import {
  ADR_POINTER,
  CONTEXT_ASK_ID,
  contextAsk,
  contextCoreWith,
  everyItem,
  excerpt,
  PROJECT_ROOT,
} from "./context-fakes.ts";
import { callOf, REVIEWER_ORIGIN } from "./push-fakes.ts";

const created = async (
  options: Parameters<typeof contextCoreWith>[0] = {},
  ask = contextAsk(everyItem()),
) => {
  const fakes = contextCoreWith({
    answers: {
      "src/retry.ts#L1-L5": {
        resolveReference: { status: "resolved", lines: { start: 1, end: 5 } },
      },
    },
    ...options,
  });
  await fakes.core.ask(ask);
  fakes.sources.calls.length = 0;
  return fakes;
};

describe("sourceOf", () => {
  test("a pointer excerpt: its state with the stored text for changed, and its text", async () => {
    const { core, sources } = await created();
    const source = core.sourceOf(CONTEXT_ASK_ID, "retry-adr");
    expect(sources.calls).toEqual([]);
    expect(await source?.state()).toEqual({ status: "available", line: 7 });
    expect(await source?.text()).toEqual({ status: "available", text: `source of ${ADR_POINTER}` });
    expect(sources.calls).toEqual([
      {
        op: "sourceState",
        root: PROJECT_ROOT,
        pointer: ADR_POINTER,
        sentText: `text of ${ADR_POINTER}`,
      },
      { op: "readSource", root: PROJECT_ROOT, pointer: ADR_POINTER },
    ]);
  });

  test("changed is the port's answer for the range now", async () => {
    const changed = { status: "available", line: 7, changed: true } as const;
    const { core } = await created({ answers: { [ADR_POINTER]: { sourceState: changed } } });
    expect(await core.sourceOf(CONTEXT_ASK_ID, "retry-adr")?.state()).toEqual(changed);
  });

  test("a pointer reference: its state, with no text to compare", async () => {
    const { core, sources } = await created();
    await core.sourceOf(CONTEXT_ASK_ID, "retry-src")?.state();
    expect(sources.calls).toEqual([
      { op: "sourceState", root: PROJECT_ROOT, pointer: "src/retry.ts#L1-L5" },
    ]);
  });

  test("an unresolved pointer excerpt is still a source, with no text to compare", async () => {
    const missing = { status: "unresolved", reason: "not-found" } as const;
    const { core, sources } = await created(
      { answers: { "docs/missing.md#Intro": { resolveExcerpt: missing } } },
      contextAsk([excerpt("gone", "docs/missing.md#Intro")]),
    );
    await core.sourceOf(CONTEXT_ASK_ID, "gone")?.state();
    expect(sources.calls).toEqual([
      { op: "sourceState", root: PROJECT_ROOT, pointer: "docs/missing.md#Intro" },
    ]);
  });

  test.each([
    ["an image", "shot"],
    ["a written excerpt", "note"],
    ["a GitHub reference", "pr"],
    ["a web reference", "docs"],
    ["an unknown item", "nowhere"],
    ["a question", "fix"],
  ])("%s has no source", async (_, itemId) => {
    const { core } = await created();
    expect(core.sourceOf(CONTEXT_ASK_ID, itemId)).toBeUndefined();
    expect(await core.editorTarget(CONTEXT_ASK_ID, itemId)).toBeUndefined();
  });

  test("an item of an earlier revision only, a deleted item and a discarded ask have none", async () => {
    const { core } = await created({}, contextAsk(everyItem(), [excerpt("flags", "docs/f.md#A")]));
    await core.update({
      askId: CONTEXT_ASK_ID,
      actions: [
        { action: "change", itemId: "fix", props: { items: [excerpt("other", ADR_POINTER)] } },
        { action: "delete", itemId: "rollout" },
      ],
    });
    expect(core.sourceOf(CONTEXT_ASK_ID, "retry-adr")).toBeUndefined();
    expect(core.sourceOf(CONTEXT_ASK_ID, "flags")).toBeUndefined();
    expect(core.sourceOf(CONTEXT_ASK_ID, "other")).toBeDefined();
    core.discardAll("session-exit");
    expect(core.sourceOf(CONTEXT_ASK_ID, "other")).toBeUndefined();
    expect(await core.editorTarget(CONTEXT_ASK_ID, "other")).toBeUndefined();
    expect(core.sourceOf("no-such-ask", "other")).toBeUndefined();
  });

  test("an owned ask's source is read against its origin's root", async () => {
    const fakes = contextCoreWith();
    fakes.table.add({
      ownerKey: "reviewer",
      tool: "ask",
      askIds: [CONTEXT_ASK_ID],
      toolUseId: "toolu_1",
      origin: REVIEWER_ORIGIN,
    });
    await fakes.core.ask(
      contextAsk([excerpt("a", ADR_POINTER)]),
      callOf("ask", CONTEXT_ASK_ID, "toolu_1"),
    );
    fakes.sources.calls.length = 0;
    await fakes.core.sourceOf(CONTEXT_ASK_ID, "a")?.state();
    expect(fakes.sources.calls.map((call) => call.root)).toEqual([
      "/home/paola/orders-worktrees/fix-retry",
    ]);
  });

  test("without a project root or a port, the source is missing and nothing is called", async () => {
    for (const options of [{ projectRoot: null }, { noSources: true }] as const) {
      const { core, sources } = await created(options);
      const source = core.sourceOf(CONTEXT_ASK_ID, "retry-adr");
      expect(await source?.state()).toEqual({ status: "missing" });
      expect(await source?.text()).toEqual({ status: "missing" });
      expect(await core.editorTarget(CONTEXT_ASK_ID, "retry-adr")).toBeUndefined();
      expect(sources.calls).toEqual([]);
    }
  });

  test("a port call that rejects is reported, and the source is missing", async () => {
    const { core, reported } = await created();
    const fakes = contextCoreWith({ reject: [ADR_POINTER] });
    await fakes.core.ask(contextAsk([excerpt("retry-adr", ADR_POINTER)]));
    fakes.reported.length = 0;
    const source = fakes.core.sourceOf(CONTEXT_ASK_ID, "retry-adr");
    expect(await source?.state()).toEqual({ status: "missing" });
    expect(await source?.text()).toEqual({ status: "missing" });
    expect(await fakes.core.editorTarget(CONTEXT_ASK_ID, "retry-adr")).toBeUndefined();
    expect(fakes.reported).toHaveLength(3);
    expect(reported).toEqual([]);
    expect(core.sourceOf(CONTEXT_ASK_ID, "retry-adr")).toBeDefined();
  });
});

describe("editorTarget", () => {
  test("the port's confined real path and the anchor's current line", async () => {
    const { core, sources } = await created();
    expect(await core.editorTarget(CONTEXT_ASK_ID, "retry-adr")).toEqual({
      file: `${PROJECT_ROOT}/docs/adr/0012-payment-retries.md`,
      line: 7,
    });
    expect(sources.calls).toEqual([
      { op: "editorTarget", root: PROJECT_ROOT, pointer: ADR_POINTER },
    ]);
  });

  test("without a current line: the board document's first line, else 1", async () => {
    const lineless = (file: string) => ({ editorTarget: { file } });
    const plain: ContextItem = { type: "reference", id: "plain", props: { pointer: "README.md" } };
    const { core } = await created(
      {
        answers: {
          "src/retry.ts#L1-L5": {
            resolveReference: { status: "resolved", lines: { start: 3, end: 5 } },
            ...lineless("/r/src/retry.ts"),
          },
          [ADR_POINTER]: lineless("/r/adr.md"),
          "README.md": lineless("/r/README.md"),
        },
      },
      contextAsk([...everyItem(), plain]),
    );
    expect(await core.editorTarget(CONTEXT_ASK_ID, "retry-adr")).toEqual({
      file: "/r/adr.md",
      line: 7,
    });
    expect(await core.editorTarget(CONTEXT_ASK_ID, "retry-src")).toEqual({
      file: "/r/src/retry.ts",
      line: 3,
    });
    expect(await core.editorTarget(CONTEXT_ASK_ID, "plain")).toEqual({
      file: "/r/README.md",
      line: 1,
    });
  });

  test("a file swapped for an outside symlink after the send gives no target", async () => {
    const { core } = await created({ answers: { [ADR_POINTER]: { editorTarget: undefined } } });
    expect(await core.editorTarget(CONTEXT_ASK_ID, "retry-adr")).toBeUndefined();
  });
});
