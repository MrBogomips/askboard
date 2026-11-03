import { describe, expect, test } from "bun:test";
import { expectedAnswerer } from "../src/index.ts";
import { askWith, plainChoiceAsk } from "./fakes.ts";
import { callOf, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// View spec: The expected answerer in the header; Who asked, and where (task 8.1, design decision
// 12). ask-core keeps, per ask, who asked (the owner's origin, the agent's name) and the expected
// answerer the header shows: the ask's `expectedUser`, only when it differs from the session
// project's git user name, without case and surrounding spaces, or when there is none.

const ASK_ID = "order-db-choice-x7k2";
const HEADER = { header: { backgroundThresholdMs: 120_000 } } as const;

describe("the expected-answerer rule", () => {
  test("hides an expected user who is the git user, in any case and with surrounding spaces", () => {
    expect(expectedAnswerer("Paola Greco", "Paola Greco")).toBeUndefined();
    expect(expectedAnswerer("  paola GRECO ", "Paola Greco")).toBeUndefined();
    expect(expectedAnswerer("Paola Greco", " paola greco\t")).toBeUndefined();
  });

  test("shows another expected user, trimmed", () => {
    expect(expectedAnswerer(" Marco Rossi ", "Paola Greco")).toBe("Marco Rossi");
  });

  test("shows a named expected user on a machine with no git user name", () => {
    expect(expectedAnswerer("Marco Rossi", undefined)).toBe("Marco Rossi");
    expect(expectedAnswerer("Marco Rossi", "   ")).toBe("Marco Rossi");
  });

  test("shows nothing when the ask names no expected user", () => {
    expect(expectedAnswerer(undefined, "Paola Greco")).toBeUndefined();
    expect(expectedAnswerer("   ", undefined)).toBeUndefined();
  });
});

describe("who asked, as ask-core keeps it", () => {
  test("an expected user equal to the git user in another case is not shown", async () => {
    const { core } = pushCoreWith({ ...HEADER, git: "Paola Greco" });
    await core.ask(askWith({ expectedUser: "PAOLA greco" }));
    expect(core.whoAsked(ASK_ID)).toEqual({});
  });

  test("a different expected user is shown", async () => {
    const { core, calls } = pushCoreWith({ ...HEADER, git: "Paola Greco" });
    await core.ask(askWith({ expectedUser: "Marco Rossi" }));
    expect(core.whoAsked(ASK_ID)).toEqual({ forUser: "Marco Rossi" });
    // The machine is asked once, for the rule; the answerer is still the expected user.
    expect(calls.filter((call) => call === "git")).toEqual(["git"]);
  });

  test("on a machine with no git user name, a named expected user is shown", async () => {
    const { core } = pushCoreWith({ ...HEADER, login: "paola" });
    await core.ask(askWith({ expectedUser: "Marco Rossi" }));
    expect(core.whoAsked(ASK_ID)).toEqual({ forUser: "Marco Rossi" });
  });

  test("a git lookup that fails is reported, and the expected user is shown", async () => {
    const { core, reported } = pushCoreWith({ ...HEADER, gitFails: true });
    await core.ask(askWith({ expectedUser: "Marco Rossi" }));
    expect(core.whoAsked(ASK_ID)).toEqual({ forUser: "Marco Rossi" });
    expect(reported).toHaveLength(1);
  });

  test("an ask that names no expected user costs no further lookup", async () => {
    const { core, calls } = pushCoreWith({ ...HEADER, git: "Paola Greco" });
    await core.ask(plainChoiceAsk());
    expect(core.whoAsked(ASK_ID)).toEqual({});
    expect(calls.filter((call) => call === "git")).toEqual(["git"]);
  });

  test("holds the owner's origin and the agent's name", async () => {
    const { core, table } = pushCoreWith({ ...HEADER, git: "Paola Greco" });
    const origin = { ...REVIEWER_ORIGIN, ordinal: 2 };
    table.add({ ownerKey: "agent-2", tool: "ask", askIds: [ASK_ID], origin });
    await core.ask(askWith({ agentName: "Retry review" }), callOf("ask", ASK_ID));
    expect(core.whoAsked(ASK_ID)).toEqual({ origin, agentName: "Retry review" });
  });

  test("an unchecked ask has no origin", async () => {
    const { core } = pushCoreWith({ ...HEADER, git: "Paola Greco" });
    await core.ask(askWith({ agentName: "Retry review" }));
    expect(core.whoAsked(ASK_ID)).toEqual({ agentName: "Retry review" });
  });

  test("an ask this epoch does not hold has none", () => {
    const { core } = pushCoreWith(HEADER);
    expect(core.whoAsked(ASK_ID)).toBeUndefined();
  });

  test("without the header's ports, as in E1, the machine is not asked for an expected user", async () => {
    const { core, calls } = pushCoreWith({ git: "Paola Greco" });
    await core.ask(askWith({ expectedUser: "Marco Rossi" }));
    expect(calls).not.toContain("git");
    expect(core.whoAsked(ASK_ID)).toEqual({});
  });
});
