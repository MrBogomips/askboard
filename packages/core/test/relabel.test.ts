import { describe, expect, test } from "bun:test";
import type { Origin } from "../src/index.ts";
import { askWith } from "./fakes.ts";
import { callOf, MAIN_ORIGIN, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// Board-host spec, Telling a teammate, "The report comes after the ask" (task 18.2; design decision
// 4, Origin, plan B): when the mod reports an agent as an in-process teammate after an ask of it was
// bound, its owner is relabelled. ask-core takes the new label as display text, never parsing an
// identifier: each ask the owner holds shows it with no ordinal, each it creates later takes it, and
// a live board hears an `origin` event for each ask whose origin changed.

const ASK_ID = "order-db-choice-x7k2";
const OTHER_ID = "cache-choice-b5n1";
const MAIN_ID = "retry-policy-q3m8";
const UNCHECKED_ID = "release-notes-h5t2";
const TEAMMATE = "Teammate researcher";
const NUMBERED: Origin = { ...REVIEWER_ORIGIN, ordinal: 2 };

const fixture = async () => {
  const made = pushCoreWith({ git: "Paola Greco" });
  made.table.add({ ownerKey: "owner-2", tool: "ask", askIds: [ASK_ID], origin: NUMBERED });
  made.table.add({ ownerKey: "owner-1", tool: "ask", askIds: [MAIN_ID], origin: MAIN_ORIGIN });
  await made.core.ask(askWith({ askId: ASK_ID }), callOf("ask", ASK_ID));
  await made.core.ask(askWith({ askId: MAIN_ID }), callOf("ask", MAIN_ID));
  await made.core.ask(askWith({ askId: UNCHECKED_ID }));
  return made;
};

const labelOf = (core: Awaited<ReturnType<typeof fixture>>["core"], askId: string) =>
  core.whoAsked(askId)?.origin;

describe("relabelling an owner", () => {
  test("renames its asks' origin, drops the ordinal, and tells each ask's board", async () => {
    const { core, heard } = await fixture();
    const before = heard.length;
    core.relabel("owner-2", TEAMMATE);
    expect(labelOf(core, ASK_ID)).toEqual({ ...REVIEWER_ORIGIN, label: TEAMMATE });
    expect(core.overview().find((ask) => ask.askId === ASK_ID)?.owner?.origin?.label).toBe(
      TEAMMATE,
    );
    expect(heard.slice(before)).toEqual([{ type: "origin", askId: ASK_ID }]);
  });

  test("leaves another owner's asks and unchecked asks as they were", async () => {
    const { core } = await fixture();
    core.relabel("owner-2", TEAMMATE);
    expect(labelOf(core, MAIN_ID)).toEqual(MAIN_ORIGIN);
    expect(labelOf(core, UNCHECKED_ID)).toBeUndefined();
  });

  test("the same label again changes nothing and tells nobody", async () => {
    const { core, heard } = await fixture();
    core.relabel("owner-2", TEAMMATE);
    const before = heard.length;
    core.relabel("owner-2", TEAMMATE);
    expect(heard.length).toBe(before);
  });

  test("an ask the owner creates afterwards takes the label, in its notice too", async () => {
    const { core, table, notices } = await fixture();
    core.relabel("owner-2", TEAMMATE);
    table.add({ ownerKey: "owner-2", tool: "ask", askIds: [OTHER_ID], origin: NUMBERED });
    await core.ask(askWith({ askId: OTHER_ID }), callOf("ask", OTHER_ID));
    expect(labelOf(core, OTHER_ID)).toEqual({ ...REVIEWER_ORIGIN, label: TEAMMATE });
    expect(notices.at(-1)?.origin).toEqual({ ...REVIEWER_ORIGIN, label: TEAMMATE });
  });

  test("an owner with no ask yet is remembered for its first", async () => {
    const { core, table, heard } = pushCoreWith({ git: "Paola Greco" });
    core.relabel("owner-3", TEAMMATE);
    expect(heard).toEqual([]);
    table.add({ ownerKey: "owner-3", tool: "ask", askIds: [OTHER_ID], origin: REVIEWER_ORIGIN });
    await core.ask(askWith({ askId: OTHER_ID }), callOf("ask", OTHER_ID));
    expect(labelOf(core, OTHER_ID)?.label).toBe(TEAMMATE);
  });
});
