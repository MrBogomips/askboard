import { describe, expect, test } from "bun:test";
import { answer, askWith, plainChoiceAsk } from "./fakes.ts";
import { answerAct, command, FLAT_ID, flatAsk } from "./lifecycle-fakes.ts";
import { callOf, MAIN_ORIGIN, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// The epoch's asks as the local API reads them for the mod's poll, the pending-asks list and the
// terminal link (board-host spec: Events for the mod, Pending asks; design decision 2; task 4.5).

const ASK_ID = "order-db-choice-x7k2";
const OTHER_ID = "cache-choice-b5n1";
const LINK = (askId: string) => `http://127.0.0.1:47213/b/${askId}?t=pV3xK9qLmT2wR7nB4cYh8A`;

const owned = async (fixture: ReturnType<typeof pushCoreWith>, askId: string, ownerKey: string) => {
  fixture.table.add({ ownerKey, tool: "ask", askIds: [askId], origin: REVIEWER_ORIGIN });
  return fixture.core.ask(askWith({ askId, agentName: "Retry review" }), callOf("ask", askId));
};

describe("the overview of the epoch's asks", () => {
  test("is empty before the first ask", () => {
    expect(pushCoreWith().core.overview()).toEqual([]);
  });

  test("gives an unchecked ask with no owner, its title, link and one open question", async () => {
    const { core } = pushCoreWith();
    await core.ask(plainChoiceAsk());
    expect(core.overview()).toEqual([
      {
        askId: ASK_ID,
        state: "waiting",
        title: "Which database should the order service use?",
        link: LINK(ASK_ID),
        cursor: `${core.epoch}.0`,
        unreceived: [],
        groups: [],
        openQuestions: 1,
      },
    ]);
  });

  test("gives an owned ask's owner and origin, and the agent's name the request gave", async () => {
    const fixture = pushCoreWith();
    await owned(fixture, ASK_ID, "reviewer-1");
    const [ask] = fixture.core.overview();
    expect(ask?.owner).toEqual({ ownerKey: "reviewer-1", origin: REVIEWER_ORIGIN });
    expect(ask?.agentName).toBe("Retry review");
  });

  test("an answer the agent has not received is above received and keeps its question open", async () => {
    const fixture = pushCoreWith();
    await owned(fixture, ASK_ID, "reviewer-1");
    const appended = fixture.core.answer(ASK_ID, answer());
    const [ask] = fixture.core.overview();
    expect(ask).toMatchObject({ state: "answered", cursor: `${fixture.core.epoch}.1` });
    if (!appended.ok) throw new Error(appended.detail);
    expect(ask?.unreceived).toEqual([appended.event]);
    expect(ask?.openQuestions).toBe(1);
  });

  test("once received, the answer leaves the events and the open count", async () => {
    const fixture = pushCoreWith();
    await owned(fixture, ASK_ID, "reviewer-1");
    fixture.core.answer(ASK_ID, answer());
    fixture.core.delivered(ASK_ID, `${fixture.core.epoch}.1`);
    expect(fixture.core.overview()[0]).toMatchObject({ unreceived: [], openQuestions: 0 });
  });

  // AD-20: the local API pages cut only between board commands, so each event carries its group.
  test("gives each event above received its command's group, which one command's events share", async () => {
    const { core } = pushCoreWith();
    await core.ask(flatAsk());
    core.act(FLAT_ID, command([answerAct(), answerAct({ itemId: "q2", choice: ["Linux"] })]));
    core.act(FLAT_ID, command([answerAct({ itemId: "q3", choice: ["Sara"] })]));
    const [ask] = core.overview();
    expect(ask?.unreceived.map((event) => event.cursor)).toEqual(
      [1, 2, 3].map((seq) => `${core.epoch}.${seq}`),
    );
    const [first, second, third] = ask?.groups ?? [];
    expect(ask?.groups).toHaveLength(3);
    expect(second).toBe(first as number);
    expect(third).not.toBe(first as number);
    expect(Object.isFrozen(ask?.groups)).toBe(true);
  });

  test("a discarded ask carries its discard event above received", async () => {
    const { core } = pushCoreWith();
    await core.ask(plainChoiceAsk());
    core.discardAll("session-exit");
    expect(core.overview()[0]).toMatchObject({
      state: "discarded",
      unreceived: [{ type: "discarded", reason: "session-exit", cursor: `${core.epoch}.1` }],
    });
  });

  test("lists the asks in the order they were created, owned and unchecked alike", async () => {
    const fixture = pushCoreWith();
    await fixture.core.ask(askWith({ askId: OTHER_ID }));
    fixture.table.add({ ownerKey: "main", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    await fixture.core.ask(askWith({ askId: ASK_ID }), callOf("ask", ASK_ID));
    const asks = fixture.core.overview();
    expect(asks.map((ask) => ask.askId)).toEqual([OTHER_ID, ASK_ID]);
    expect(asks.map((ask) => ask.owner?.ownerKey)).toEqual([undefined, "main"]);
  });

  test("shares nothing a caller could change", async () => {
    const { core } = pushCoreWith();
    await core.ask(askWith({ agentName: "Retry review" }));
    const [ask] = core.overview();
    expect(Object.isFrozen(ask)).toBe(true);
    expect(Object.isFrozen(ask?.unreceived)).toBe(true);
  });
});
