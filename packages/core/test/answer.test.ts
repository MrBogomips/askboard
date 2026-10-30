import { describe, expect, test } from "bun:test";
import { NAME_MAX_CHARS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { UNKNOWN_USER } from "../src/index.ts";
import { answer, askWith, coreWith, plainChoiceAsk } from "./fakes.ts";

// Core spec: Answers only from an explicit user action; Who and when (task 4.2).

const ASK_ID = "order-db-choice-x7k2";
const created = async (
  options: Parameters<typeof coreWith>[0] = {},
  request = plainChoiceAsk(),
) => {
  const fixture = coreWith(options);
  expect((await fixture.core.ask(request)).kind).toBe("created");
  return fixture;
};
// The events the log gained, as the subscription told them.
const logOf = ({ heard }: Awaited<ReturnType<typeof created>>) =>
  heard.flatMap((event) => (event.type === "appended" ? [event.event] : []));

describe("answers only from an explicit user action", () => {
  test("a valid answer appends one answer event carrying that choice, and the ask is answered", async () => {
    const fixture = await created({ git: "Paola Greco" });
    const { core } = fixture;
    const outcome = core.answer(ASK_ID, answer());
    const event = {
      cursor: `${core.epoch}.1`,
      type: "answer",
      itemId: "database",
      rev: 1,
      who: "Paola Greco",
      when: "2026-10-29T09:41:27Z",
      choice: ["PostgreSQL"],
    };
    expect(outcome).toEqual({ ok: true, event: event as never });
    expect(logOf(fixture)).toEqual([event as never]);
    expect(core.board(ASK_ID)?.state).toBe("answered");
    expect(core.board(ASK_ID)?.questions).toEqual([
      {
        itemId: "database",
        rev: 1,
        answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z", delivered: false },
      },
    ]);
  });

  test("a Choice answer carries choice and none of the other content fields, and validates", async () => {
    const { core } = await created();
    const outcome = core.answer(ASK_ID, answer());
    const event = outcome.ok ? outcome.event : {};
    expect(Object.keys(event).sort()).toEqual(
      ["choice", "cursor", "itemId", "rev", "type", "when", "who"].sort(),
    );
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen((event as { choice: string[] }).choice)).toBe(true);
  });

  test("the logged answer does not share the command's choice", async () => {
    const fixture = await created();
    const command = answer();
    fixture.core.answer(ASK_ID, command);
    (command.choice as string[])[0] = "SQLite";
    expect(logOf(fixture)[0]).toMatchObject({ choice: ["PostgreSQL"] });
    expect(fixture.core.board(ASK_ID)?.questions[0]).toMatchObject({
      answer: { choice: ["PostgreSQL"] },
    });
  });

  test("a multiple-choice question takes several labels", async () => {
    const multi = plainChoiceAsk();
    Object.assign(multi.items[0].props, { multiSelect: true });
    const { core } = await created({}, multi);
    expect(core.answer(ASK_ID, answer({ choice: ["SQLite", "PostgreSQL"] })).ok).toBe(true);
  });

  test.each([
    ["a label that is not an option", { choice: ["MySQL"] }, "choice"],
    ["two labels on a single-choice question", { choice: ["PostgreSQL", "SQLite"] }, "choice"],
    ["an empty choice", { choice: [] }, "choice"],
    ["a label twice", { choice: ["PostgreSQL", "PostgreSQL"] }, "choice"],
    ["a rev that is not current", { rev: 2 }, "stale-rev"],
    ["a when that is no real time", { when: "2026-02-30T10:00:00Z" }, "when"],
    ["February 29 of a common year", { when: "2026-02-29T10:00:00Z" }, "when"],
    ["April 31", { when: "2026-04-31T10:00:00Z" }, "when"],
    ["a when that is not RFC 3339 UTC", { when: "2026-10-29T09:41:27+01:00" }, "when"],
    ["an unknown item", { itemId: "cache" }, "unknown-item"],
  ] as const)("%s is refused and the log is unchanged", async (_, fields, refusal) => {
    const fixture = await created();
    const { core } = fixture;
    const outcome = core.answer(ASK_ID, answer(fields as never));
    expect(outcome).toMatchObject({ ok: false, refusal });
    expect(outcome.ok ? "" : outcome.detail.length).toBeGreaterThan(0);
    expect(logOf(fixture)).toEqual([]);
    expect(core.board(ASK_ID)?.state).toBe("waiting");
    expect(core.board(ASK_ID)?.questions).toEqual([{ itemId: "database", rev: 1 }]);
  });

  test.each([
    ["a choice that is not a list", { choice: "PostgreSQL" }, "choice"],
    ["a label that is not text", { choice: [5] }, "choice"],
    ["a when that is not text", { when: ["2026-10-29T09:41:27Z"] }, "when"],
    ["a rev that is not an integer", { rev: 1.5 }, "stale-rev"],
    ["an item ID that is not text", { itemId: ["database"] }, "unknown-item"],
  ])("a command with %s is refused without throwing", async (_, fields, refusal) => {
    const fixture = await created();
    const outcome = fixture.core.answer(ASK_ID, answer(fields as never));
    expect(outcome).toMatchObject({ ok: false, refusal });
    expect(logOf(fixture)).toEqual([]);
  });

  test("February 29 of a leap year is a real time", async () => {
    const { core } = await created();
    expect(core.answer(ASK_ID, answer({ when: "2028-02-29T23:59:59.250Z" })).ok).toBe(true);
  });

  test("an answer to an ask this epoch does not hold is refused", async () => {
    const { core } = await created();
    expect(core.answer("other-ask", answer())).toMatchObject({ ok: false, refusal: "unknown-ask" });
  });

  test("a second answer is refused, the log keeps the first, and the board holds it", async () => {
    const fixture = await created();
    const { core } = fixture;
    core.answer(ASK_ID, answer());
    const retry = core.answer(ASK_ID, answer({ choice: ["SQLite"], when: "2026-10-29T09:42:00Z" }));
    expect(retry).toEqual({
      ok: false,
      refusal: "answered",
      detail: "the question is already answered",
    });
    expect(logOf(fixture).map((event) => event.type === "answer" && event.choice)).toEqual([
      ["PostgreSQL"],
    ]);
    expect(core.board(ASK_ID)?.questions[0]).toMatchObject({
      answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z" },
    });
  });
});

describe("who and when", () => {
  const whoOf = async (options: Parameters<typeof coreWith>[0], request = plainChoiceAsk()) => {
    const { core, calls } = await created(options, request);
    const outcome = core.answer(ASK_ID, answer());
    return { who: outcome.ok ? outcome.event.who : undefined, calls };
  };

  test("the ask's expected user, without asking the machine", async () => {
    const result = await whoOf({ git: "Paola Greco" }, askWith({ expectedUser: "Marco Rossi" }));
    expect(result.who).toBe("Marco Rossi");
    expect(result.calls).not.toContain("git");
  });

  test("else the git user name of the session project", async () => {
    const result = await whoOf({ git: "Paola Greco", login: "paola" });
    expect(result.who).toBe("Paola Greco");
    expect(result.calls).not.toContain("login");
  });

  test("with no expected user and no git user name, the login name", async () => {
    expect((await whoOf({ login: "paola" })).who).toBe("paola");
    expect((await whoOf({ git: "   ", login: "paola" })).who).toBe("paola");
  });

  test("with no name at all, a fixed placeholder", async () => {
    expect((await whoOf({})).who).toBe(UNKNOWN_USER);
  });

  test("a name longer than the contract's limit is cut to it", async () => {
    const who = (await whoOf({ git: "n".repeat(NAME_MAX_CHARS + 10) })).who ?? "";
    expect(who).toBe("n".repeat(NAME_MAX_CHARS));
  });

  test("an identity that fails is reported, and the next name is used", async () => {
    const fixture = coreWith({ login: "paola" });
    const failure = new Error("git is not installed");
    const ports = { ...fixture.ports };
    Object.assign(ports.identity, {
      gitUserName: async () => {
        throw failure;
      },
    });
    expect((await fixture.core.ask(plainChoiceAsk())).kind).toBe("created");
    const outcome = fixture.core.answer(ASK_ID, answer());
    expect(outcome.ok ? outcome.event.who : "").toBe("paola");
    expect(fixture.reported).toEqual([failure]);
  });

  test("when is the board's stamp, as sent", async () => {
    const { core } = await created();
    const outcome = core.answer(ASK_ID, answer({ when: "2026-10-30T07:00:00.5Z" }));
    expect(outcome.ok ? outcome.event.when : "").toBe("2026-10-30T07:00:00.5Z");
  });
});
