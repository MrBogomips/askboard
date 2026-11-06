import { describe, expect, test } from "bun:test";
import { uj2ExpandedDerived, uj2ExpandedEditedValues } from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import { AskCore } from "../src/index.ts";
import { fakePorts, plainChoiceAsk } from "./fakes.ts";
import { actionId, WHEN } from "./lifecycle-fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";
import { fakeWriter } from "./snapshot-fakes.ts";

// Core spec: Widget answers in a Snapshot (widget-answers task 2.8; E7's gathering): the data of
// the answered UJ-2 ask holds each answer's full values and the molecules' expansion map.

type Act = Parameters<AskCore["act"]>[1];
const ASK_ID = uj2Ask.askId;

const setup = async (request: unknown) => {
  const { writer, written } = fakeWriter();
  const core = new AskCore({
    ...fakePorts().ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
    snapshots: { writer },
  });
  const outcome = await core.ask(request as Parameters<AskCore["ask"]>[0]);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  return { core, written };
};

const snapshotOf = async (core: AskCore, written: readonly unknown[], askId: string) => {
  const outcome = await core.snapshot(askId, { takenBy: "agent" });
  expect(outcome).toMatchObject({ outcome: "saved" });
  const data = written.at(-1);
  const checked = validateSnapshotData(data);
  expect(checked.ok ? [] : checked.problems).toEqual([]);
  return data as {
    events: { event: { type: string; cursor: string }; values?: Record<string, unknown> }[];
    molecules?: { itemId: string; reference: string; molecule: string; version: string }[];
  };
};

describe("a Snapshot of a widget ask", () => {
  test("the answered UJ-2 ask holds the values of wbs and schedule and both molecules", async () => {
    const { core, written } = await setup(copyOf(uj2Ask));
    const answered = core.act(ASK_ID, {
      actionId: actionId(1),
      acts: [
        {
          type: "answer",
          itemId: "plan",
          rev: 1,
          when: WHEN,
          values: copyOf(uj2ExpandedEditedValues),
          derived: copyOf(uj2ExpandedDerived),
        },
      ],
    } as unknown as Act);
    expect(answered.ok).toBe(true);
    const data = await snapshotOf(core, written, ASK_ID);
    const [answer] = data.events;
    expect(answer?.event.type).toBe("answer");
    expect(Object.keys(answer?.values ?? {}).sort()).toEqual(["schedule", "wbs"]);
    expect(JSON.stringify(data)).not.toContain('wbs__tree":{');
    expect(data.molecules?.map(({ reference }) => reference)).toContain("wbs");
    expect(new Set(data.molecules?.map(({ molecule }) => molecule))).toEqual(
      new Set(["wbs-pert", "gantt-plan"]),
    );
    expect(new Set(data.molecules?.map(({ reference }) => reference))).toEqual(
      new Set(["wbs", "schedule"]),
    );
  });

  test("the unanswered UJ-2 ask holds molecules and no values", async () => {
    const { core, written } = await setup(copyOf(uj2Ask));
    const data = await snapshotOf(core, written, ASK_ID);
    expect(data.events.some((entry) => "values" in entry)).toBe(false);
    expect(data.molecules).toHaveLength(2);
  });

  test("an ask with choice answers only holds neither", async () => {
    const { core, written } = await setup(plainChoiceAsk());
    const request = plainChoiceAsk();
    const [item] = request.items;
    const rev = 1;
    const choice = [item?.type === "question" ? (item.props.options?.[0]?.label ?? "") : ""];
    const answered = core.act(request.askId, {
      actionId: actionId(2),
      acts: [{ type: "answer", itemId: item?.id, rev, when: WHEN, choice }],
    } as unknown as Act);
    expect(answered.ok).toBe(true);
    const data = await snapshotOf(core, written, request.askId);
    expect(data.events.some((entry) => "values" in entry)).toBe(false);
    expect("molecules" in data).toBe(false);
  });
});
