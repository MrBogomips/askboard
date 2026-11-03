import { describe, expect, test } from "bun:test";
import { NOTICE_TEXT_MAX_CHARS, type PendingAsk } from "@askboard/contract";
import { register } from "../src/index.ts";
import type { RenderElement } from "../src/mod-api.ts";
import { BENEATH_ROW, drawnOf } from "./fake-band.ts";
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

// The pending asks (tasks 7.4 and 15.1; mod spec, "A subagent's board link", "Pending-asks list";
// design decision 7, Pending asks): a band above the prompt with a row per pending ask, a status
// entry of one line only while a surface without the band is attached, and a toast for each new ask
// a subagent owns.

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

describe("the band above the prompt", () => {
  const MAIN_ROW = `Which database? · Main agent · 2 open · ${LINK(MAIN_ASK)}`;
  const SUB_ROW = `Which retry policy? · Subagent code-reviewer · Retry review · 1 open · ${LINK(SUB_ASK)}`;

  test("draws a header and a row per pending ask: title, who asked, questions open, link", async () => {
    const { fake, hooks, api } = await setUp();
    await pollWith(fake, api, [main, subagent]);
    expect(await hooks.drawBand()).toEqual([
      "AskBoard · 2 pending",
      MAIN_ROW,
      SUB_ROW,
      BENEATH_ROW,
    ]);
  });

  test("passes to the plugins beneath while no ask is pending", async () => {
    const { fake, hooks, api } = await setUp();
    expect(await hooks.drawBand()).toBeUndefined();
    await pollWith(fake, api, []);
    expect(await hooks.drawBand()).toBeUndefined();
    expect(fake.calls.invalidate).toEqual([]);
  });

  test("passes while a survey holds the band", async () => {
    const { fake, hooks, api } = await setUp();
    await pollWith(fake, api, [main]);
    expect(await hooks.drawBand({ hasSurvey: true })).toBeUndefined();
  });

  test("is redrawn only when the list changes, an answer included, and passes once it is empty", async () => {
    const { fake, hooks, api } = await setUp();
    const drawn: (string[] | undefined)[] = [];
    for (const pending of [
      [main, subagent],
      [main, subagent],
      [{ ...main, openQuestions: 1 }, subagent],
      [subagent],
      [],
      [],
    ]) {
      await pollWith(fake, api, pending);
      drawn.push(await hooks.drawBand());
    }
    expect(fake.calls.invalidate).toEqual(Array(4).fill("ui.render"));
    expect(drawn.slice(2)).toEqual([
      ["AskBoard · 2 pending", MAIN_ROW.replace("2 open", "1 open"), SUB_ROW, BENEATH_ROW],
      ["AskBoard · 1 pending", SUB_ROW, BENEATH_ROW],
      undefined,
      undefined,
    ]);
  });

  test("is redrawn with the poll that pushes", async () => {
    const { fake, api } = await setUp();
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])], [subagent]));
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
    expect(fake.calls.invalidate).toHaveLength(1);
  });

  test("passes once the session file is gone", async () => {
    const { fake, hooks, api } = await setUp();
    await pollWith(fake, api, [main]);
    fake.files.clear();
    await fake.tick();
    await fake.tick();
    expect(fake.calls.invalidate).toHaveLength(2);
    expect(await hooks.drawBand()).toBeUndefined();
  });

  test("stays as it is when a poll gets no answer", async () => {
    const { fake, hooks, api } = await setUp();
    await pollWith(fake, api, [main]);
    api.unreachable.add("/v1/mod/poll");
    await fake.tick();
    expect(fake.calls.invalidate).toHaveLength(1);
    expect(await hooks.drawBand()).toEqual(["AskBoard · 1 pending", MAIN_ROW, BENEATH_ROW]);
    expect(folderOf(fake)).toBeString();
  });

  test("fits a row to the band's width: the title cut first, the link whole", async () => {
    const { fake, hooks, api } = await setUp();
    const long = { ...subagent, title: `Retry ${"policy ".repeat(18)}?` };
    await pollWith(fake, api, [long]);
    const [, row = ""] = (await hooks.drawBand({ bodyColumns: 160 })) ?? [];
    expect(Array.from(row)).toHaveLength(160);
    const text = textBefore(row, LINK(SUB_ASK));
    expect(text).toStartWith("Retry policy policy");
    expect(text).toEndWith("… · Subagent code-reviewer · Retry review · 1 open");
  });

  test("cuts the whole text when who asked leaves the title too little room", async () => {
    const { fake, hooks, api } = await setUp();
    await pollWith(fake, api, [subagent]);
    const [, row = ""] = (await hooks.drawBand({ bodyColumns: 120 })) ?? [];
    expect(Array.from(row)).toHaveLength(120);
    expect(textBefore(row, LINK(SUB_ASK))).toStartWith("Which retry policy? · Subagent code");
    expect(textBefore(row, LINK(SUB_ASK))).toEndWith("…");
  });

  test("draws the title alone as the link where the band leaves the title too little room", async () => {
    const { fake, hooks, api } = await setUp();
    const long = { ...subagent, title: "t".repeat(150) };
    await pollWith(fake, api, [subagent, long]);
    const rows = (await hooks.drawBand({ bodyColumns: 80 })) ?? [];
    expect(rows.slice(1, 3)).toEqual([
      `[Which retry policy?](${LINK(SUB_ASK)})`,
      `[${"t".repeat(79)}…](${LINK(SUB_ASK)})`,
    ]);
  });

  test("keeps the text before the link to the notice limit on a wide band", async () => {
    const { fake, hooks, api } = await setUp();
    const long = { ...subagent, title: `Retry ${"policy ".repeat(18)}?` };
    await pollWith(fake, api, [long]);
    const [, row = ""] = (await hooks.drawBand({ bodyColumns: 1000 })) ?? [];
    const text = textBefore(row, LINK(SUB_ASK));
    expect(Array.from(text)).toHaveLength(NOTICE_TEXT_MAX_CHARS);
    expect(text).toEndWith("… · Subagent code-reviewer · Retry review · 1 open");
  });

  test("shows the agent's controls as escapes", async () => {
    const { fake, hooks, api } = await setUp();
    await pollWith(fake, api, [{ ...subagent, title: "Pick‮ one\n", agentName: "Re\u001bview" }]);
    const [, row = ""] = (await hooks.drawBand()) ?? [];
    expect(row).toStartWith(
      "Pick\\u202E one\\u000A · Subagent code-reviewer · Re\\u001Bview · 1 open",
    );
  });

  test("draws its header dim, and each ask's link as a link", async () => {
    const { fake, hooks, api } = await setUp();
    await pollWith(fake, api, [main]);
    expect(await hooks.drawBand({}, "desktop")).toEqual([
      "AskBoard · 1 pending",
      MAIN_ROW,
      BENEATH_ROW,
    ]);
    const tree = hooks.lastBand();
    const [header, row] = (drawnOf(tree).props.children ?? []) as RenderElement[];
    expect(drawnOf(header as RenderElement)).toMatchObject({
      type: "Text",
      props: { dimColor: true },
    });
    const [, link] = (drawnOf(row as RenderElement).props.children ?? []) as RenderElement[];
    expect(drawnOf(link as RenderElement)).toEqual({
      type: "Link",
      props: { href: LINK(MAIN_ASK) },
    });
  });
});

describe("the status entry, where a surface draws no band", () => {
  test("is never set while every surface draws the band", async () => {
    const { fake, api } = await setUp();
    fake.handlers.surfaces = async () => ["terminal", "desktop"];
    await pollWith(fake, api, [main, subagent]);
    expect(fake.calls.status).toEqual([]);
  });

  test("shows the first ask's line and how many more while one is attached, one line", async () => {
    const { fake, api } = await setUp();
    fake.handlers.surfaces = async () => ["terminal", "vscode"];
    await pollWith(fake, api, [main, subagent]);
    await pollWith(fake, api, [main, subagent]);
    await pollWith(fake, api, [subagent]);
    await pollWith(fake, api, []);
    expect(fake.calls.status).toEqual([
      `Which database? · Main agent · 2 open · ${LINK(MAIN_ASK)} · +1 more`,
      `Which retry policy? · Subagent code-reviewer · Retry review · 1 open · ${LINK(SUB_ASK)}`,
      undefined,
    ]);
  });

  test("clears when that surface leaves, and when the session file is gone", async () => {
    const { fake, api } = await setUp();
    fake.handlers.surfaces = async () => ["mobile"];
    await pollWith(fake, api, [main]);
    fake.handlers.surfaces = async () => ["terminal"];
    await pollWith(fake, api, [main]);
    fake.handlers.surfaces = async () => ["mobile"];
    await pollWith(fake, api, [main]);
    fake.files.clear();
    await fake.tick();
    expect(fake.calls.status).toEqual([
      expect.any(String),
      undefined,
      expect.any(String),
      undefined,
    ]);
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
