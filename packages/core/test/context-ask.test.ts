// Resolution at `ask` (excerpts, task 3.2; design decision 4; core spec, "Context resolved when an
// ask or update is sent", "The ask's root", "An unresolved pointer never blocks the board",
// "Agent-written excerpts are kept as written"), with a fake `SourceFiles` port.

import { describe, expect, test } from "bun:test";
import {
  ASK_IMAGES_MAX_BYTES,
  CONTEXT_READS_MAX,
  CONTEXT_RESOLVE_BUDGET_MS,
  type ContextItem,
  POINTER_MAX_CHARS,
  UNRESOLVED_REASONS,
  type UnresolvedReason,
} from "@askboard/contract";
import { ONE_PIXEL_PNG } from "@askboard/contract/fixtures";
import { validateBoardDocument } from "@askboard/contract/validate";
import { UNRESOLVED_MESSAGES } from "../src/context/warnings.ts";
import {
  ADR_POINTER,
  boardItemsOf,
  CONTEXT_ASK_ID,
  contextAsk,
  contextCoreWith,
  excerpt,
  PROJECT_ROOT,
  turns,
} from "./context-fakes.ts";
import { callOf, REVIEWER_ORIGIN } from "./push-fakes.ts";

const created = async (options: Parameters<typeof contextCoreWith>[0] = {}, ask = contextAsk()) => {
  const fakes = contextCoreWith(options);
  const outcome = await fakes.core.ask(ask);
  return { ...fakes, outcome };
};

describe("each item type and status", () => {
  test("every item resolved: the board document holds what was read, beside the props sent", async () => {
    const { core, outcome } = await created({
      answers: {
        "src/retry.ts#L1-L5": {
          resolveReference: { status: "resolved", lines: { start: 1, end: 5 } },
        },
      },
    });
    expect(outcome).toEqual({ kind: "created", ask: expect.anything() });
    expect(boardItemsOf(core, CONTEXT_ASK_ID)).toEqual([
      {
        type: "excerpt",
        id: "retry-adr",
        props: {
          pointer: ADR_POINTER,
          status: "resolved",
          text: `text of ${ADR_POINTER}`,
          mediaType: "text/markdown",
          lines: { start: 7, end: 9 },
        },
      },
      { type: "excerpt", id: "note", props: { text: "<script>alert(1)</script>", title: "Note" } },
      {
        type: "reference",
        id: "retry-src",
        props: {
          pointer: "src/retry.ts#L1-L5",
          kind: "file",
          status: "resolved",
          lines: { start: 1, end: 5 },
        },
      },
      {
        type: "reference",
        id: "pr",
        props: { url: "https://github.com/acme/orders/pull/12", kind: "github" },
      },
      { type: "reference", id: "docs", props: { url: "https://example.com/retries", kind: "web" } },
      {
        type: "image",
        id: "shot",
        props: {
          pointer: ".askboard/media/shot.png",
          alt: "The failure",
          status: "resolved",
          mediaType: "image/png",
          bytes: ONE_PIXEL_PNG,
        },
      },
    ]);
  });

  test("the board document with resolved context validates against board document 1.2", async () => {
    const { core } = await created();
    const view = core.lifecycleBoard(CONTEXT_ASK_ID);
    expect(view !== undefined && "document" in view).toBe(true);
    if (view === undefined || !("document" in view)) return;
    expect(validateBoardDocument(view.document).ok).toBe(true);
  });

  test.each(UNRESOLVED_REASONS.filter((reason) => reason !== "no-root" && reason !== "timeout"))(
    "every item type unresolved with reason %s keeps its props and the reason",
    async (reason) => {
      const unresolved = { status: "unresolved", reason } as const;
      const { core, outcome } = await created({
        answers: {
          [ADR_POINTER]: { resolveExcerpt: unresolved },
          "src/retry.ts#L1-L5": { resolveReference: unresolved },
          ".askboard/media/shot.png": { resolveImage: unresolved },
        },
      });
      const items = boardItemsOf(core, CONTEXT_ASK_ID) ?? [];
      expect(items.map((item) => item.props)).toEqual([
        { pointer: ADR_POINTER, status: "unresolved", reason },
        { text: "<script>alert(1)</script>", title: "Note" },
        { pointer: "src/retry.ts#L1-L5", kind: "file", status: "unresolved", reason },
        { url: "https://github.com/acme/orders/pull/12", kind: "github" },
        { url: "https://example.com/retries", kind: "web" },
        { pointer: ".askboard/media/shot.png", alt: "The failure", status: "unresolved", reason },
      ]);
      expect(outcome.kind === "created" && outcome.warnings?.map((w) => w.itemId)).toEqual([
        "retry-adr",
        "retry-src",
        "shot",
      ]);
    },
  );

  test("each pointer is read by its item's operation, against the project root", async () => {
    const { sources } = await created();
    expect(sources.calls).toEqual([
      { op: "resolveExcerpt", root: PROJECT_ROOT, pointer: ADR_POINTER },
      { op: "resolveReference", root: PROJECT_ROOT, pointer: "src/retry.ts#L1-L5" },
      { op: "resolveImage", root: PROJECT_ROOT, pointer: ".askboard/media/shot.png" },
    ]);
  });

  test("questions inside areas are resolved too", async () => {
    const { core, sources } = await created(
      {},
      {
        askId: CONTEXT_ASK_ID,
        items: [
          {
            type: "area",
            id: "payments",
            props: {
              title: "Payments",
              items: [
                {
                  type: "question",
                  id: "fix",
                  props: {
                    text: "Which fix?",
                    options: [{ label: "A" }, { label: "B" }],
                    items: [excerpt("retry-adr", ADR_POINTER)],
                  },
                },
              ],
            },
          },
        ],
      },
    );
    expect(sources.calls.map((call) => call.pointer)).toEqual([ADR_POINTER]);
    expect(boardItemsOf(core, CONTEXT_ASK_ID)?.[0]?.props).toMatchObject({ status: "resolved" });
  });

  test("an ask with no context reads nothing and carries no warning", async () => {
    const { outcome, sources } = await created({}, contextAsk([]));
    expect(sources.calls).toEqual([]);
    expect(outcome).toEqual({ kind: "created", ask: expect.anything() });
  });
});

describe("agent-written excerpts", () => {
  test("text that looks like markup reaches the board document unchanged and reads nothing", async () => {
    const written = {
      type: "excerpt",
      id: "note",
      props: { text: "<script>alert(1)</script>" },
    } as const;
    const { core, sources, outcome } = await created({}, contextAsk([written as ContextItem]));
    expect(sources.calls).toEqual([]);
    expect(boardItemsOf(core, CONTEXT_ASK_ID)).toEqual([written]);
    expect(outcome).toEqual({ kind: "created", ask: expect.anything() });
  });
});

describe("the ask's root", () => {
  test("an owned ask whose origin has a root reads from that root, not the project's", async () => {
    const fakes = contextCoreWith();
    fakes.table.add({
      ownerKey: "reviewer",
      tool: "ask",
      askIds: [CONTEXT_ASK_ID],
      toolUseId: "toolu_1",
      origin: REVIEWER_ORIGIN,
    });
    await fakes.core.ask(contextAsk([excerpt("a", "src/retry.ts#L1-L5")]), {
      ...callOf("ask", CONTEXT_ASK_ID, "toolu_1"),
    });
    expect(fakes.sources.calls.map((call) => call.root)).toEqual([
      "/home/paola/orders-worktrees/fix-retry",
    ]);
  });

  test("an unchecked ask reads from the project root", async () => {
    const { sources } = await created({}, contextAsk([excerpt("a", "src/retry.ts#L1-L5")]));
    expect(sources.calls.map((call) => call.root)).toEqual([PROJECT_ROOT]);
  });

  test("without a project root, every pointer is no-root, the ask is created and nothing is called", async () => {
    const { core, sources, outcome } = await created({ projectRoot: null });
    expect(outcome.kind).toBe("created");
    expect(sources.calls).toEqual([]);
    const reasons = (boardItemsOf(core, CONTEXT_ASK_ID) ?? []).flatMap((item) =>
      "reason" in item.props ? [item.props.reason] : [],
    );
    expect(reasons).toEqual(["no-root", "no-root", "no-root"]);
  });

  test("without a project root, an owned ask whose origin gives a root is still no-root", async () => {
    const fakes = contextCoreWith({ projectRoot: null });
    fakes.table.add({
      ownerKey: "reviewer",
      tool: "ask",
      askIds: [CONTEXT_ASK_ID],
      toolUseId: "toolu_1",
      origin: REVIEWER_ORIGIN,
    });
    const outcome = await fakes.core.ask(contextAsk([excerpt("a", "src/retry.ts#L1-L5")]), {
      ...callOf("ask", CONTEXT_ASK_ID, "toolu_1"),
    });
    expect(fakes.sources.calls).toEqual([]);
    expect(boardItemsOf(fakes.core, CONTEXT_ASK_ID)?.[0]?.props).toEqual({
      pointer: "src/retry.ts#L1-L5",
      status: "unresolved",
      reason: "no-root",
    });
    expect(outcome.kind === "created" ? outcome.warnings?.[0] : undefined).toMatchObject({
      reason: "no-root",
    });
  });

  test("a core built without the SourceFiles port gives no-root", async () => {
    const { core } = await created({ noSources: true }, contextAsk([excerpt("a", ADR_POINTER)]));
    expect(boardItemsOf(core, CONTEXT_ASK_ID)?.[0]?.props).toMatchObject({ reason: "no-root" });
  });
});

describe("bounds", () => {
  test(`at most CONTEXT_READS_MAX (${CONTEXT_READS_MAX}) reads run at once`, async () => {
    const items = Array.from({ length: CONTEXT_READS_MAX * 2 + 3 }, (_, n) =>
      excerpt(`e${n}`, `docs/${n}.md#Intro`),
    );
    const fakes = contextCoreWith({ held: true });
    const pending = fakes.core.ask(contextAsk(items));
    await turns();
    expect(fakes.sources.running).toBe(CONTEXT_READS_MAX);
    while (fakes.sources.calls.length < items.length || fakes.sources.running > 0) {
      fakes.sources.release();
      await turns();
    }
    const outcome = await pending;
    expect(outcome.kind).toBe("created");
    expect(fakes.sources.most).toBe(CONTEXT_READS_MAX);
    expect(fakes.sources.calls).toHaveLength(items.length);
  });

  test("when the budget ends, a read that never settles is timeout and the ask is created", async () => {
    const fakes = contextCoreWith({ hang: ["docs/slow.md#Intro"] });
    const pending = fakes.core.ask(
      contextAsk([excerpt("slow", "docs/slow.md#Intro"), excerpt("fast", ADR_POINTER)]),
    );
    await turns();
    expect(fakes.clock.pending).toBe(1);
    fakes.clock.advance(CONTEXT_RESOLVE_BUDGET_MS - 1);
    await turns();
    expect(fakes.core.lifecycleBoard(CONTEXT_ASK_ID)).toBeUndefined();
    fakes.clock.advance(1);
    const outcome = await pending;
    expect(outcome.kind).toBe("created");
    const items = boardItemsOf(fakes.core, CONTEXT_ASK_ID) ?? [];
    expect(items.map((item) => item.props)).toEqual([
      { pointer: "docs/slow.md#Intro", status: "unresolved", reason: "timeout" },
      expect.objectContaining({ pointer: ADR_POINTER, status: "resolved" }),
    ]);
    expect(fakes.clock.pending).toBe(0);
  });

  test("reads that all settle cancel the budget's timer", async () => {
    const { clock } = await created();
    expect(clock.pending).toBe(0);
  });

  test("the reads not started when the budget ends never start", async () => {
    const items = Array.from({ length: CONTEXT_READS_MAX + 2 }, (_, n) =>
      excerpt(`e${n}`, `docs/${n}.md#Intro`),
    );
    const fakes = contextCoreWith({
      hang: items.map((item) => (item.props as { pointer: string }).pointer),
    });
    const pending = fakes.core.ask(contextAsk(items));
    await turns();
    fakes.clock.advance(CONTEXT_RESOLVE_BUDGET_MS);
    await pending;
    await turns();
    expect(fakes.sources.calls).toHaveLength(CONTEXT_READS_MAX);
  });

  test("a read that rejects is reported and unresolved, and the ask is created", async () => {
    const { core, reported, outcome } = await created(
      { reject: [ADR_POINTER] },
      contextAsk([excerpt("a", ADR_POINTER)]),
    );
    expect(outcome.kind).toBe("created");
    expect(reported).toEqual([new Error(`EIO reading ${ADR_POINTER}`)]);
    expect(boardItemsOf(core, CONTEXT_ASK_ID)?.[0]?.props).toEqual({
      pointer: ADR_POINTER,
      status: "unresolved",
      reason: "not-found",
    });
  });

  test("images past the per-ask limit are too-large, in item order, and a smaller one still fits", async () => {
    // Three images: 10 MiB, 10 MiB and one pixel; the second would pass 16 MiB.
    const big = "A".repeat(((10 * 1024 * 1024) / 3) * 4);
    const image = (id: string): ContextItem => ({
      type: "image",
      id,
      props: { pointer: `.askboard/media/${id}.png`, alt: id },
    });
    const answer = {
      resolveImage: { status: "resolved", mediaType: "image/png", bytes: big },
    } as const;
    const { core, outcome } = await created(
      { answers: { ".askboard/media/one.png": answer, ".askboard/media/two.png": answer } },
      contextAsk([image("one"), image("two"), image("pixel")]),
    );
    expect(10 * 1024 * 1024 * 2).toBeGreaterThan(ASK_IMAGES_MAX_BYTES);
    const statuses = (boardItemsOf(core, CONTEXT_ASK_ID) ?? []).map((item) =>
      "status" in item.props
        ? [item.props.status, "reason" in item.props && item.props.reason]
        : [],
    );
    expect(statuses).toEqual([
      ["resolved", false],
      ["unresolved", "too-large"],
      ["resolved", false],
    ]);
    expect(outcome.kind === "created" && outcome.warnings?.map((w) => w.itemId)).toEqual(["two"]);
  });
});

describe("warnings", () => {
  test("one per unresolved pointer, in item order across questions, naming item, pointer and reason", async () => {
    const missing = { status: "unresolved", reason: "not-found" } as const;
    const outside = { status: "unresolved", reason: "outside-root" } as const;
    const { outcome } = await created(
      {
        answers: {
          "docs/missing.md#Intro": { resolveExcerpt: missing },
          "../secrets.txt#L1-L2": { resolveExcerpt: outside },
        },
      },
      contextAsk(
        [excerpt("good", ADR_POINTER), excerpt("missing", "docs/missing.md#Intro")],
        [excerpt("outside", "../secrets.txt#L1-L2")],
      ),
    );
    expect(outcome.kind === "created" && outcome.warnings).toEqual([
      {
        code: "unresolved-pointer",
        itemId: "missing",
        pointer: "docs/missing.md#Intro",
        reason: "not-found",
        message: expect.any(String),
      },
      {
        code: "unresolved-pointer",
        itemId: "outside",
        pointer: "../secrets.txt#L1-L2",
        reason: "outside-root",
        message: expect.any(String),
      },
    ]);
  });

  // The bound on the warnings (result-bound, core spec "The closing unresolved-pointer warning"; Refs #98).
  describe("the bound on the unresolved-pointer warnings", () => {
    const UNRESOLVED_BOUND = 10_000;

    /** `count` excerpts of pointers of `length` characters, each answered `reason`. */
    const manyExcerpts = (
      count: number,
      pointerOf: (n: number) => string,
      reason: UnresolvedReason,
    ) => {
      const pointers = Array.from({ length: count }, (_, n) => pointerOf(n));
      const answers = Object.fromEntries(
        pointers.map((pointer) => [
          pointer,
          { resolveExcerpt: { status: "unresolved" as const, reason } },
        ]),
      );
      const items = pointers.map((pointer, n) => excerpt(`ex-${n}`, pointer));
      return { answers, items } as const;
    };

    const warningsOf = (outcome: Awaited<ReturnType<typeof created>>["outcome"]) =>
      ((outcome.kind === "created" && outcome.warnings) || []).filter(
        (warning) => warning.code === "unresolved-pointer",
      );

    const unresolvedIds = (core: Parameters<typeof boardItemsOf>[0]) =>
      (boardItemsOf(core, CONTEXT_ASK_ID) ?? [])
        .filter((item) => "status" in item.props && item.props.status === "unresolved")
        .map((item) => item.id);

    test("forty long pointers on an ask: the warnings stay within the bound, a closing one counts the rest, the board marks all 40", async () => {
      const { answers, items } = manyExcerpts(
        40,
        (n) => `../${String(n).padStart(2, "0")}${"d".repeat(POINTER_MAX_CHARS - 5)}`,
        "outside-root",
      );
      expect(
        items.every((item) => "pointer" in item.props && item.props.pointer.length === 1_024),
      ).toBe(true);
      const { core, outcome } = await created({ answers }, contextAsk(items));
      const warnings = warningsOf(outcome);
      expect(JSON.stringify(warnings).length).toBeLessThanOrEqual(UNRESOLVED_BOUND);
      const closing = warnings.at(-1);
      const kept = warnings.length - 1;
      expect(kept).toBeGreaterThan(0);
      expect(warnings.map((warning) => warning.itemId).slice(0, kept)).toEqual(
        items.slice(0, kept).map((item) => item.id),
      );
      expect(closing?.itemId).toBe(`ex-${kept}`);
      expect(closing?.message).toBe(
        `The pointer of ex-${kept} did not resolve (outside-root), and ${40 - kept - 1} more unresolved pointers are left out: fetch their questions to read each one's reason.`,
      );
      expect(unresolvedIds(core)).toHaveLength(40);
    });

    test("pointers that JSON escapes: ten images of 1,024 control characters, each invalid-pointer, a closing warning counting the rest", async () => {
      const controls = "\u0001".repeat(POINTER_MAX_CHARS);
      const images: ContextItem[] = Array.from({ length: 10 }, (_, n) => ({
        type: "image",
        id: `img-${n}`,
        props: { pointer: controls, alt: `Image ${n}` },
      }));
      const answers = {
        [controls]: { resolveImage: { status: "unresolved", reason: "invalid-pointer" } },
      } as const;
      const { core, outcome } = await created({ answers }, contextAsk(images));
      expect(outcome.kind).toBe("created");
      const warnings = warningsOf(outcome);
      expect(JSON.stringify(warnings).length).toBeLessThanOrEqual(UNRESOLVED_BOUND);
      expect(warnings.at(-1)?.message).toContain("more unresolved pointers are left out");
      expect(warnings.at(-1)?.reason).toBe("invalid-pointer");
      expect(unresolvedIds(core)).toHaveLength(10);
    });

    test("under the bound: five missing files give five warnings with their own messages, none closing", async () => {
      const { answers, items } = manyExcerpts(5, (n) => `docs/missing-${n}.md#Intro`, "not-found");
      const { outcome } = await created({ answers }, contextAsk(items));
      const warnings = warningsOf(outcome);
      expect(warnings).toHaveLength(5);
      expect(warnings.map((warning) => warning.message)).toEqual(
        Array(5).fill(UNRESOLVED_MESSAGES["not-found"]),
      );
    });
  });

  test.each(UNRESOLVED_REASONS)(
    "the %s message is plain words naming no path and not telling whether a file exists",
    async (reason) => {
      const unresolved = { status: "unresolved", reason } as const;
      const { outcome } = await created(
        { answers: { "../../etc/passwd#L1-L1": { resolveExcerpt: unresolved } } },
        contextAsk([excerpt("x", "../../etc/passwd#L1-L1")]),
      );
      const message = outcome.kind === "created" ? (outcome.warnings?.[0]?.message ?? "") : "";
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toContain("/");
      expect(message).not.toContain("passwd");
      expect(message).not.toMatch(/\bexists?\b/);
    },
  );
});

describe("the resend rule", () => {
  test("compares the request as sent, not the resolved board document, and reads nothing again", async () => {
    const { core, sources } = await created();
    const before = sources.calls.length;
    const outcome = await core.ask(contextAsk());
    expect(outcome).toEqual({ kind: "resent", ask: expect.anything() });
    expect(sources.calls).toHaveLength(before);
    expect(await core.ask(contextAsk([excerpt("other", ADR_POINTER)]))).toEqual({
      kind: "in-use",
      askId: CONTEXT_ASK_ID,
    });
  });

  test("a refused ask reads nothing: unavailable, or invalid", async () => {
    const unavailable = await created({
      showing: { showable: false, reason: "remote-host", detail: "SSH_CONNECTION is set" },
    });
    expect(unavailable.outcome.kind).toBe("unavailable");
    expect(unavailable.sources.calls).toEqual([]);
    const fakes = contextCoreWith();
    const invalid = await fakes.core.ask({ ...contextAsk(), askId: "Bad ID" });
    expect(invalid.kind).toBe("invalid");
    expect(fakes.sources.calls).toEqual([]);
  });
});
