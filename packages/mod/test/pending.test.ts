import { describe, expect, test } from "bun:test";
import { NOTICE_TEXT_MAX_CHARS, type PendingAsk } from "@askboard/contract";
import { register } from "../src/index.ts";
import {
  answerAt,
  entryOf,
  folderOf,
  MAIN_ASK,
  pendingOf,
  pollOf,
  runningSession,
  SUB_AGENT,
  SUB_ASK,
} from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// The pending asks (task 7.4; mod spec, "A subagent's board link", "Pending-asks list"; design
// decision 7, Pending asks): one status entry with a line per pending ask, and a toast for each new
// ask a subagent owns.

const setUp = async () => {
  const fake = fakeModApi();
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  return { fake, hooks, api };
};

const LINK = (askId: string) => `http://127.0.0.1:47213/b/${askId}?t=pV3xK9qLmT2wR7nB4cYh8A`;

const main = pendingOf(MAIN_ASK, { title: "Which database?", openQuestions: 2 });
const subagent: PendingAsk = pendingOf(SUB_ASK, {
  title: "Which retry policy?",
  label: "Subagent code-reviewer",
  agentName: "Retry review",
  agent_id: SUB_AGENT,
});

/** A line's text before its link, which ends it whole after a separator. */
const textBefore = (line: string, link: string): string => {
  expect(line).toEndWith(` · ${link}`);
  return line.slice(0, -` · ${link}`.length);
};

const pollWith = async (
  fake: ReturnType<typeof fakeModApi>,
  api: ReturnType<typeof runningSession>,
  pending: readonly PendingAsk[],
) => {
  api.answerPolls(pollOf([], pending));
  await fake.tick();
};

describe("the status entry", () => {
  test("lists each pending ask on a line: title, who asked, questions open, link", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [main, subagent]);
    expect(fake.calls.status).toEqual([
      [
        `Which database? · Main agent · 2 open · ${LINK(MAIN_ASK)}`,
        `Which retry policy? · Subagent code-reviewer · Retry review · 1 open · ${LINK(SUB_ASK)}`,
      ].join("\n"),
    ]);
  });

  test("is set only when its text changes", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [main]);
    await pollWith(fake, api, [main]);
    await pollWith(fake, api, [main, subagent]);
    await pollWith(fake, api, [main, subagent]);
    expect(fake.calls.status).toHaveLength(2);
  });

  test("changes when an ask is answered, closed or discarded, and clears with the last", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [main, subagent]);
    await pollWith(fake, api, [{ ...main, openQuestions: 1 }, subagent]);
    await pollWith(fake, api, [subagent]);
    await pollWith(fake, api, []);
    await pollWith(fake, api, []);
    expect(fake.calls.status.slice(1)).toEqual([
      [
        `Which database? · Main agent · 1 open · ${LINK(MAIN_ASK)}`,
        `Which retry policy? · Subagent code-reviewer · Retry review · 1 open · ${LINK(SUB_ASK)}`,
      ].join("\n"),
      `Which retry policy? · Subagent code-reviewer · Retry review · 1 open · ${LINK(SUB_ASK)}`,
      undefined,
    ]);
  });

  test("sets nothing while no ask has been pending", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, []);
    expect(fake.calls.status).toEqual([]);
  });

  test("is updated with the poll that pushes", async () => {
    const { fake, api } = await setUp();
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])], [subagent]));
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
    expect(fake.calls.status).toHaveLength(1);
  });

  test("clears when the session file is gone", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [main]);
    fake.files.clear();
    await fake.tick();
    await fake.tick();
    expect(fake.calls.status).toEqual([expect.any(String), undefined]);
  });

  test("stays as it is when a poll gets no answer", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [main]);
    api.unreachable.add("/v1/mod/poll");
    await fake.tick();
    expect(fake.calls.status).toHaveLength(1);
    expect(folderOf(fake)).toBeString();
  });

  test("cuts a long title so the line's text keeps to the notice limit, the link whole", async () => {
    const { fake, api } = await setUp();
    const long = { ...subagent, title: `Retry ${"policy ".repeat(18)}?` };
    await pollWith(fake, api, [long]);
    const [line = ""] = fake.calls.status;
    const text = textBefore(line, LINK(SUB_ASK));
    expect(Array.from(text)).toHaveLength(NOTICE_TEXT_MAX_CHARS);
    expect(text).toStartWith("Retry policy policy");
    expect(text).toEndWith("… · Subagent code-reviewer · Retry review · 1 open");
  });

  test("cuts the whole text when who asked leaves the title too little room", async () => {
    const { fake, api } = await setUp();
    const named = { ...subagent, agentName: "n".repeat(90) };
    await pollWith(fake, api, [named]);
    const [line = ""] = fake.calls.status;
    const text = textBefore(line, LINK(SUB_ASK));
    expect(Array.from(text)).toHaveLength(NOTICE_TEXT_MAX_CHARS);
    expect(text).toStartWith("Which retry policy? · Subagent code-reviewer · nnn");
    expect(text).toEndWith("n…");
  });

  test("shows the agent's controls as escapes", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [{ ...subagent, title: "Pick‮ one\n", agentName: "Re\u001bview" }]);
    expect(fake.calls.status[0]).toStartWith(
      "Pick\\u202E one\\u000A · Subagent code-reviewer · Re\\u001Bview · 1 open",
    );
  });
});

describe("the toast", () => {
  test("shows each new ask of a subagent once, with its title and link", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [main, subagent]);
    await pollWith(fake, api, [main, subagent]);
    expect(fake.calls.toast).toEqual([`AskBoard · Which retry policy? · ${LINK(SUB_ASK)}`]);
    const second = pendingOf("log-level-p4r1", {
      label: "Subagent general-purpose",
      agent_id: "b7",
    });
    await pollWith(fake, api, [main, subagent, second]);
    expect(fake.calls.toast).toHaveLength(2);
    expect(fake.calls.toast[1]).toBe(
      `AskBoard · Which database should the orders service use? · ${LINK("log-level-p4r1")}`,
    );
  });

  test("shows none for the main conversation's asks, which the terminal link shows", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [main]);
    expect(fake.calls.toast).toEqual([]);
  });

  test("cuts a long title and keeps the link whole", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [{ ...subagent, title: "t".repeat(150) }]);
    const [toast = ""] = fake.calls.toast;
    const text = textBefore(toast, LINK(SUB_ASK));
    expect(Array.from(text)).toHaveLength(NOTICE_TEXT_MAX_CHARS);
    expect(text).toStartWith("AskBoard · ttt");
    expect(text).toEndWith("t…");
  });

  test("shows an ask of a new epoch again", async () => {
    const { fake, api } = await setUp();
    await pollWith(fake, api, [subagent]);
    const next = runningSession(fake, { epoch: "m7q2", pid: 48299 });
    next.answerPolls(pollOf([], [subagent], { epoch: "m7q2" }));
    await fake.tick();
    expect(fake.calls.toast).toHaveLength(2);
    expect(api.paths()).toContain("GET /v1/mod/poll");
  });
});
