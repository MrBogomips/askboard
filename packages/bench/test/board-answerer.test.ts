import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startServer } from "../src/agent.ts";
import { answerBoard, type BoardRecord } from "../src/answerer/board.ts";
import { writeBrowserLauncher } from "../src/answerer/launcher.ts";
import { answerPlan, CASES, QUESTIONS } from "../src/scenarios.ts";
import { createStub, type Stub } from "./stub/stub.ts";
import { useScratch } from "./support/scratch.ts";

const scratch = useScratch();

const STUB = join(import.meta.dir, "stub", "server.ts");
const plan = answerPlan(CASES.S1);
const question = QUESTIONS[0];
if (question === undefined) throw new Error("no question");

const askRequest = (askId: string, labels?: string[]) => ({
  askId,
  items: [
    {
      type: "question",
      id: "database",
      props: {
        text: question.text,
        header: question.header,
        options: (labels ?? question.options.map((option) => option.label)).map((label) => ({
          label,
        })),
      },
    },
  ],
});

let cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups) await cleanup();
  cleanups = [];
});

const stubWithLink = async (askId: string, labels?: string[]) => {
  const links: string[] = [];
  const stub: Stub = createStub({ open: (link) => links.push(link), waitMs: 2_000 });
  cleanups.push(() => stub.shutdown());
  const result = await stub.server.call("ask", askRequest(askId, labels), undefined);
  const asked = JSON.parse(result.content[0]?.text ?? "");
  return { stub, link: links[0] ?? "", asked };
};

const collected = async (stub: Stub, asked: { askId: string; cursor: string }) => {
  const result = await stub.server.call(
    "collect",
    { asks: [{ askId: asked.askId, after: asked.cursor }] },
    undefined,
  );
  return JSON.parse(result.content[0]?.text ?? "").asks[0];
};

const ordered = (record: BoardRecord) => [
  record.started,
  record.pageLoaded,
  record.shown,
  record.answered,
  record.acknowledged,
];

describe("the board answerer", () => {
  test("answers the plan's label at the question's revision, with its times in order", async () => {
    const { stub, link, asked } = await stubWithLink("order-db-a1");
    const started = Date.now();
    const record = await answerBoard({ link, plan, started });
    expect(record).toMatchObject({
      kind: "board",
      askId: "order-db-a1",
      itemId: "database",
      rev: 1,
      choice: ["PostgreSQL"],
      matched: true,
      outcome: "answered",
    });
    const times = ordered(record) as number[];
    expect(times.every((time) => typeof time === "number")).toBe(true);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(await collected(stub, asked)).toMatchObject({
      state: "answered",
      events: [{ type: "answer", itemId: "database", rev: 1, choice: ["PostgreSQL"] }],
    });
    const text = JSON.stringify(record);
    expect(text).not.toContain(new URL(link).searchParams.get("t") ?? "missing");
    expect(text).not.toContain("/b/");
  });

  test("a question the plan does not hold gets its first option, marked unmatched", async () => {
    const { link } = await stubWithLink("other-q-b2", ["Redis", "Memcached"]);
    const record = await answerBoard({ link, plan, started: Date.now() });
    expect(record).toMatchObject({ choice: ["Redis"], matched: false, outcome: "answered" });
  });

  test("a link that is no board link is an error", async () => {
    const record = await answerBoard({ link: "http://127.0.0.1:1/x", plan, started: Date.now() });
    expect(record).toMatchObject({ outcome: "error", problem: "not a board link" });
  });

  test("a board page that is not served is an error naming the status", async () => {
    const { link } = await stubWithLink("order-db-c3");
    const wrong = link.replace(/t=[^&]+/, "t=wrongtokenwrongtokenxx");
    const record = await answerBoard({ link: wrong, plan, started: Date.now() });
    expect(record).toMatchObject({ outcome: "error", problem: "the board page answered 403" });
  });

  const fakeBoard = (messages: unknown[]) => {
    const received: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request, srv) =>
        srv.upgrade(request) ? undefined : new Response("<!doctype html>", { status: 200 }),
      websocket: {
        message: (socket, raw) => {
          received.push(String(raw));
          if (received.length === 1) {
            for (const message of messages) {
              socket.send(typeof message === "string" ? message : JSON.stringify(message));
            }
          }
        },
      },
    });
    cleanups.push(() => server.stop(true));
    return { link: `http://127.0.0.1:${server.port}/b/fake-ask-d4?t=${"x".repeat(22)}`, received };
  };

  test("a message outside the contract stops it before any answer", async () => {
    const board = fakeBoard([
      { version: "1.0", type: "board", document: { nonsense: true } },
      {
        version: "1.0",
        type: "state",
        state: { ask: "waiting", questions: [{ itemId: "q", rev: 1, state: "open" }] },
      },
    ]);
    const record = await answerBoard({
      link: board.link,
      plan,
      started: Date.now(),
      deadlineMs: 2_000,
    });
    expect(record.outcome).toBe("invalid-message");
    expect(record.problem).toBeString();
    expect(record.answered).toBeUndefined();
    expect(board.received.map((raw) => JSON.parse(raw).type)).toEqual(["connect"]);
  });

  test("a message that is not JSON stops it", async () => {
    const board = fakeBoard(["{not json"]);
    const record = await answerBoard({
      link: board.link,
      plan,
      started: Date.now(),
      deadlineMs: 2_000,
    });
    expect(record).toMatchObject({
      outcome: "invalid-message",
      problem: "a message that is not JSON",
    });
  });

  test("a question that is not open is not answered", async () => {
    const { plainChoiceBoardDocument } = await import("@askboard/contract/fixtures");
    const answered = { choice: ["SQLite"], when: "2026-10-30T10:00:00Z", receipt: "sent" };
    const board = fakeBoard([
      { version: "1.0", type: "board", document: plainChoiceBoardDocument },
      {
        version: "1.0",
        type: "state",
        state: {
          ask: "answered",
          questions: [{ itemId: "database", rev: 1, state: "answered", answer: answered }],
        },
      },
    ]);
    const record = await answerBoard({
      link: board.link,
      plan,
      started: Date.now(),
      deadlineMs: 2_000,
    });
    expect(record).toMatchObject({ outcome: "not-open" });
    expect(record.shown).toBeNumber();
    expect(board.received).toHaveLength(1);
  });

  test("a board page nobody serves is an error", async () => {
    const link = `http://127.0.0.1:1/b/nobody-g7?t=${"x".repeat(22)}`;
    const record = await answerBoard({ link, plan, started: Date.now(), deadlineMs: 500 });
    expect(record).toMatchObject({ outcome: "error", problem: "the board page did not answer" });
  });

  test("a board that never sends stops at the deadline", async () => {
    const board = fakeBoard([]);
    const record = await answerBoard({
      link: board.link,
      plan,
      started: Date.now(),
      deadlineMs: 150,
    });
    expect(record).toMatchObject({ outcome: "timeout" });
  });

  test("a refusal stops it", async () => {
    const board = fakeBoard([{ version: "1.0", type: "refused", reason: "token", detail: "no" }]);
    const record = await answerBoard({
      link: board.link,
      plan,
      started: Date.now(),
      deadlineMs: 2_000,
    });
    expect(record).toMatchObject({ outcome: "refused", problem: "token" });
  });
});

describe("the BROWSER launcher", () => {
  test("the stub opens the board through browser.sh and the answer comes back", async () => {
    const dir = scratch("bench-launcher-");
    const planPath = join(dir, "plan.json");
    const records = join(dir, "answerer.jsonl");
    writeFileSync(planPath, JSON.stringify(plan));
    const launcher = writeBrowserLauncher(dir, { plan: planPath, records });
    expect(statSync(launcher).mode & 0o111).not.toBe(0);
    const session = await startServer({
      command: process.execPath,
      args: [STUB],
      env: { PATH: process.env.PATH ?? "", BROWSER: launcher },
    });
    cleanups.push(async () => {
      await session.close();
    });
    const asked = JSON.parse((await session.call("ask", askRequest("order-db-e5"))).text);
    const result = await session.call("collect", {
      asks: [{ askId: asked.askId, after: asked.cursor }],
      wait: { askId: asked.askId, itemId: "database" },
    });
    expect(JSON.parse(result.text).asks[0].events[0]).toMatchObject({ choice: ["PostgreSQL"] });
    let lines: BoardRecord[] = [];
    for (let attempt = 0; attempt < 50 && lines.length === 0; attempt += 1) {
      await Bun.sleep(20);
      lines = readFileSync(records, { encoding: "utf8", flag: "a+" })
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    }
    expect(lines).toEqual([expect.objectContaining({ askId: "order-db-e5", outcome: "answered" })]);
    expect(readFileSync(records, "utf8")).not.toContain(
      new URL(asked.board).searchParams.get("t") ?? "x",
    );
  });
});

describe("the board answerer's entry", () => {
  test("refuses a command line without its paths and link", async () => {
    const { main } = await import("../src/answerer/board-main.ts");
    expect(await main(["--plan", "p.json"])).toBe(2);
    expect(await main(["--plan", "p.json", "--records", "r.jsonl"])).toBe(2);
  });

  test("answers and appends its record, or records the error", async () => {
    const { main } = await import("../src/answerer/board-main.ts");
    const dir = scratch("bench-main-");
    const planPath = join(dir, "plan.json");
    const records = join(dir, "answerer.jsonl");
    writeFileSync(planPath, JSON.stringify(plan));
    const { link } = await stubWithLink("order-db-f6");
    expect(await main(["--plan", planPath, "--records", records, link], 1)).toBe(0);
    expect(await main(["--plan", join(dir, "missing.json"), "--records", records, link], 2)).toBe(
      1,
    );
    const lines = readFileSync(records, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(lines).toEqual([
      expect.objectContaining({ askId: "order-db-f6", started: 1, outcome: "answered" }),
      { kind: "board", started: 2, outcome: "error", problem: "Error" },
    ]);
  });
});
