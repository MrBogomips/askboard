import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  LIFECYCLE,
  lifecycleAsk,
  lifecycleBoardDocument,
  lifecycleCollectResult,
  lifecycleDraftRecord,
  lifecycleFetchPage,
  lifecycleFetchResult,
  lifecycleUpdate,
  lifecycleUpdateResult,
} from "../src/fixtures/index.ts";
import {
  ACTION_ID_PATTERN,
  ANNOTATION_MAX_CHARS,
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  DRAFT_RECORD_MAX_CHARS,
  FETCH_PAGE_MAX_CHARS,
  FOLLOW_UP_MAX_CHARS,
  GRACE_PERIOD_MS,
  INPUT_FORMAT_VERSION,
  NOTE_MAX_CHARS,
  OPTION_NOTE_MAX_CHARS,
  OTHER_MAX_CHARS,
  OUTPUT_FORMAT_VERSION,
  PREVIEW_MAX_CHARS,
  REPLY_MAX_CHARS,
  RESULT_MAX_CHARS,
  RESULT_VERSIONS,
  SCHEMA_IDS,
  TAKEOVER_FLUSH_WAIT_MS,
  TOOL_ENVELOPES_VERSION,
  VIEW_MANIFEST_VERSION,
} from "../src/index.ts";
import act from "../src/schemas/board-protocol/act.json";
import boardState from "../src/schemas/board-protocol/board-state.json";
import done from "../src/schemas/board-protocol/done.json";
import draftRecord from "../src/schemas/board-protocol/draft-record.json";
import refused from "../src/schemas/board-protocol/refused.json";
import questionProps from "../src/schemas/input/question-props.json";
import update from "../src/schemas/input/update.json";
import answerEvent from "../src/schemas/output/answer-event.json";
import followUpEvent from "../src/schemas/output/follow-up-event.json";
import noteEvent from "../src/schemas/output/note-event.json";
import fetchPage from "../src/schemas/tool-envelopes/fetch-page.json";
import {
  draftRecordProblems,
  validateAgainst,
  validateAskRequest,
  validateBoardDocument,
  validateUpdateRequest,
} from "../src/validate.ts";

// Lifecycle constants, versions, fixtures and exports (contract spec: Lifecycle constants,
// Lifecycle fixtures; task 1.5).

describe("the lifecycle constants (design decision 2)", () => {
  test("the grace period is 120 s, over the 90 s floor of any board liveness timeout", () => {
    expect(GRACE_PERIOD_MS).toBe(120_000);
    expect(GRACE_PERIOD_MS).toBeGreaterThanOrEqual(90_000);
    expect(TAKEOVER_FLUSH_WAIT_MS).toBe(1_000);
  });

  test("text limits: 10,000 for notes, Other text, follow-ups and replies; 2,000 and 10,000 beside options", () => {
    expect([NOTE_MAX_CHARS, OTHER_MAX_CHARS, FOLLOW_UP_MAX_CHARS, REPLY_MAX_CHARS]).toEqual([
      10_000, 10_000, 10_000, 10_000,
    ]);
    expect([OPTION_NOTE_MAX_CHARS, ANNOTATION_MAX_CHARS, PREVIEW_MAX_CHARS]).toEqual([
      2_000, 2_000, 10_000,
    ]);
  });

  test("a draft record takes at most 2,000,000 characters, a fetch page 24,000", () => {
    expect(DRAFT_RECORD_MAX_CHARS).toBe(2_000_000);
    expect(FETCH_PAGE_MAX_CHARS).toBe(24_000);
    const envelope = JSON.stringify({ ...lifecycleFetchPage, part: "" }).length;
    expect(FETCH_PAGE_MAX_CHARS + envelope).toBeLessThan(RESULT_MAX_CHARS);
  });

  test("an action ID is 22 base64url characters", () => {
    const pattern = new RegExp(ACTION_ID_PATTERN);
    const drawn = Buffer.from(new Uint8Array(16).fill(251)).toString("base64url");
    expect(pattern.test(drawn)).toBe(true);
    for (const bad of [drawn.slice(1), `${drawn}A`, `${drawn.slice(1)}+`]) {
      expect({ bad, ok: pattern.test(bad) }).toEqual({ bad, ok: false });
    }
  });

  test("the schemas use the constants", () => {
    const option = questionProps.$defs.option.properties;
    expect(option.preview.maxLength).toBe(PREVIEW_MAX_CHARS);
    expect(option.annotation.maxLength).toBe(ANNOTATION_MAX_CHARS);
    expect(act.$defs.answer.properties.note.maxLength).toBe(NOTE_MAX_CHARS);
    expect(act.$defs.answer.properties.other.maxLength).toBe(OTHER_MAX_CHARS);
    expect(act.$defs.answer.properties.optionNotes.additionalProperties.maxLength).toBe(
      OPTION_NOTE_MAX_CHARS,
    );
    expect(act.$defs["follow-up"].properties.text.maxLength).toBe(FOLLOW_UP_MAX_CHARS);
    expect(draftRecord.$defs.question.properties.composer.maxLength).toBe(FOLLOW_UP_MAX_CHARS);
    expect(fetchPage.properties.part.maxLength).toBe(FETCH_PAGE_MAX_CHARS);
    // The user's text wherever it travels, and the agent's: the update request, the events, the
    // board state and the draft record hold the same limits as the act that sends it.
    const updated = update.$defs.answer.properties.answer.properties;
    const drafted = draftRecord.$defs.question.properties;
    const stated = boardState.$defs;
    const limits: [string, unknown, number][] = [
      ["update answer.other", updated.other.maxLength, OTHER_MAX_CHARS],
      ["update answer.note", updated.note.maxLength, NOTE_MAX_CHARS],
      ["update reply.text", update.$defs.reply.properties.text.maxLength, REPLY_MAX_CHARS],
      ["answer event other", answerEvent.properties.other.maxLength, OTHER_MAX_CHARS],
      ["answer event note", answerEvent.properties.note.maxLength, NOTE_MAX_CHARS],
      [
        "answer event optionNotes",
        answerEvent.properties.optionNotes.additionalProperties.maxLength,
        OPTION_NOTE_MAX_CHARS,
      ],
      ["note event note", noteEvent.properties.note.maxLength, NOTE_MAX_CHARS],
      ["follow-up event text", followUpEvent.properties.text.maxLength, FOLLOW_UP_MAX_CHARS],
      ["board state answer other", stated.answer.properties.other.maxLength, OTHER_MAX_CHARS],
      ["board state answer note", stated.answer.properties.note.maxLength, NOTE_MAX_CHARS],
      [
        "board state answer optionNotes",
        stated.answer.properties.optionNotes.additionalProperties.maxLength,
        OPTION_NOTE_MAX_CHARS,
      ],
      [
        "board state follow-up text",
        stated.followUp.properties.text.maxLength,
        FOLLOW_UP_MAX_CHARS,
      ],
      ["board state reply text", stated.reply.properties.text.maxLength, REPLY_MAX_CHARS],
      ["draft other", drafted.other.maxLength, OTHER_MAX_CHARS],
      ["draft note", drafted.note.maxLength, NOTE_MAX_CHARS],
      [
        "draft optionNotes",
        drafted.optionNotes.additionalProperties.maxLength,
        OPTION_NOTE_MAX_CHARS,
      ],
    ];
    for (const [where, schema, constant] of limits) {
      expect({ where, maxLength: schema }).toEqual({ where, maxLength: constant });
    }
    for (const schema of [act, done, refused]) {
      expect(schema.properties.actionId.pattern).toBe(ACTION_ID_PATTERN);
    }
  });
});

describe("the versions (design decision 2)", () => {
  test("each set E3 touches is at its next minor or a later one, and the view manifest is unchanged", () => {
    // A later change takes the next minor again (excerpts, design decision 2).
    const atLeast11 = (version: string) => (/^1\.([1-9][0-9]*)$/.test(version) ? "1.1+" : version);
    const versions = {
  // settings-languages later took 1.2 for the input format (its design decision 2).
  // settings-languages later took 1.2 for the input format and the board document (its design
  // decision 2).
  // settings-languages later took 1.2 for the input format, the board document and the board
  // protocol (its design decision 2).
  test("each set E3 touches is at its next minor, and the view manifest is unchanged", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
      protocol: BOARD_PROTOCOL_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
    };
    expect(Object.fromEntries(Object.entries(versions).map(([k, v]) => [k, atLeast11(v)]))).toEqual(
      {
        input: "1.1+",
        output: "1.1+",
        envelopes: "1.1+",
        document: "1.1+",
        protocol: "1.1+",
        manifest: "1.0",
      },
    );
    expect(RESULT_VERSIONS).toEqual({
      result: TOOL_ENVELOPES_VERSION,
      output: OUTPUT_FORMAT_VERSION,
    }).toEqual({
      input: "1.2",
      output: "1.1",
      envelopes: "1.1",
      document: "1.2",
      protocol: "1.2",
      manifest: "1.0",
    });
  });
});

// Each fixture against the full contract, named, so that one that diverges is named when it fails.
const FIXTURES: readonly [string, unknown, (value: unknown) => { ok: boolean }][] = [
  ["lifecycleAsk", lifecycleAsk, validateAskRequest],
  ["lifecycleAsk, generic", lifecycleAsk, (value) => validateAgainst(SCHEMA_IDS.askRequest, value)],
  ["lifecycleBoardDocument", lifecycleBoardDocument, validateBoardDocument],
  [
    "lifecycleDraftRecord",
    lifecycleDraftRecord,
    (value) => validateAgainst(SCHEMA_IDS.draftRecord, value),
  ],
  ["lifecycleUpdate", lifecycleUpdate, validateUpdateRequest],
  [
    "lifecycleUpdate, generic",
    lifecycleUpdate,
    (value) => validateAgainst(SCHEMA_IDS.updateRequest, value),
  ],
  [
    "lifecycleUpdateResult",
    lifecycleUpdateResult,
    (value) => validateAgainst(SCHEMA_IDS.updateResult, value),
  ],
  [
    "lifecycleFetchResult",
    lifecycleFetchResult,
    (value) => validateAgainst(SCHEMA_IDS.fetchResult, value),
  ],
  [
    "lifecycleFetchPage",
    lifecycleFetchPage,
    (value) => validateAgainst(SCHEMA_IDS.fetchPage, value),
  ],
  [
    "lifecycleCollectResult",
    lifecycleCollectResult,
    (value) => validateAgainst(SCHEMA_IDS.collectResult, value),
  ],
];

describe("the lifecycle fixtures", () => {
  test.each(FIXTURES)("%s validates against the full contract", (fixture, value, validate) => {
    expect({ fixture, ok: validate(value).ok }).toEqual({ fixture, ok: true });
  });

  test("a fixture that diverges fails, named", () => {
    const edited = { ...lifecycleFetchResult, item: { ...lifecycleFetchResult.item, rev: 0 } };
    const [, , validate] = FIXTURES.find(([name]) => name === "lifecycleFetchResult") ?? [];
    expect({ fixture: "lifecycleFetchResult", ok: validate?.(edited).ok }).toEqual({
      fixture: "lifecycleFetchResult",
      ok: false,
    });
  });

  test("the ask holds areas and every field FR-3 adds", () => {
    const text = JSON.stringify(lifecycleAsk);
    for (const field of [
      "area",
      "allowOther",
      "preview",
      "annotation",
      "recommended",
      "multiSelect",
    ]) {
      expect(text).toContain(`"${field}"`);
    }
    expect(lifecycleAsk.askId).toBe(LIFECYCLE.askId);
  });

  test("the update holds every action, in an order ask-core can apply", () => {
    expect(lifecycleUpdate.actions.map(({ action }) => action)).toEqual([
      "add",
      "change",
      "delete",
      "reopen",
      "answer",
      "reply",
      "close",
    ]);
    expect(lifecycleUpdateResult.applied.map(({ action }) => action)).toEqual(
      lifecycleUpdate.actions.map(({ action }) => action),
    );
  });

  test("the collect result holds every event type the output format defines", () => {
    const types = new Set<string>(
      lifecycleCollectResult.asks.flatMap((ask) => ask.events.map((event) => event.type)),
    );
    expect([...types].sort()).toEqual(
      ["answer", "discarded", "edit-choice", "follow-up", "note", "postponed", "reopened"].sort(),
    );
  });

  test("the fetch page is the first slice of the fetch result's item, as RFC 8785 text", () => {
    // RFC 8785 for these values: keys sorted, no space; the fixtures hold no number with a fraction.
    const canon = (value: unknown): string =>
      Array.isArray(value)
        ? `[${value.map(canon).join(",")}]`
        : typeof value === "object" && value !== null
          ? `{${Object.keys(value)
              .sort()
              .map(
                (key) => `${JSON.stringify(key)}:${canon((value as Record<string, unknown>)[key])}`,
              )
              .join(",")}}`
          : JSON.stringify(value);
    expect(lifecycleFetchPage.itemId).toBe(lifecycleFetchResult.item.id);
    expect(lifecycleFetchPage.part).toBe(canon(lifecycleFetchResult.item).slice(0, 120));
    expect(lifecycleFetchPage.continuation).toBeDefined();
  });

  test("the draft record names the board's questions as own properties", () => {
    expect(draftRecordProblems(lifecycleDraftRecord, lifecycleBoardDocument)).toEqual([]);
  });
});

describe("importing the contract", () => {
  test("registers nothing: the schemas compile at the first validation", async () => {
    const root = join(import.meta.dir, "..");
    const script = `
      import Ajv2020 from "ajv/dist/2020";
      let added = 0;
      const add = Ajv2020.prototype.addSchema;
      Ajv2020.prototype.addSchema = function (...args) { added += 1; return add.apply(this, args); };
      await import("./src/index.ts");
      await import("./src/validate.ts");
      await import("./src/fixtures/index.ts");
      const before = added;
      const { validateUpdateRequest } = await import("./src/validate.ts");
      validateUpdateRequest({});
      console.log(JSON.stringify({ before, after: added > 0 }));
    `;
    const run = Bun.spawnSync(["bun", "-e", script], { cwd: root, stderr: "pipe" });
    expect(run.stderr.toString()).toBe("");
    expect(JSON.parse(run.stdout.toString())).toEqual({ before: 0, after: true });
  });
});
