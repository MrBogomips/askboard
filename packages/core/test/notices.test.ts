import { describe, expect, test } from "bun:test";
import { askWith, plainChoiceAsk } from "./fakes.ts";
import { callOf, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// Design decision 5's opener decision and notices (AD-2, FR-23; board-host spec, Opening a board
// in the browser, System notification), as ask-core decides them (task 3.4).

const ASK_ID = "order-db-choice-x7k2";
const OTHER_ID = "cache-choice-b5n1";
const LINK = `http://127.0.0.1:47213/b/${ASK_ID}?t=pV3xK9qLmT2wR7nB4cYh8A`;

describe("a new ask's board and notice", () => {
  test("with no working board, the board opens and one notice names the ask", async () => {
    const { core, calls, opened, notices } = pushCoreWith();
    await core.ask(askWith({ title: "Orders database", agentName: "Retry review" }));
    expect(opened).toEqual([LINK]);
    expect(notices).toEqual([
      {
        askId: ASK_ID,
        title: "Orders database",
        link: LINK,
        questions: 1,
        agentName: "Retry review",
      },
    ]);
    expect(calls.filter((call) => call === "open" || call === "notify")).toEqual([
      "open",
      "notify",
    ]);
  });

  test("an owned ask's notice carries its origin", async () => {
    const { core, table, notices } = pushCoreWith();
    table.add({ ownerKey: "reviewer-1", tool: "ask", askIds: [ASK_ID], origin: REVIEWER_ORIGIN });
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    expect(notices).toEqual([
      {
        askId: ASK_ID,
        title: core.board(ASK_ID)?.document.title as string,
        link: LINK,
        questions: 1,
        origin: REVIEWER_ORIGIN,
      },
    ]);
  });

  test("a working board of the epoch keeps the opener shut, but not the notice", async () => {
    const { core, opened, notices } = pushCoreWith();
    await core.ask(plainChoiceAsk());
    core.setWorking(ASK_ID, true);
    await core.ask(askWith({ askId: OTHER_ID }));
    expect(opened).toEqual([LINK]);
    expect(notices.map((notice) => notice.askId)).toEqual([ASK_ID, OTHER_ID]);
  });

  test("once no board is working, the opener runs again", async () => {
    const { core, opened } = pushCoreWith();
    await core.ask(plainChoiceAsk());
    core.setWorking(ASK_ID, true);
    core.setWorking(ASK_ID, false);
    await core.ask(askWith({ askId: OTHER_ID }));
    expect(opened).toHaveLength(2);
  });

  test("a working signal for an ask the epoch does not hold is ignored", async () => {
    const { core, opened } = pushCoreWith();
    core.setWorking("never-asked", true);
    await core.ask(plainChoiceAsk());
    expect(opened).toEqual([LINK]);
  });

  test("a resend opens and notifies nothing", async () => {
    const { core, opened, notices } = pushCoreWith();
    await core.ask(plainChoiceAsk());
    expect((await core.ask(plainChoiceAsk())).kind).toBe("resent");
    expect(opened).toHaveLength(1);
    expect(notices).toHaveLength(1);
  });

  test("an unavailable ask neither opens nor notifies", async () => {
    const { core, opened, notices } = pushCoreWith({
      showing: { showable: false, reason: "ci", detail: "CI is set and BROWSER is not" },
    });
    expect((await core.ask(plainChoiceAsk())).kind).toBe("unavailable");
    expect(opened).toEqual([]);
    expect(notices).toEqual([]);
  });

  test("without the notifier, the board opens as in E1", async () => {
    const { core, calls, opened } = pushCoreWith({ noNotices: true });
    await core.ask(plainChoiceAsk());
    expect(opened).toEqual([LINK]);
    expect(calls).not.toContain("notify");
  });

  test("a notifier that throws is reported, and the ask is created all the same", async () => {
    const { core, reported } = pushCoreWith({ noticeFails: true });
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(reported).toEqual([expect.objectContaining({ message: "notify-send is gone" })]);
  });

  test("an opener that throws is reported, and the notice still goes", async () => {
    const fixture = pushCoreWith();
    Object.assign(fixture.ports.showing, {
      open: () => {
        throw new Error("no opener");
      },
    });
    expect((await fixture.core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(fixture.reported).toEqual([expect.objectContaining({ message: "no opener" })]);
    expect(fixture.notices).toHaveLength(1);
  });
});
