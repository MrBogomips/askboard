import { describe, expect, test } from "bun:test";
import { CLAUDE_CODE_MINIMUM } from "@askboard/contract";
import { UNKNOWN_VERSION_DIAGNOSTIC } from "../src/index.ts";
import { compareVersions } from "../src/push/version.ts";
import { askWith, plainChoiceAsk } from "./fakes.ts";
import { pushCoreWith } from "./push-fakes.ts";

// MCP adapter spec: Supported Claude Code versions (AD-18), as ask-core holds and applies them
// (task 3.5). mcp-tools sets the version from the client information naming claude-code, and
// board-host from the mod's report.

const ASK_ID = "order-db-choice-x7k2";

describe("comparing versions", () => {
  test.each([
    ["2.1.311", "2.1.311", 0],
    ["2.1.308", "2.1.311", -1],
    ["2.1.312", "2.1.311", 1],
    ["2.2.0", "2.1.311", 1],
    ["10.0.0", "9.9.9", 1],
    ["2.1", "2.1.0", 0],
    ["2.1.311+build.7", "2.1.311", 0],
    ["2.1.311-rc.1+build.7", "2.1.311-rc.1", 0],
  ] as const)("%s against %s is %d, part by part as numbers", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  test.each([
    ["2.1.311-beta.1", "2.1.311", -1],
    ["2.1.311-beta.1", "2.1.310", 1],
    ["2.1.311-alpha", "2.1.311-beta", -1],
    ["2.1.311-rc.2", "2.1.311-rc.10", -1],
    ["2.1.311-rc.1", "2.1.311-rc.1.1", -1],
    ["2.1.311-1", "2.1.311-rc", -1],
  ] as const)("a pre-release counts below its release: %s against %s is %d", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
    expect(compareVersions(b, a)).toBe(-expected as -1 | 1);
  });

  test.each(["", "dev", "v2.1.311", "2.1.x", "2..1", "2.1.311-", `2.1.${"1".repeat(80)}`])(
    "%p cannot be read, so it compares as unknown",
    (version) => {
      expect(compareVersions(version, CLAUDE_CODE_MINIMUM)).toBeUndefined();
    },
  );
});

describe("the version gate", () => {
  test("an ask from a Claude Code below the minimum is refused, naming both, and creates nothing", async () => {
    const { core, calls, heard, opened, notices } = pushCoreWith();
    core.setClientVersion("client-info", "2.1.308");
    expect(await core.ask(plainChoiceAsk())).toEqual({
      kind: "unsupported-version",
      askId: ASK_ID,
      version: "2.1.308",
      minimum: "2.1.311",
    });
    expect(calls.filter((call) => !call.startsWith("bytes"))).toEqual(["check"]);
    expect(core.board(ASK_ID)).toBeUndefined();
    expect(heard).toEqual([]);
    expect(opened).toEqual([]);
    expect(notices).toEqual([]);
  });

  test("the refused ID stays free for a later ask", async () => {
    const { core } = pushCoreWith();
    core.setClientVersion("client-info", "2.1.308");
    await core.ask(plainChoiceAsk());
    core.setClientVersion("client-info", "2.1.311");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
  });

  test("a pre-release of the minimum counts below it", async () => {
    const { core } = pushCoreWith();
    core.setClientVersion("mod", "2.1.311-beta.2");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("unsupported-version");
  });

  test("the version the mod reported lets the ask proceed when the requests name none", async () => {
    const { core, diagnosed } = pushCoreWith();
    core.setClientVersion("mod", "2.1.312");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(diagnosed).toEqual([]);
  });

  test("the client information wins over the mod's report", async () => {
    const first = pushCoreWith();
    first.core.setClientVersion("mod", "2.1.300");
    first.core.setClientVersion("client-info", "2.1.312");
    expect((await first.core.ask(plainChoiceAsk())).kind).toBe("created");
    const second = pushCoreWith();
    second.core.setClientVersion("client-info", "2.1.308");
    second.core.setClientVersion("mod", "2.1.312");
    expect((await second.core.ask(plainChoiceAsk())).kind).toBe("unsupported-version");
  });

  test("with no version known, asks proceed and one diagnostic says so", async () => {
    const { core, diagnosed, reported } = pushCoreWith();
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect((await core.ask(askWith({ askId: "cache-choice-b5n1" }))).kind).toBe("created");
    expect(diagnosed).toEqual([UNKNOWN_VERSION_DIAGNOSTIC]);
    expect(UNKNOWN_VERSION_DIAGNOSTIC).toContain("unknown");
    expect(UNKNOWN_VERSION_DIAGNOSTIC).toContain(CLAUDE_CODE_MINIMUM);
    expect(reported).toEqual([]);
  });

  test("a version that cannot be read counts as unknown", async () => {
    const { core, diagnosed } = pushCoreWith();
    core.setClientVersion("client-info", "dev-build");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(diagnosed).toEqual([UNKNOWN_VERSION_DIAGNOSTIC]);
  });

  test("a client-information version that cannot be read gives way to the mod's", async () => {
    const below = pushCoreWith();
    below.core.setClientVersion("client-info", "dev-build");
    below.core.setClientVersion("mod", "2.1.308");
    expect(await below.core.ask(plainChoiceAsk())).toEqual({
      kind: "unsupported-version",
      askId: ASK_ID,
      version: "2.1.308",
      minimum: "2.1.311",
    });
    const above = pushCoreWith();
    above.core.setClientVersion("mod", "2.1.312");
    above.core.setClientVersion("client-info", "dev-build");
    expect((await above.core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(above.diagnosed).toEqual([]);
  });

  test("with neither version readable, the ask proceeds with one diagnostic", async () => {
    const { core, diagnosed } = pushCoreWith();
    core.setClientVersion("client-info", "dev-build");
    core.setClientVersion("mod", "nightly");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(diagnosed).toEqual([UNKNOWN_VERSION_DIAGNOSTIC]);
  });

  test("without the diagnostics port, an unknown version is allowed in silence", async () => {
    const { core, reported } = pushCoreWith({ noDiagnose: true });
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(reported).toEqual([]);
  });

  test("an ask that cannot be shown is unavailable before the gate looks", async () => {
    const { core, diagnosed } = pushCoreWith({
      showing: { showable: false, reason: "ci", detail: "CI is set and BROWSER is not" },
    });
    core.setClientVersion("client-info", "2.1.308");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("unavailable");
    const unknown = pushCoreWith({
      showing: { showable: false, reason: "ci", detail: "CI is set and BROWSER is not" },
    });
    await unknown.core.ask(plainChoiceAsk());
    expect([...diagnosed, ...unknown.diagnosed]).toEqual([]);
  });

  test("a resend creates nothing, so the gate does not apply to it", async () => {
    const { core } = pushCoreWith();
    core.setClientVersion("client-info", "2.1.311");
    await core.ask(plainChoiceAsk());
    core.setClientVersion("client-info", "2.1.308");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("resent");
  });
});
