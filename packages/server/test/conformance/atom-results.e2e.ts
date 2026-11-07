import { afterEach, describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import {
  DATE_FIELD_FIXTURE_ITEMS,
  DATE_FIELD_RESULTS,
  MONEY_FIELD_FIXTURE_ITEMS,
  MONEY_FIELD_RESULTS,
  NUMBER_FIELD_FIXTURE_ITEMS,
  NUMBER_FIELD_RESULTS,
  TEXT_FIELD_FIXTURE_ITEMS,
  TEXT_FIELD_RESULTS,
  TOGGLE_FIXTURE_ITEM,
  TOGGLE_RESULTS,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { callAs } from "./hook-runs.ts";
import { removeShortFolders } from "./modes.ts";
import {
  type AskResultJson,
  connectBoard,
  nextOfType,
  pushedMessage,
  startClaudeSession,
} from "./push-steps.ts";
import { CONFIGURATION, cleanUp, type Session, startSession, type ToolOutcome } from "./session.ts";

// The atoms' end-to-end scenario (atoms, task 6.3; view-and-widgets spec, Atoms end to end): the
// built session process on Bun or Node 24, driven over stdio by the MCP client, in each of AD-1's
// configurations. One question holds the five input atoms (a TextField, a Toggle, a NumberField, a
// DateField and a MoneyField); the board's page, played over the real socket, answers it with the
// five values. With the mod and the hooks the answer reaches the agent as the mod's push; with
// either off it reaches it through `collect`. Either way the event holds the five results by item
// ID, valid against the output format, and `fetch` of one atom returns its result. A sixth answer
// that breaks an atom's bound is refused whole and logs nothing (NFR-10). Run it with run.ts
// beside it.

console.error(`conformance: ${process.env.ASKBOARD_CONFORMANCE_RUNTIME ?? "bun"}, atoms`);

afterEach(async () => {
  for (const host of await cleanUp()) expect(host.record.problems).toEqual([]);
  removeShortFolders();
});

const askId = "atoms-plan-c4n1";
const question = "plan";
const [NAME] = TEXT_FIELD_FIXTURE_ITEMS;
const [DAYS] = NUMBER_FIELD_FIXTURE_ITEMS;
const [START] = DATE_FIELD_FIXTURE_ITEMS;
const [FEE] = MONEY_FIELD_FIXTURE_ITEMS;
const ASK = {
  askId,
  title: "Leave request",
  items: [
    {
      type: "question",
      id: question,
      props: {
        text: "Fill in the request.",
        items: [NAME, TOGGLE_FIXTURE_ITEM, DAYS, START, FEE],
      },
    },
  ],
};
const RESULTS = {
  [NAME.id]: TEXT_FIELD_RESULTS[0],
  [TOGGLE_FIXTURE_ITEM.id]: TOGGLE_RESULTS.on,
  [DAYS.id]: NUMBER_FIELD_RESULTS[0],
  [START.id]: DATE_FIELD_RESULTS[0],
  [FEE.id]: MONEY_FIELD_RESULTS[0],
};
const WHEN = "2026-11-07T10:15:00Z";
const act = (actionId: string, results: Record<string, unknown>) => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "act" as const,
  actionId,
  acts: [{ type: "answer" as const, itemId: question, rev: 1, results, when: WHEN }],
});

type Json = Record<string, unknown>;
type Event = Json & { readonly results?: Json };

/** A tool result's JSON, checked against the contract's schema. */
const checked = (schema: keyof typeof SCHEMA_IDS, outcome: ToolOutcome): Json => {
  expect(outcome.isError).toBe(false);
  expect(outcome.text).toStartWith("{");
  const validation = validateAgainst(SCHEMA_IDS[schema], outcome.json);
  expect(validation.ok ? [] : validation.problems).toEqual([]);
  return outcome.json as Json;
};

const eventsOf = (collected: Json): readonly Event[] =>
  (collected.asks as { events: Event[] }[])[0]?.events ?? [];

// The agent's calls: through its hooks where there are any, since they carry the agent's record.
const callOf = (session: Session) => async (tool: "collect" | "fetch", args: Json) =>
  CONFIGURATION === "mod-and-hooks"
    ? (await callAs(session, undefined, tool, args)).outcome
    : session.call(tool, args);

/** The answer's event as it must stand: the five results by item ID, no edits. */
const expectAnswered = (event: Event | undefined) => {
  expect(event).toMatchObject({ type: "answer", itemId: question, rev: 1 });
  expect(event?.results).toEqual(RESULTS);
  expect(event).not.toHaveProperty("changes");
  expect(event).not.toHaveProperty("tooLarge");
};

describe(`the five input atoms in the ${CONFIGURATION} configuration`, () => {
  test(
    CONFIGURATION === "mod-and-hooks"
      ? "one answer holding the five atoms' results is pushed by the mod, and collect and fetch agree"
      : "one answer holding the five atoms' results is collected, and fetch returns one atom's result",
    async () => {
      const pushing = CONFIGURATION === "mod-and-hooks";
      const { session } = pushing
        ? await startClaudeSession({ mod: {} })
        : { session: await startSession() };
      const call = callOf(session);
      const asked = pushing
        ? (await callAs(session, undefined, "ask", ASK)).outcome
        : await session.call("ask", ASK);
      const result = checked("askResult", asked) as unknown as AskResultJson;
      const board = await connectBoard(result.board);
      board.send(act("aT1oM5rEs0uLtS4wXz9cQd", RESULTS));
      await nextOfType(board, "done");

      let pushed: readonly Event[] | undefined;
      if (pushing) {
        const mod = session.mod;
        if (mod === undefined) throw new Error("this session has no mod host");
        const push = await mod.until((record) => record.pushes[0], "a push");
        expect(push).toMatchObject({ via: "submit" });
        const message = pushedMessage(push.text);
        expect(message).toMatchObject({
          epoch: result.epoch,
          asks: [{ askId, state: "answered" }],
        });
        pushed = (message.asks[0]?.events ?? []) as readonly Event[];
        expect(pushed).toHaveLength(1);
        expectAnswered(pushed[0]);
      }
      // `collect` returns the same event, whether or not it was pushed first.
      const collected = checked(
        "collectResult",
        await call("collect", { asks: [{ askId, after: `${result.epoch}.0` }] }),
      );
      expect(collected.versions).toEqual(RESULT_VERSIONS);
      const events = eventsOf(collected);
      expect(events).toHaveLength(1);
      expectAnswered(events[0]);
      if (pushed !== undefined) expect(events).toEqual(pushed);

      // The MoneyField alone: its amount and currency are the item's `result`.
      const fetched = checked("fetchResult", await call("fetch", { askId, itemId: FEE.id }));
      expect(fetched).toMatchObject({
        state: "answered",
        item: { type: "money-field", id: FEE.id, questionId: question, result: RESULTS[FEE.id] },
      });
      board.socket.terminate();
      expect(await session.end()).toBe(0);
    },
  );

  test("an answer that breaks a bound is refused whole: nothing is logged, nothing is pushed, and collect returns no answer", async () => {
    const pushing = CONFIGURATION === "mod-and-hooks";
    const { session } = pushing
      ? await startClaudeSession({ mod: {} })
      : { session: await startSession() };
    const call = callOf(session);
    const asked = pushing
      ? (await callAs(session, undefined, "ask", ASK)).outcome
      : await session.call("ask", ASK);
    const result = checked("askResult", asked) as unknown as AskResultJson;
    const board = await connectBoard(result.board);
    // 21 days is over the NumberField's maximum of 20.
    board.send(act("bR2oK6eNs1vMuT5xYa0dRe", { ...RESULTS, [DAYS.id]: 21 }));
    expect(await nextOfType(board, "refused")).toMatchObject({
      reason: "act",
      itemId: question,
      detail: expect.stringContaining(DAYS.id),
    });
    const collected = checked(
      "collectResult",
      await call("collect", { asks: [{ askId, after: `${result.epoch}.0` }] }),
    );
    expect(eventsOf(collected)).toEqual([]);
    if (pushing) expect(session.mod?.record.pushes ?? []).toEqual([]);
    board.socket.terminate();
    expect(await session.end()).toBe(0);
  });
});
