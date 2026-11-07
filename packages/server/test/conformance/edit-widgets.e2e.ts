import { afterEach, describe, expect, test } from "bun:test";
import { RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import {
  EDIT_WIDGETS_SESSION,
  KANBAN_CHANGES,
  KANBAN_EDITED_PROPS,
  KANBAN_FIXTURE_ITEM,
  LATEX_CHANGES,
  LATEX_EDITED_PROPS,
  LATEX_FIXTURE_ITEM,
  latexAct,
  TIMELINE_CHANGES,
  TIMELINE_EDITED_PROPS,
  TIMELINE_FIXTURE_ITEM,
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

// The LaTeX, Kanban and Timeline's end-to-end scenario (latex-kanban-timeline, task 6.4; view-and-
// widgets spec, LaTeX, Kanban and Timeline end to end; design decision 14): the built session
// process on Bun or Node 24, driven over stdio by the MCP client, in each of AD-1's
// configurations. One question holds a LaTeX, a Kanban and a Timeline; the board's page, played
// over the real socket, answers it with an edited value for each. With the mod and the hooks the
// answer reaches the agent as the mod's push; with either off it reaches it through `collect`.
// Either way the event holds the three items' changes, valid against the output format, and
// `fetch` of each returns its props as the user left them. Run it with run.ts beside it.

console.error(`conformance: ${process.env.ASKBOARD_CONFORMANCE_RUNTIME ?? "bun"}, edit widgets`);

afterEach(async () => {
  for (const host of await cleanUp()) expect(host.record.problems).toEqual([]);
  removeShortFolders();
});

const { askId, question } = EDIT_WIDGETS_SESSION;
const ASK = {
  askId,
  title: "Review the plan",
  items: [
    {
      type: "question",
      id: question,
      props: {
        text: "Does the plan fit the SOW?",
        items: [LATEX_FIXTURE_ITEM, KANBAN_FIXTURE_ITEM, TIMELINE_FIXTURE_ITEM],
      },
    },
  ],
};
// One answer with the three edited values: the LaTeX act's, with the other two items added.
const [latexOnly] = latexAct.acts;
const act = {
  ...latexAct,
  actionId: "wQ9sX4rCb8ZyR2aDe7iFvK",
  acts: [
    {
      ...latexOnly,
      values: {
        [LATEX_FIXTURE_ITEM.id]: LATEX_EDITED_PROPS,
        [KANBAN_FIXTURE_ITEM.id]: KANBAN_EDITED_PROPS,
        [TIMELINE_FIXTURE_ITEM.id]: TIMELINE_EDITED_PROPS,
      },
    },
  ],
};
const CHANGES = [...LATEX_CHANGES, ...KANBAN_CHANGES, ...TIMELINE_CHANGES];

type Json = Record<string, unknown>;
type Event = Json & { readonly changes?: readonly Json[] };

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

/** The answer's event as it must stand: the three items' changes and no results. */
const expectAnswered = (event: Event | undefined) => {
  expect(event).toMatchObject({ type: "answer", itemId: question, rev: 1 });
  expect(event?.changes).toEqual(CHANGES);
  expect(event).not.toHaveProperty("results");
  expect(event).not.toHaveProperty("tooLarge");
};

describe(`LaTeX, Kanban and Timeline in the ${CONFIGURATION} configuration`, () => {
  test(
    CONFIGURATION === "mod-and-hooks"
      ? "one answer holding a LaTeX's, a Kanban's and a Timeline's changes is pushed by the mod, and collect and fetch agree"
      : "one answer holding a LaTeX's, a Kanban's and a Timeline's changes is collected, and fetch returns each item's props",
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
      board.send(act);
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

      // Each item alone: its props as the user left them.
      for (const [item, props] of [
        [LATEX_FIXTURE_ITEM, LATEX_EDITED_PROPS],
        [KANBAN_FIXTURE_ITEM, KANBAN_EDITED_PROPS],
        [TIMELINE_FIXTURE_ITEM, TIMELINE_EDITED_PROPS],
      ] as const) {
        const fetched = checked("fetchResult", await call("fetch", { askId, itemId: item.id }));
        expect(fetched).toMatchObject({
          state: "answered",
          item: { type: item.type, id: item.id, questionId: question, props },
        });
      }
      board.socket.terminate();
      expect(await session.end()).toBe(0);
    },
  );
});
