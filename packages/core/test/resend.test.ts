import { describe, expect, test } from "bun:test";
import { canonicalize } from "../src/index.ts";
import { answer, askWith, coreWith, plainChoiceAsk } from "./fakes.ts";

// Core spec: Re-sending an ask (AD-6, FR-5), with RFC 8785 canonicalization (task 4.4).

const ASK_ID = "order-db-choice-x7k2";

describe("RFC 8785 canonicalization", () => {
  test("sorts object keys by UTF-16 code units, recursively, and keeps array order", () => {
    expect(canonicalize({ b: [3, { z: 1, a: true }], a: "x", c: null })).toBe(
      '{"a":"x","b":[3,{"a":true,"z":1}],"c":null}',
    );
  });

  test("orders the keys of RFC 8785's sorting example as the RFC does", () => {
    const keys = ["€", "\r", "דּ", "1", "😀", "\u0080", "ö"];
    const value = Object.fromEntries(keys.map((key) => [key, key.length]));
    // Read back as text: parsing would put the integer-like key "1" first again.
    const sorted = ["\r", "1", "\u0080", "\u00f6", "\u20ac", "\ud83d\ude00", "\ufb33"];
    const members = sorted.map((key) => `${JSON.stringify(key)}:${key.length}`);
    expect(canonicalize(value)).toBe(`{${members.join(",")}}`);
  });

  test("writes strings and numbers as ECMAScript's JSON does, with no whitespace", () => {
    expect(canonicalize(['é\n\u001f"', -0, 1e21, 0.5, false])).toBe(
      '["é\\n\\u001f\\"",0,1e+21,0.5,false]',
    );
  });

  test.each([
    ["undefined", undefined],
    ["a function", () => 1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a nested undefined", { a: [undefined] }],
  ])("refuses %s, which JSON cannot hold", (_, value) => {
    expect(() => canonicalize(value)).toThrow();
  });
});

describe("re-sending an ask", () => {
  test("an identical request, keys in another order, returns the same board and opens nothing", async () => {
    const { core, calls, opened } = coreWith();
    const first = await core.ask(plainChoiceAsk());
    const request = plainChoiceAsk();
    const reordered = {
      items: request.items.map(({ props, id, type }) => ({ props, id, type })),
      askId: request.askId,
    };
    const callsBefore = calls.length;
    const again = await core.ask(reordered);
    expect(again).toEqual({
      kind: "resent",
      ask: first.kind === "created" ? first.ask : (null as never),
    });
    expect(calls.slice(callsBefore)).toEqual([]);
    expect(opened).toHaveLength(1);
  });

  test("the resend names the ask's current state", async () => {
    const { core } = coreWith();
    await core.ask(plainChoiceAsk());
    core.answer(ASK_ID, answer());
    expect(await core.ask(plainChoiceAsk())).toMatchObject({
      kind: "resent",
      ask: { state: "answered", cursor: `${core.epoch}.0` },
    });
  });

  test("a different request under an open ID is refused, naming the ID as in use", async () => {
    const { core, opened } = coreWith();
    await core.ask(plainChoiceAsk());
    expect(await core.ask(askWith({ title: "Another title" }))).toEqual({
      kind: "in-use",
      askId: ASK_ID,
    });
    expect(opened).toHaveLength(1);
  });

  test("any request under a discarded ID is refused, the identical one included", async () => {
    const { core } = coreWith();
    await core.ask(plainChoiceAsk());
    core.discardAll("session-exit");
    expect(await core.ask(plainChoiceAsk())).toEqual({ kind: "in-use", askId: ASK_ID });
    expect(await core.ask(askWith({ title: "Another" }))).toEqual({
      kind: "in-use",
      askId: ASK_ID,
    });
  });

  test("two identical requests at once create one ask, and the second is a resend", async () => {
    const { core, calls, opened } = coreWith();
    const [first, second] = await Promise.all([
      core.ask(plainChoiceAsk()),
      core.ask(plainChoiceAsk()),
    ]);
    expect(first.kind).toBe("created");
    expect(second.kind).toBe("resent");
    expect(calls.filter((call) => call.startsWith("link"))).toHaveLength(1);
    expect(opened).toHaveLength(1);
  });

  test("two different requests under one ID at once create one ask, and refuse the other", async () => {
    const { core } = coreWith();
    const outcomes = await Promise.all([
      core.ask(plainChoiceAsk()),
      core.ask(askWith({ title: "Another" })),
      core.ask(plainChoiceAsk()),
    ]);
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(["created", "in-use", "resent"]);
  });

  test("an ID whose creation failed, or found no board to show, stays free", async () => {
    const fixture = coreWith({ linkFails: true });
    await expect(fixture.core.ask(plainChoiceAsk())).rejects.toThrow("no free port");
    Object.assign(fixture.ports.address, {
      link: async (askId: string) => `http://127.0.0.1:47214/b/${askId}?t=pV3xK9qLmT2wR7nB4cYh8A`,
    });
    expect((await fixture.core.ask(plainChoiceAsk())).kind).toBe("created");
    const unavailable = coreWith({
      showing: { showable: false, reason: "ci", detail: "CI is set and BROWSER is not" },
    });
    expect((await unavailable.core.ask(plainChoiceAsk())).kind).toBe("unavailable");
    expect((await unavailable.core.ask(plainChoiceAsk())).kind).toBe("unavailable");
  });
});
