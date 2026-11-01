import { describe, expect, test } from "bun:test";
import type { PushMessage } from "@askboard/contract";
import { validatePushMessage } from "@askboard/contract/validate";
import { register } from "../src/index.ts";
import {
  answerAt,
  entryOf,
  MAIN_ASK,
  pollOf,
  runningSession,
  SUB_AGENT,
} from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// Turn tracking of the main conversation (task 7.3; mod spec, "Catch-up when a main turn ends",
// "After the user interrupts a turn"; design decision 7, Turn tracking; finding D6).

const DROP = "the session was stopped and nobody has sent input since";

const setUp = async () => {
  const fake = fakeModApi();
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  return { fake, hooks, api };
};

const messageOf = (text: string | undefined): PushMessage => {
  const checked = validatePushMessage(JSON.parse(text?.split("\n")[1] ?? ""));
  if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
  return checked.value;
};

/** The cursors of the events a pushed text carries. */
const cursorsOf = (text: string | undefined): string[] =>
  messageOf(text).asks.flatMap((ask) => ask.events.map((event) => event.cursor));

const submitted = (fake: ReturnType<typeof fakeModApi>) =>
  fake.calls.submit.map((args) => cursorsOf(args.text));
const appended = (fake: ReturnType<typeof fakeModApi>) =>
  fake.calls.append.map((args) => cursorsOf(args.message.content[0]?.text));

/** One poll that lists the main conversation's ask with answers up to `seq`. */
const answered = async (
  fake: ReturnType<typeof fakeModApi>,
  api: ReturnType<typeof runningSession>,
  seq: number,
) => {
  const events = Array.from({ length: seq }, (_, index) => answerAt(index + 1));
  api.answerPolls(pollOf([entryOf(MAIN_ASK, events)]));
  await fake.tick();
  await settle();
};

describe("the catch-up when a main turn ends", () => {
  test("submits an answer appended after the turn's last request, once the turn completes", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await answered(fake, api, 1);
    expect(appended(fake)).toEqual([["k3x9.1"]]);
    expect(fake.calls.submit).toEqual([]);
    await hooks.turnComplete();
    await settle();
    expect(submitted(fake)).toEqual([["k3x9.1"]]);
  });

  test("submits nothing for an answer a later request of the turn carried", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await answered(fake, api, 1);
    await hooks.turnStep({ index: 1 });
    await hooks.turnComplete();
    await settle();
    expect(fake.calls.submit).toEqual([]);
  });

  test("carries two answers appended after the last request in one submit", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await answered(fake, api, 1);
    await answered(fake, api, 2);
    expect(appended(fake)).toEqual([["k3x9.1"], ["k3x9.2"]]);
    await hooks.turnComplete();
    await settle();
    expect(submitted(fake)).toEqual([["k3x9.1", "k3x9.2"]]);
  });

  test("submits an answer appended in a turn that makes no request", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await answered(fake, api, 1);
    await hooks.turnComplete();
    await settle();
    expect(submitted(fake)).toEqual([["k3x9.1"]]);
  });

  // The review's case (task 13.1; d-esc2-312): the turn's first request was fixed at its start, so a
  // row appended before it is not in it, although that request starts after the append.
  test("submits an answer appended before the first request of a turn that makes one", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await answered(fake, api, 1);
    await hooks.turnStep({ index: 0 });
    await hooks.turnComplete();
    await settle();
    expect(submitted(fake)).toEqual([["k3x9.1"]]);
  });

  test("counts an answer appended before the turn's first request carried by its second", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await answered(fake, api, 1);
    await hooks.turnStep({ index: 0 });
    await hooks.turnStep({ index: 1 });
    await hooks.turnComplete();
    await settle();
    expect(fake.calls.submit).toEqual([]);
  });

  test("counts only the main conversation's requests", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await answered(fake, api, 1);
    await hooks.turnStep({ index: 4, agentId: SUB_AGENT });
    await hooks.turnComplete({ agentId: SUB_AGENT });
    expect(fake.calls.submit).toEqual([]);
    await hooks.turnComplete();
    await settle();
    expect(submitted(fake)).toEqual([["k3x9.1"]]);
  });

  test("counts requests, never clock times, so a clock that fails changes nothing", async () => {
    const { fake, hooks, api } = await setUp();
    (fake.api.clock as { now: () => Promise<number> }).now = async () => {
      throw new Error("no clock");
    };
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await answered(fake, api, 1);
    await hooks.turnStep({ index: 1 });
    await hooks.turnComplete();
    await settle();
    expect(fake.calls.submit).toEqual([]);
    expect(fake.calls.reached).not.toContain("clock.now");
  });

  test("submits at once an answer whose append resolved after the turn completed", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    fake.handlers.append = async () => {
      await hooks.turnComplete();
      return { uuid: "row" };
    };
    await answered(fake, api, 1);
    expect(submitted(fake)).toEqual([["k3x9.1"]]);
  });

  test("reports a caught-up answer delivered by the submit", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await answered(fake, api, 1);
    await hooks.turnComplete();
    await settle();
    expect(api.bodiesTo("/v1/mod/delivered").map((body) => (body as { via: string }).via)).toEqual([
      "append",
      "submit",
    ]);
  });
});

describe("after the user interrupts a turn", () => {
  test("appends a dropped answer when the next main turn starts", async () => {
    const { fake, hooks, api } = await setUp();
    fake.handlers.submit = async () => ({ drop: DROP });
    await answered(fake, api, 1);
    expect(appended(fake)).toEqual([]);
    fake.handlers.submit = async ({ text }) => ({ text });
    await hooks.turnStart({ text: "Did any answer reach you?" });
    expect(appended(fake)).toEqual([["k3x9.1"]]);
    expect(fake.calls.append[0]?.agentId).toBeUndefined();
    // The report goes with the next poll: the turn's start never waits for it (task 13.1).
    expect(api.bodiesTo("/v1/mod/delivered")).toEqual([]);
    await fake.tick();
    expect(api.bodiesTo("/v1/mod/delivered")).toEqual([
      { version: "1.0", askId: MAIN_ASK, cursor: "k3x9.1", via: "append" },
    ]);
  });

  test("starts the turn without waiting for a delivery report that hangs", async () => {
    const { fake, hooks, api } = await setUp();
    fake.handlers.submit = async () => ({ drop: DROP });
    await answered(fake, api, 1);
    fake.handlers.submit = async ({ text }) => ({ text });
    const answering = fake.handlers.fetch;
    let release = () => {};
    const hanging = new Promise<void>((resolve) => {
      release = resolve;
    });
    fake.handlers.fetch = async (url, init) => {
      if (url.endsWith("/v1/mod/delivered")) await hanging;
      return answering(url, init);
    };
    const started = hooks.turnStart().then(() => "started");
    expect(await Promise.race([started, Bun.sleep(200).then(() => "waiting")])).toBe("started");
    release();
  });

  test("counts it carried once the turn makes a second request", async () => {
    const { fake, hooks, api } = await setUp();
    fake.handlers.submit = async () => ({ drop: DROP });
    await answered(fake, api, 1);
    fake.handlers.submit = async ({ text }) => ({ text });
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await hooks.turnStep({ index: 1 });
    await hooks.turnComplete();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
  });

  test("submits it when the turn completes after one request", async () => {
    const { fake, hooks, api } = await setUp();
    fake.handlers.submit = async () => ({ drop: DROP });
    await answered(fake, api, 1);
    fake.handlers.submit = async ({ text }) => ({ text });
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await hooks.turnComplete();
    await settle();
    expect(submitted(fake)).toEqual([["k3x9.1"], ["k3x9.1"]]);
  });

  test("keeps a dropped catch-up for the next turn", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await answered(fake, api, 1);
    fake.handlers.submit = async () => ({ drop: DROP });
    await hooks.turnComplete({ isAborted: true });
    await settle();
    fake.handlers.submit = async ({ text }) => ({ text });
    await hooks.turnStart();
    expect(appended(fake)).toEqual([["k3x9.1"], ["k3x9.1"]]);
    await hooks.turnStep({ index: 0 });
    await hooks.turnStep({ index: 1 });
    await hooks.turnComplete();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
  });

  test("keeps a catch-up whose submit rejects for the next turn", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await answered(fake, api, 1);
    fake.handlers.submit = async () => {
      throw new Error("refused");
    };
    await hooks.turnComplete();
    await settle();
    await hooks.turnStart();
    expect(appended(fake)).toEqual([["k3x9.1"], ["k3x9.1"]]);
  });

  test("keeps a dropped answer whose append fails at the turn's start for the turn after", async () => {
    const { fake, hooks, api } = await setUp();
    fake.handlers.submit = async () => ({ drop: DROP });
    await answered(fake, api, 1);
    fake.handlers.append = async () => ({ deny: "no" });
    await hooks.turnStart();
    await hooks.turnComplete();
    await settle();
    fake.handlers.append = async () => ({ uuid: "row" });
    await hooks.turnStart();
    expect(appended(fake)).toEqual([["k3x9.1"], ["k3x9.1"]]);
    // The turn in between submitted it at its end, and that submit was dropped too.
    expect(submitted(fake)).toEqual([["k3x9.1"], ["k3x9.1"]]);
  });

  test("pushes nothing to the main conversation before the user's next input", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await hooks.turnComplete({ isAborted: true });
    fake.handlers.submit = async () => ({ drop: DROP });
    await answered(fake, api, 1);
    await answered(fake, api, 2);
    expect(fake.calls.append).toEqual([]);
    expect(api.bodiesTo("/v1/mod/delivered")).toEqual([]);
  });

  // The mod delivery spike's verify run d-esc3b-314 (2.1.314), replayed: the main conversation asks
  // and runs a sleep; Esc during the sleep; two answers while the conversation is stopped; the
  // user's next prompt makes one request; then the turn it wakes.
  test("replays d-esc3b-314: both answers reach the main conversation, in one catch-up", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart({ turnId: "ask", text: "Use AskBoard to ask me …" });
    await hooks.turnStep({ turnId: "ask", index: 0 });
    await hooks.turnStep({ turnId: "ask", index: 1 });
    // Esc during `sleep 24`: turn.complete fires on the interrupt.
    await hooks.turnComplete({ turnId: "ask", isAborted: true });
    fake.handlers.submit = async () => ({ drop: DROP });
    await answered(fake, api, 1);
    await answered(fake, api, 2);
    expect(submitted(fake)).toEqual([["k3x9.1"], ["k3x9.2"]]);
    // The user's next input: the rows appended at turn.start miss the turn's only request.
    fake.handlers.submit = async ({ text }) => ({ text });
    await hooks.turnStart({ turnId: "user", text: "Did any message with a nonce reach you?" });
    expect(appended(fake)).toEqual([["k3x9.1", "k3x9.2"]]);
    // A poll during the turn sends the append's report.
    await fake.tick();
    await hooks.turnStep({ turnId: "user", index: 0 });
    await hooks.turnComplete({ turnId: "user" });
    await settle();
    // One submit carries both answers, so one turn is woken, not one per answer.
    expect(submitted(fake)).toEqual([["k3x9.1"], ["k3x9.2"], ["k3x9.1", "k3x9.2"]]);
    await hooks.turnStart({ turnId: "woken" });
    await hooks.turnStep({ turnId: "woken", index: 0 });
    await hooks.turnComplete({ turnId: "woken" });
    await settle();
    expect(fake.calls.submit).toHaveLength(3);
    expect(fake.calls.append).toHaveLength(1);
    expect(api.bodiesTo("/v1/mod/delivered")).toEqual([
      { version: "1.0", askId: MAIN_ASK, cursor: "k3x9.2", via: "append" },
      { version: "1.0", askId: MAIN_ASK, cursor: "k3x9.2", via: "submit" },
    ]);
  });
});
