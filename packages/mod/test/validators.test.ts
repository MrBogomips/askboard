import { describe, expect, test } from "bun:test";
import { LOCAL_API_VERSION } from "@askboard/contract";
import { fixturePollResponse, fixtureSessionFile } from "@askboard/contract/fixtures";
import { checks } from "../src/validators.ts";

// What the mod checks before it acts (design decision 7): the session file, the poll and the local
// API's acknowledgements, each with its version's major. The mod build replaces these with
// standalone validators of the same schemas, which tools/build/mod.test.ts holds to the same cases.

describe("the mod's checks", () => {
  test("pass the contract's session file, poll and acknowledgement", () => {
    expect(checks.sessionFile(fixtureSessionFile)).toBe(true);
    expect(checks.poll(fixturePollResponse)).toBe(true);
    expect(checks.ack({ version: LOCAL_API_VERSION })).toBe(true);
  });

  test("refuse another major, a missing field and an extra one", () => {
    expect(checks.sessionFile({ ...fixtureSessionFile, format: "2.0" })).toBe(false);
    expect(checks.sessionFile({ ...fixtureSessionFile, pid: undefined })).toBe(false);
    expect(checks.poll({ ...fixturePollResponse, version: "2.0" })).toBe(false);
    expect(checks.poll({ ...fixturePollResponse, extra: true })).toBe(false);
    expect(checks.ack({ version: "2.1" })).toBe(false);
    expect(checks.ack({})).toBe(false);
  });
});
