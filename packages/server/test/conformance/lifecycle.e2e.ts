import { afterEach, describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  boardPagePolicy,
  FETCH_PAGE_MAX_CHARS,
  RESULT_MAX_CHARS,
  SCHEMA_IDS,
} from "@askboard/contract";
import {
  lifecycleAsk,
  lifecycleTranscripts,
  lifecycleUpdate,
  lifecycleUpdateResult,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { act, type BoardSocket, linkParts, openBoardSocket, replay, until } from "./board-page.ts";
import { launchBrowser, openRealBoard, type RealBoard, STEP_TIMEOUT_MS } from "./real-board.ts";
import {
  bundleWith,
  cleanUp,
  GIT_USER,
  manifestOf,
  type Session,
  startSession,
  type ToolOutcome,
} from "./session.ts";

// The conformance suite's ask lifecycle (ask-lifecycle, task 7.2; design decision 7): the built
// session process on Bun or Node 24, serving the real `dist/view/`, driven over stdio by the MCP
// client. Every result is checked whole against the contract's schema, which the browser tests do
// not do. An ask with areas goes through every act of the user on the real board page in Chromium;
// E3's recorded exchanges (a submit, a stale submit, a takeover and a reload that keep the draft, a
// closed ask) are replayed by the scripted board page; `update`, `fetch` and `collect` are driven
// where they need exact timing by the scripted board page's act commands. The browser tests run the
// same board on the session process in three engines (task 7.3). Run it with run.ts beside it.

afterEach(cleanUp);

const version = BOARD_PROTOCOL_VERSION;

type Json = Record<string, unknown> & {
  readonly epoch: string;
  readonly asks: readonly (Json & { readonly events: readonly Json[] })[];
};

/** A tool result's JSON, after checking it against the contract's schema and the result limit. */
const checked = (schema: keyof typeof SCHEMA_IDS, outcome: ToolOutcome): Json => {
  expect(outcome.text).toStartWith("{");
  const validation = validateAgainst(SCHEMA_IDS[schema], outcome.json);
  expect(validation.ok ? [] : validation.problems).toEqual([]);
  expect(outcome.text.length).toBeLessThan(RESULT_MAX_CHARS);
  return outcome.json as Json;
};

const plain = (id: string, text: string, labels: readonly string[] = ["Yes", "No"]) => ({
  type: "question",
  id,
  props: { text, options: labels.map((label) => ({ label })) },
});

const now = () => new Date().toISOString();

const answer = (itemId: string, choice: readonly string[], more: object = {}) => ({
  type: "answer",
  itemId,
  rev: 1,
  choice,
  when: now(),
  ...more,
});

const collect = async (session: Session, askId: string, after: string, wait?: string) =>
  checked(
    "collectResult",
    await session.call("collect", {
      asks: [{ askId, after }],
      ...(wait === undefined ? {} : { wait: { askId, itemId: wait } }),
    }),
  );

/** Sends an ask, opens its board with the scripted board page and takes the board and state. */
const askAndConnect = async (session: Session, ask: { readonly askId: string }) => {
  const result = checked("askResult", await session.call("ask", ask)) as Json & {
    board: string;
  };
  const link = linkParts(result.board);
  const board = await openBoardSocket(link.port, ask.askId);
  board.send({ version, type: "connect", token: link.token });
  expect(await board.next()).toMatchObject({ type: "board" });
  expect(await board.next()).toMatchObject({ type: "state" });
  return { epoch: result.epoch, link, board };
};

/** A collect with a wait, started now; `settled` says whether it has returned. */
const waiting = (session: Session, askId: string, after: string, itemId: string) => {
  let settled = false;
  const result = collect(session, askId, after, itemId).finally(() => {
    settled = true;
  });
  return { result, settled: () => settled };
};

describe("E3's recorded board exchanges, on the real session process", () => {
  for (const [name, transcript] of Object.entries(lifecycleTranscripts)) {
    test(name, async () => {
      const session = await startSession();
      const asked = checked("askResult", await session.call("ask", lifecycleAsk));
      const problems = await replay(transcript, linkParts(asked.board as string), {
        collected: async () => undefined,
        exit: async () => undefined,
        update: async (request) => {
          checked("updateResult", await session.call("update", request));
        },
      });
      expect(problems).toEqual([]);
      expect(await session.end()).toBe(0);
    });
  }
});

// An ask of two areas, four questions, in immediate delivery.
const AREAS = {
  askId: "service-plan-a4r2",
  title: "Order service plan",
  items: [
    {
      type: "area",
      id: "storage",
      props: {
        title: "Storage",
        items: [
          plain("database", "Which database should the order service use?", [
            "PostgreSQL",
            "SQLite",
          ]),
          plain("cache", "Should the order service cache reads?"),
        ],
      },
    },
    {
      type: "area",
      id: "operations",
      props: {
        title: "Operations",
        items: [
          plain("audit", "Should every write be audited?"),
          plain("rollout", "How should the order service roll out?", [
            "All at once",
            "Behind a flag",
          ]),
        ],
      },
    },
  ],
};

const pressed = (board: RealBoard, itemId: string, name: string, value: boolean) =>
  board
    .card(itemId)
    .getByRole("button", { name, exact: true, pressed: value })
    .waitFor({ timeout: STEP_TIMEOUT_MS });

const sent = (board: RealBoard, itemId: string) =>
  board.card(itemId).getByText("sent", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });

/** The user's acts on the real board page, in immediate delivery, then in submitted delivery. */
const actOnTheBoard = async (board: RealBoard) => {
  await board.optionIn("database", "PostgreSQL").click();
  await board.noteIn("database").fill("Managed, in the EU.");
  await board.buttonIn("database", "Answer").click();
  await sent(board, "database");
  await board.buttonIn("cache", "Postpone").click();
  await pressed(board, "cache", "Postpone", true);
  await board.buttonIn("cache", "Postpone").click();
  await pressed(board, "cache", "Postpone", false);
  await board.noteIn("audit").fill("Compliance decides this.");
  await board.buttonIn("audit", "More").click();
  await board.menuItem("Decline").click();
  await board.optionIn("database", "SQLite").click();
  await board.buttonIn("database", "Answer").click();
  await board.barButton("Submitted").click();
  await board.optionIn("cache", "Yes").click();
  await board.buttonIn("cache", "Answer").click();
  await pressed(board, "cache", "Answer", true);
  await board.optionIn("rollout", "Behind a flag").click();
  await board.buttonIn("rollout", "Answer").click();
  await pressed(board, "rollout", "Answer", true);
  await board.barButton("Submit").click();
  await sent(board, "cache");
  await sent(board, "rollout");
};

describe("an ask with areas, end to end on the real board page", () => {
  test("answered, postponed, undone, declined, revised and submitted: collect returns each act as the contract defines it", async () => {
    const session = await startSession();
    const asked = checked("askResult", await session.call("ask", AREAS));
    const link = asked.board as string;
    expect(await session.nextOpened()).toEqual([link]);
    const at = (seq: number) => `${asked.epoch}.${seq}`;
    const browser = await launchBrowser();
    try {
      const board = await openRealBoard(browser, link);
      for (const id of ["database", "cache", "audit", "rollout"]) await board.loaded(id);
      const window = { from: Math.floor(Date.now() / 1000) * 1000, to: 0 };
      await actOnTheBoard(board);
      window.to = Date.now();

      const collected = await collect(session, AREAS.askId, at(0));
      const [ask] = collected.asks;
      const by = { who: GIT_USER, when: expect.any(String) };
      expect<unknown>(ask).toEqual({
        askId: AREAS.askId,
        state: "answered",
        cursor: at(7),
        unchecked: true,
        events: [
          {
            cursor: at(1),
            type: "answer",
            itemId: "database",
            rev: 1,
            ...by,
            choice: ["PostgreSQL"],
            note: "Managed, in the EU.",
          },
          { cursor: at(2), type: "postponed", itemId: "cache", rev: 1 },
          { cursor: at(3), type: "reopened", itemId: "cache", rev: 1 },
          {
            cursor: at(4),
            type: "answer",
            itemId: "audit",
            rev: 1,
            ...by,
            declined: true,
            note: "Compliance decides this.",
          },
          {
            cursor: at(5),
            type: "answer",
            itemId: "database",
            rev: 1,
            ...by,
            choice: ["SQLite"],
            note: "Managed, in the EU.",
            replaces: at(1),
          },
          { cursor: at(6), type: "answer", itemId: "cache", rev: 1, ...by, choice: ["Yes"] },
          {
            cursor: at(7),
            type: "answer",
            itemId: "rollout",
            rev: 1,
            ...by,
            choice: ["Behind a flag"],
          },
        ],
      });
      for (const event of ask?.events ?? []) {
        if (event.when === undefined) continue;
        expect(Date.parse(event.when as string)).toBeGreaterThanOrEqual(window.from);
        expect(Date.parse(event.when as string)).toBeLessThanOrEqual(window.to);
      }

      // The revision is the question's answer now, in full.
      const fetched = checked(
        "fetchResult",
        await session.call("fetch", { askId: AREAS.askId, itemId: "database" }),
      );
      expect(fetched).toMatchObject({
        state: "answered",
        item: { id: "database", rev: 1, state: "answered", answer: { cursor: at(5) } },
      });
      for (const id of ["database", "audit", "cache", "rollout"]) {
        await board
          .card(id)
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      }
      expect(board.errors).toEqual([]);
    } finally {
      await browser.close();
    }
    expect(await session.end()).toBe(0);
  });
});

/** `lifecycleUpdate` with its reply naming the follow-up this session logged. */
const updateOf = (followUp: string) => ({
  ...lifecycleUpdate,
  actions: lifecycleUpdate.actions.map((action) =>
    action.action === "reply" ? { ...action, followUp } : action,
  ),
});

/** The board messages received until `closed`, the board document and the last state among them. */
const untilClosed = async (board: BoardSocket) => {
  const seen: Record<string, unknown>[] = [];
  await until(board, "closed", (message) => {
    seen.push(message);
    return message.type === "closed";
  });
  const last = (type: string) => seen.filter((message) => message.type === type).at(-1);
  return { seen, document: last("board")?.document, state: last("state")?.state };
};

const idsOf = (document: unknown): string[] =>
  (document as { items: { id: string; rev?: number; props: { items?: unknown[] } }[] }).items
    .flatMap((item) => [item, ...((item.props.items ?? []) as { id: string; rev?: number }[])])
    .map(({ id, rev }) => (rev === undefined ? id : `${id}@${rev}`));

describe("update with every action", () => {
  test("add, change, delete, reopen, answer recorded, reply and close, all or none: the result, the board and no event for the agent's own change", async () => {
    const session = await startSession();
    const { askId } = lifecycleAsk;
    const { epoch, board } = await askAndConnect(session, lifecycleAsk);
    const at = (seq: number) => `${epoch}.${seq}`;
    await act(board, [
      answer("region", ["EU", "US"], { optionNotes: { US: "East coast only, at first." } }),
      { type: "answer", itemId: "payment", rev: 1, other: "Mollie", when: now() },
      { type: "postpone", itemId: "erp-export", rev: 1 },
    ]);
    await act(board, [
      { type: "follow-up", itemId: "rollout", rev: 1, text: "Why behind a flag?", when: now() },
    ]);

    // A refused update names its action and the answer in the way, and changes nothing.
    const refused = await session.call("update", {
      askId,
      actions: [
        { action: "delete", itemId: "analytics" },
        { action: "change", itemId: "region", props: { text: "Which regions first?" } },
      ],
    });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("actions[1]");
    expect(refused.text).toContain(at(1));

    const updated = checked("updateResult", await session.call("update", updateOf(at(4))));
    // The recorded answer takes the ask's expected user as `who`, as answers from the board do (FR-19).
    const recorded = { who: lifecycleAsk.expectedUser, when: expect.any(String) };
    expect<unknown>(updated).toEqual({
      ...lifecycleUpdateResult,
      epoch,
      applied: lifecycleUpdateResult.applied.map((applied) =>
        applied.recorded === undefined ? applied : { ...applied, recorded },
      ),
    });

    // The board gets the new document and state, then the close.
    const { document, state } = await untilClosed(board);
    expect(idsOf(document)).toEqual([
      "scope",
      "region@2",
      "payment@1",
      "delivery",
      "rollout@2",
      "erp-export@1",
      "launch@1",
    ]);
    const questions = (state as { questions: { itemId: string }[] }).questions;
    const of = (id: string) => questions.find((question) => question.itemId === id);
    expect(of("erp-export")).toMatchObject({
      state: "answered",
      answer: { choice: ["Yes"], note: "Sara confirmed it in the terminal.", recorded: true },
    });
    expect(of("region")).toMatchObject({
      rev: 2,
      state: "open",
      previous: { choice: ["EU", "US"] },
    });
    expect(of("rollout")).toMatchObject({
      rev: 2,
      thread: [
        {
          cursor: at(4),
          who: lifecycleAsk.expectedUser,
          text: "Why behind a flag?",
          replies: [{ text: "A flag lets us switch back within a minute if payments fail." }],
        },
      ],
    });

    // The agent's own changes are in its result: the log gained nothing.
    const collected = await collect(session, askId, at(0));
    expect(collected.asks[0]).toMatchObject({ state: "closed", cursor: at(4) });
    expect(collected.asks[0]?.events.map((event) => event.type)).toEqual([
      "answer",
      "answer",
      "postponed",
      "follow-up",
    ]);
    const region = checked("fetchResult", await session.call("fetch", { askId, itemId: "region" }));
    expect(region).toMatchObject({
      state: "closed",
      item: { rev: 2, state: "open", previous: { cursor: at(1), choice: ["EU", "US"] } },
    });
    expect((region.item as Record<string, unknown>).answer).toBeUndefined();
    const deleted = await session.call("fetch", { askId, itemId: "analytics" });
    expect(deleted.isError).toBe(true);
    expect(deleted.text).toContain("deleted");
    const again = checked("updateOutcome", await session.call("update", updateOf(at(4))));
    expect<unknown>(again).toEqual({ versions: updated.versions, epoch, askId, outcome: "closed" });
    expect(await session.end()).toBe(0);
  });
});

describe("a closed ask's link", () => {
  test("opens its board locked, with the Closed banner; waits end at once and acts are refused", async () => {
    const session = await startSession();
    const askId = "closed-plan-c7k1";
    const ask = {
      askId,
      items: [
        plain("queue", "Should orders go through a queue?"),
        plain("retry", "Should failed payments be retried?"),
      ],
    };
    const asked = checked("askResult", await session.call("ask", ask));
    const link = asked.board as string;
    const closed = checked(
      "updateResult",
      await session.call("update", { askId, actions: [{ action: "close" }] }),
    );
    expect(closed).toMatchObject({ state: "closed", applied: [{ action: "close" }] });

    const page = await fetch(link);
    expect(page.status).toBe(BOARD_RESPONSES.boardPage.status);
    expect(page.headers.get("content-security-policy")).toBe(
      boardPagePolicy(manifestOf(bundleWith())),
    );
    const started = Date.now();
    const waited = await collect(session, askId, `${asked.epoch}.0`, "queue");
    expect(waited).toMatchObject({ outcome: "closed", asks: [{ state: "closed", events: [] }] });
    expect(Date.now() - started).toBeLessThan(2_000);

    const browser = await launchBrowser();
    try {
      const board = await openRealBoard(browser, link);
      for (const id of ["queue", "retry"]) await board.loaded(id);
      await board.banner(/closed/i);
      await board.header.getByText("Closed", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
      for (const radio of await board.page
        .frameLocator('iframe[sandbox="allow-scripts"]')
        .locator("[data-askboard-question]")
        .getByRole("radio")
        .all())
        expect(await radio.isDisabled()).toBe(true);
      expect(board.received).toContainEqual({ version, type: "closed", reason: "agent" });
      expect(board.errors).toEqual([]);
    } finally {
      await browser.close();
    }

    const { port, token } = linkParts(link);
    const socket = await openBoardSocket(port, askId);
    socket.send({ version, type: "connect", token });
    expect(await socket.next()).toMatchObject({ type: "board" });
    expect(await socket.next()).toMatchObject({ type: "state", state: { ask: "closed" } });
    expect(await socket.next()).toEqual({ version, type: "closed", reason: "agent" });
    await expect(act(socket, [answer("queue", ["Yes"])])).rejects.toThrow('"reason":"closed"');
    expect((await collect(session, askId, `${asked.epoch}.0`)).asks[0]?.events).toEqual([]);
    expect(await session.end()).toBe(0);
  });
});

// A question whose full value takes two fetch pages: three options with long previews, with
// characters outside the Basic Multilingual Plane, which a page never cuts in half.
const preview = (label: string) => `${label}: ${"Clause 🙂 é ".repeat(740)}`;
const LONG = {
  askId: "vendor-contract-v5n1",
  items: [
    {
      type: "question",
      id: "vendor",
      props: {
        text: "Which vendor's contract should we sign?",
        options: ["Acme", "Globex", "Initech"].map((label) => ({ label, preview: preview(label) })),
      },
    },
  ],
};

const fetchAll = async (session: Session, itemId: string) => {
  const parts: string[] = [];
  const continuations: string[] = [];
  let continuation: string | undefined;
  do {
    const page = checked(
      "fetchPage",
      await session.call("fetch", {
        askId: LONG.askId,
        itemId,
        ...(continuation === undefined ? {} : { continuation }),
      }),
    );
    const part = page.part as string;
    expect(part.isWellFormed()).toBe(true);
    expect(part.length).toBeLessThanOrEqual(FETCH_PAGE_MAX_CHARS);
    parts.push(part);
    continuation = page.continuation as string | undefined;
    if (continuation !== undefined) continuations.push(continuation);
  } while (continuation !== undefined);
  return { value: JSON.parse(parts.join("")), pages: parts.length, continuations };
};

describe("fetch", () => {
  test("pages an item that does not fit one result, and refuses a continuation once the item changed", async () => {
    const session = await startSession();
    const { epoch, board } = await askAndConnect(session, LONG);
    const first = await fetchAll(session, "vendor");
    expect(first.pages).toBe(2);
    expect(first.value).toEqual({ ...LONG.items[0], rev: 1, state: "open" });

    // The user answers: the value changes, and the continuation names the old one.
    await act(board, [answer("vendor", ["Globex"])]);
    const stale = await session.call("fetch", {
      askId: LONG.askId,
      itemId: "vendor",
      continuation: first.continuations[0],
    });
    expect(stale.isError).toBe(true);
    expect(stale.text).toContain("changed since that continuation");
    const second = await fetchAll(session, "vendor");
    expect(second.value).toMatchObject({
      state: "answered",
      answer: { cursor: `${epoch}.1`, choice: ["Globex"], who: GIT_USER },
    });

    // fetch raises no `received`: the board hears of delivery only once collect returns it.
    await Bun.sleep(200);
    expect(JSON.stringify(board.pending)).not.toContain("delivered");
    await collect(session, LONG.askId, `${epoch}.0`);
    await until(board, "the delivery", (message) => JSON.stringify(message).includes("delivered"));
    expect(await session.end()).toBe(0);
  });
});

describe("collect", () => {
  const PAGED = {
    askId: "release-notes-r8w3",
    items: ["intro", "fixes", "features", "credits"].map((id) =>
      plain(id, `Should the release notes have a ${id} section?`),
    ),
  };
  const note = (id: string) => `${id}: ${"x".repeat(9_000)}`;

  test("pages around a submit, never splitting it", async () => {
    const session = await startSession();
    const { askId } = PAGED;
    const { epoch, board } = await askAndConnect(session, PAGED);
    const at = (seq: number) => `${epoch}.${seq}`;
    await act(board, [answer("intro", ["Yes"], { note: note("intro") })]);
    await act(
      board,
      ["fixes", "features", "credits"].map((id) => answer(id, ["Yes"], { note: note(id) })),
    );
    const first = await collect(session, askId, at(0));
    expect(first.more).toBe(true);
    expect(first.asks[0]).toMatchObject({ state: "answered", cursor: at(1) });
    expect(first.asks[0]?.events.map((event) => event.itemId)).toEqual(["intro"]);
    const second = await collect(session, askId, at(1));
    expect(second.more).toBeUndefined();
    expect(second.asks[0]).toMatchObject({ state: "answered", cursor: at(4) });
    expect(second.asks[0]?.events.map((event) => event.itemId)).toEqual([
      "fixes",
      "features",
      "credits",
    ]);
    // A pager that split commands would have put two of the submit's answers on the first page.
    const firstThree = [first, second].flatMap((result) => result.asks[0]?.events ?? []);
    const splitPage = { ...first, asks: [{ ...first.asks[0], events: firstThree.slice(0, 3) }] };
    expect(JSON.stringify(splitPage).length).toBeLessThan(RESULT_MAX_CHARS);
    expect(await session.end()).toBe(0);
  });

  test("a wait ends on another question's answer that changes the ask's state, on a follow-up, and at once on a postponed question (AD-4)", async () => {
    const session = await startSession();
    const askId = "migration-plan-m3q9";
    const ask = {
      askId,
      items: [
        plain("schema", "Should the migration change the schema first?"),
        plain("index", "Should the new index be built online?"),
        plain("backfill", "Should the backfill run at night?"),
      ],
    };
    const { epoch, board } = await askAndConnect(session, ask);
    const at = (seq: number) => `${epoch}.${seq}`;

    // Waiting ask, waiting on backfill: an answer to schema makes it partly answered.
    const one = waiting(session, askId, at(0), "backfill");
    await Bun.sleep(300);
    expect(one.settled()).toBe(false);
    await act(board, [answer("schema", ["Yes"])]);
    expect(await one.result).toMatchObject({
      asks: [{ state: "partly-answered", cursor: at(1), events: [{ itemId: "schema" }] }],
    });
    expect((await one.result).outcome).toBeUndefined();

    // Still partly answered after index's answer: the wait goes on until backfill's follow-up.
    const two = waiting(session, askId, at(1), "backfill");
    await Bun.sleep(300);
    await act(board, [answer("index", ["No"])]);
    await Bun.sleep(300);
    expect(two.settled()).toBe(false);
    await act(board, [
      {
        type: "follow-up",
        itemId: "backfill",
        rev: 1,
        text: "How long is the night window?",
        when: now(),
      },
    ]);
    expect(await two.result).toMatchObject({
      asks: [
        {
          state: "partly-answered",
          cursor: at(3),
          events: [
            { type: "answer", itemId: "index" },
            { type: "follow-up", itemId: "backfill", who: GIT_USER },
          ],
        },
      ],
    });

    // A postponed question ends a wait at once, saying so.
    await act(board, [{ type: "postpone", itemId: "backfill", rev: 1 }]);
    await collect(session, askId, at(3));
    const started = Date.now();
    const three = await collect(session, askId, at(4), "backfill");
    expect(three).toMatchObject({ outcome: "postponed", asks: [{ events: [] }] });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(await session.end()).toBe(0);
  });
});
