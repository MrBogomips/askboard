import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore } from "@askboard/core";
import { createMoleculeSource } from "../src/molecule-source/index.ts";
import { connect, depsWith, jsonOf, LINK, runtimeClock, textOf } from "./mcp-tools/helpers.ts";

// MCP adapter spec: A deleted item in fetch, "A molecule reference inside a deleted question"
// (agent-facing-gaps review 2.2, X-1). The UJ-2 ask over the real ask-core and the shipped molecules:
// the molecule references of a deleted question are items the agent sent and deleted; their expanded
// IDs it never sent. This file sits beside `mcp-tools/fetch.test.ts` because the shipped molecule
// source is another server unit, which `mcp-tools` tests may not import (AD-1).

const uj2 = JSON.parse(
  readFileSync(
    join(import.meta.dir, "../../contract/test/fixtures/asks/uj2-wbs-gantt.json"),
    "utf8",
  ),
);

const session = async () => {
  const core = new AskCore({
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    showing: { check: async () => ({ showable: true }), open: () => undefined },
    address: { link: async () => LINK },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    report: () => undefined,
    clock: runtimeClock,
    molecules: createMoleculeSource(),
  });
  const { client, close } = await connect(depsWith(core).deps);
  const call = (args: unknown) => client.callTool({ name: "fetch", arguments: args as never });
  return { core, call, close };
};

describe("fetch of a molecule reference inside a deleted question", () => {
  test("the references answer deleted, the expanded IDs the error for an item never held", async () => {
    const { core, call, close } = await session();
    expect((await core.ask(structuredClone(uj2))).kind).toBe("created");
    const askId = uj2.askId as string;
    const live = await call({ askId, itemId: "wbs" });
    expect(live.isError).toBeFalsy();
    expect((jsonOf(live) as { item: { id: string } }).item.id).toBe("wbs");
    const updated = await core.update({
      askId,
      actions: [{ action: "delete", itemId: "plan" }],
    } as never);
    expect(updated.kind).toBe("updated");
    for (const itemId of ["plan", "wbs", "schedule"]) {
      const result = await call({ askId, itemId });
      expect(result.isError, itemId).toBeFalsy();
      const json = jsonOf(result);
      expect(json, itemId).toMatchObject({ askId, itemId, outcome: "deleted" });
      expect(validateAgainst(SCHEMA_IDS.fetchOutcome, json).ok).toBe(true);
    }
    for (const itemId of ["wbs__tree", "schedule__plan"]) {
      const result = await call({ askId, itemId });
      expect(result.isError, itemId).toBe(true);
      expect(textOf(result)).toContain(`has no item "${itemId}"`);
      expect(textOf(result)).not.toContain("outcome");
    }
    await close();
  });
});
