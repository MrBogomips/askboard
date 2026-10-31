import { describe, expect, test } from "bun:test";
import { validateAgainst } from "@askboard/contract/validate";
import { answer, askWith, coreWith, plainChoiceAsk } from "./fakes.ts";

// Core spec: Discard at session exit (AD-2, AD-21, FR-25; task 4.5).

const ASK_ID = "order-db-choice-x7k2";
const OTHER = "order-db-choice-b5n1";

const twoAsks = async () => {
  const fixture = coreWith();
  await fixture.core.ask(plainChoiceAsk());
  await fixture.core.ask(askWith({ askId: OTHER }));
  fixture.core.answer(ASK_ID, answer());
  fixture.heard.length = 0;
  return fixture;
};

describe("discard at session exit", () => {
  test("every open ask gains a final discarded event with reason session-exit", async () => {
    const { core } = await twoAsks();
    expect(core.discardAll("session-exit")).toBe(2);
    const discarded = (cursor: string) => ({ cursor, type: "discarded", reason: "session-exit" });
    expect(core.read(ASK_ID, `${core.epoch}.1`)).toEqual({
      kind: "events",
      askId: ASK_ID,
      state: "discarded",
      cursor: `${core.epoch}.2`,
      events: [discarded(`${core.epoch}.2`) as never],
    });
    expect(core.read(OTHER, `${core.epoch}.0`)).toMatchObject({
      state: "discarded",
      events: [discarded(`${core.epoch}.1`)],
    });
    const read = core.read(OTHER, `${core.epoch}.0`);
    const [event] = read.kind === "events" ? read.events : [];
    expect(validateAgainst("urn:askboard:output:discarded-event", event).ok).toBe(true);
  });

  test("subscribers hear each discarded event and each discard before it returns", async () => {
    const { core, heard } = await twoAsks();
    core.discardAll("session-exit");
    expect(heard).toEqual([
      {
        type: "appended",
        askId: ASK_ID,
        event: { cursor: `${core.epoch}.2`, type: "discarded", reason: "session-exit" },
      },
      { type: "discarded", askId: ASK_ID, reason: "session-exit" },
      {
        type: "appended",
        askId: OTHER,
        event: { cursor: `${core.epoch}.1`, type: "discarded", reason: "session-exit" },
      },
      { type: "discarded", askId: OTHER, reason: "session-exit" },
    ]);
  });

  test("a discarded ask is discarded once, shows as discarded and accepts no more answers", async () => {
    const { core, heard } = await twoAsks();
    core.discardAll("session-exit");
    const count = heard.length;
    expect(core.discardAll("session-exit")).toBe(0);
    expect(heard).toHaveLength(count);
    expect(core.board(OTHER)?.state).toBe("discarded");
    expect(core.answer(OTHER, answer())).toEqual({
      ok: false,
      refusal: "discarded",
      detail: "the ask was discarded",
    });
    expect(core.read(OTHER, `${core.epoch}.0`)).toMatchObject({ events: [{ type: "discarded" }] });
  });

  test("the tombstone keeps received, and a read can still raise it", async () => {
    const { core } = await twoAsks();
    core.markRead(ASK_ID, `${core.epoch}.1`);
    core.discardAll("session-exit");
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(true);
    expect(core.markRead(ASK_ID, `${core.epoch}.2`)).toBe(true);
  });

  test("once the session ends, a new ask is refused and creates nothing", async () => {
    const { core, opened } = coreWith();
    core.discardAll("session-exit");
    expect(await core.ask(plainChoiceAsk())).toEqual({ kind: "ending" });
    expect(core.board(ASK_ID)).toBeUndefined();
    expect(opened).toEqual([]);
  });

  test("an ask still being created when the session ends is not stored or opened", async () => {
    const fixture = coreWith();
    let release: (link: string) => void = () => undefined;
    Object.assign(fixture.ports.address, {
      link: () => new Promise<string>((resolve) => (release = resolve)),
    });
    const creating = fixture.core.ask(plainChoiceAsk());
    await Bun.sleep(0);
    fixture.core.discardAll("session-exit");
    release(`http://127.0.0.1:47213/b/${ASK_ID}?t=pV3xK9qLmT2wR7nB4cYh8A`);
    expect(await creating).toEqual({ kind: "ending" });
    expect(fixture.core.board(ASK_ID)).toBeUndefined();
    expect(fixture.opened).toEqual([]);
  });

  test("with no ask, there is nothing to discard", () => {
    expect(coreWith().core.discardAll("session-exit")).toBe(0);
  });
});
