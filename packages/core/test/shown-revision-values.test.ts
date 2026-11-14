import { describe, expect, test } from "bun:test";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, appendedOf, logOf, WHEN } from "./lifecycle-fakes.ts";

// Core spec: an answer's values are checked against the revision it names (document-review, task
// 6.19, review 6.17's unconfirmed note; design decision 15). A card that shows an earlier revision
// after "Keep mine" sends only the items that revision holds; a value for an item only a later
// revision holds is refused whole, appending, keeping and publishing nothing (AD-10, NFR-10).

type Act = Parameters<AskCore["act"]>[1];
type AskInput = Parameters<AskCore["ask"]>[0];
type Json = Record<string, unknown>;

let n = 0;
const ASK_ID = "shown-values-q4";
const tree = (id: string, label: string) => ({
  type: "tree",
  id,
  props: { nodes: [{ id: "ux", label }] },
});

// Revision 1 holds the Tree `t`; the agent's revision 2 replaces it with the Tree `d`.
const setup = async () => {
  const core = new AskCore(fakePorts().ports);
  const ask = {
    askId: ASK_ID,
    items: [{ type: "question", id: "plan", props: { text: "Plan?", items: [tree("t", "UX")] } }],
  };
  const outcome = await core.ask(ask as unknown as AskInput);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  const updated = await core.update({
    askId: ASK_ID,
    actions: [{ action: "change", itemId: "plan", props: { items: [tree("d", "Design")] } }],
  });
  expect(updated).toMatchObject({ kind: "updated" });
  // "Keep mine": the user keeps revision 1, which the answer then names.
  n += 1;
  const kept = core.act(ASK_ID, {
    actionId: actionId(n),
    acts: [{ type: "edit-choice", itemId: "plan", rev: 2, edit: "ignore", keptRev: 1, when: WHEN }],
  } as unknown as Act);
  expect(kept.ok).toBe(true);
  const heard: Parameters<Parameters<AskCore["subscribe"]>[0]>[0][] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard };
};

const answer = (core: AskCore, rev: number, fields: Json) => {
  n += 1;
  const act = { type: "answer", itemId: "plan", rev, when: WHEN, ...fields };
  return core.act(ASK_ID, { actionId: actionId(n), acts: [act] } as unknown as Act);
};

describe("an answer naming revision 1 whose values name an item only revision 2 holds", () => {
  test("is refused naming the item, appending, keeping and publishing nothing", async () => {
    const { core, heard } = await setup();
    const outcome = answer(core, 1, { values: { d: tree("d", "Forged").props } });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).toContain('values name \\"d\\"');
    expect(logOf(core, ASK_ID).map((event) => event.type)).toEqual(["edit-choice"]);
    expect(appendedOf(heard)).toEqual([]);
    expect(core.keptAnswerValues(ASK_ID)?.size ?? 0).toBe(0);
  });

  test("is refused whole, though it also names an item revision 1 holds", async () => {
    const { core, heard } = await setup();
    const outcome = answer(core, 1, {
      values: { t: tree("t", "Edited").props, d: tree("d", "Forged").props },
    });
    expect(outcome.ok).toBe(false);
    expect(logOf(core, ASK_ID).map((event) => event.type)).toEqual(["edit-choice"]);
    expect(appendedOf(heard)).toEqual([]);
    expect(core.keptAnswerValues(ASK_ID)?.size ?? 0).toBe(0);
  });

  test("an answer naming revision 1 with a value for the item revision 1 holds is accepted and logged under revision 1", async () => {
    const { core, heard } = await setup();
    const outcome = answer(core, 1, { values: { t: tree("t", "Edited").props } });
    expect(outcome.ok).toBe(true);
    expect(
      logOf(core, ASK_ID).map((event) => `${event.type}:${(event as { rev?: number }).rev}`),
    ).toEqual(["edit-choice:2", "answer:1"]);
    expect(appendedOf(heard)).toHaveLength(1);
  });

  test("a value for the item that revision 1 holds is refused on revision 2, which lacks it", async () => {
    const { core } = await setup();
    const outcome = answer(core, 2, { values: { t: tree("t", "Edited").props } });
    expect(outcome.ok).toBe(false);
    expect(logOf(core, ASK_ID).map((event) => event.type)).toEqual(["edit-choice"]);
  });
});
