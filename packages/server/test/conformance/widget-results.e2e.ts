import { afterEach, describe, expect, test } from "bun:test";
import { RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import {
  APPROVAL_FIXTURE_ITEM,
  RANKING_FIXTURE_ITEM,
  RESULT_WIDGETS_RESULTS,
  RESULT_WIDGETS_SESSION,
  resultWidgetsAct,
  SCALE_FIXTURE_ITEMS,
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

// The result widgets' end-to-end scenario (approval-scale-ranking, task 6.4; view-and-widgets spec,
// A widget result end to end; design decision 12): the built session process on Bun or Node 24,
// driven over stdio by the MCP client, in each of AD-1's configurations. One question holds an
// Approval, a Scale and a Ranking; the board's page, played over the real socket, answers it with
// all three results and a reason. With the mod and the hooks the answer reaches the agent as the
// mod's push; with either off it reaches it through `collect`. Either way the event holds the
// three results by item ID, with the note, valid against the output format, and `fetch` of the
// Ranking alone returns its order. Run it with run.ts beside it.

console.error(`conformance: ${process.env.ASKBOARD_CONFORMANCE_RUNTIME ?? "bun"}, result widgets`);

afterEach(async () => {
  for (const host of await cleanUp()) expect(host.record.problems).toEqual([]);
  removeShortFolders();
});

const { askId, question } = RESULT_WIDGETS_SESSION;
const ASK = {
  askId,
  title: "Review the plan",
  items: [
    {
      type: "question",
      id: question,
      props: {
        text: "Does the plan fit the SOW?",
        items: [APPROVAL_FIXTURE_ITEM, SCALE_FIXTURE_ITEMS[0], RANKING_FIXTURE_ITEM],
      },
    },
  ],
};
const { note } = resultWidgetsAct.acts[0] as unknown as { note: string };

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

/** The answer's event as it must stand: the three results by item ID, the note, no edits. */
const expectAnswered = (event: Event | undefined, who?: string) => {
  expect(event).toMatchObject({ type: "answer", itemId: question, rev: 1, note });
  expect(event?.results).toEqual(RESULT_WIDGETS_RESULTS);
  expect(event).not.toHaveProperty("changes");
  expect(event).not.toHaveProperty("tooLarge");
  if (who !== undefined) expect(event?.who).toBe(who);
};

describe(`the three result widgets in the ${CONFIGURATION} configuration`, () => {
  test(
    CONFIGURATION === "mod-and-hooks"
      ? "one answer holding an Approval's, a Scale's and a Ranking's results is pushed by the mod, and collect and fetch agree"
      : "one answer holding an Approval's, a Scale's and a Ranking's results is collected, and fetch returns the Ranking's order",
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
      board.send(resultWidgetsAct);
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

      // The Ranking alone: its order is the item's `result`.
      const fetched = checked("fetchResult", await call("fetch", { askId, itemId: "priorities" }));
      expect(fetched).toMatchObject({
        state: "answered",
        item: {
          type: "ranking",
          id: "priorities",
          questionId: question,
          result: RESULT_WIDGETS_RESULTS.priorities,
        },
      });
      board.socket.terminate();
      expect(await session.end()).toBe(0);
    },
  );
});
