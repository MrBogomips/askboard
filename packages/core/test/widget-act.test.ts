import { describe, expect, test } from "bun:test";
import { uj2ExpandedDerived, uj2ExpandedEditedValues } from "@askboard/contract/fixtures";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, appendedOf, logOf, WHEN } from "./lifecycle-fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";

// Core spec: Answers only from an explicit user action, Derived values in an answer (widget-answers
// design decision 6, steps 1, 2, 4 and 5; decision 10): every refusal leaves the log as it was and
// publishes nothing.

const ASK_ID = uj2Ask.askId;
const TREE = "wbs__tree";
const PLAN = "schedule__plan";
type Json = Record<string, unknown>;

const setup = async () => {
  const fakes = fakePorts();
  const core = new AskCore({
    ...fakes.ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
  });
  const heard: Parameters<Parameters<AskCore["subscribe"]>[0]>[0][] = [];
  const outcome = await core.ask(copyOf(uj2Ask) as unknown as Parameters<AskCore["ask"]>[0]);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  core.subscribe((event) => heard.push(event));
  return { core, heard };
};

let n = 0;
const answerWith = (fields: Json) => {
  n += 1;
  return {
    actionId: actionId(n),
    acts: [{ type: "answer", itemId: "plan", rev: 1, when: WHEN, ...fields }],
  };
};
type Act = Parameters<AskCore["act"]>[1];
const send = (core: AskCore, fields: Json) =>
  core.act(ASK_ID, answerWith(fields) as unknown as Act);

const edited = (): Json => copyOf(uj2ExpandedEditedValues) as Json;

const refusedWith = async (fields: Json, detail: string) => {
  const { core, heard } = await setup();
  const outcome = send(core, fields);
  expect(outcome.ok).toBe(false);
  expect(JSON.stringify(outcome)).toContain(detail);
  expect(logOf(core, ASK_ID)).toEqual([]);
  expect(appendedOf(heard)).toEqual([]);
};

describe("widget values in an answer act", () => {
  test("the approved edits and derived values are accepted and append one answer event", async () => {
    const { core, heard } = await setup();
    const outcome = send(core, { values: edited(), derived: copyOf(uj2ExpandedDerived) });
    expect(outcome.ok).toBe(true);
    expect(appendedOf(heard)).toHaveLength(1);
  });

  test("a key naming an item of another question is refused naming the item", async () => {
    await refusedWith({ values: { "no-such-item": {} } }, "no-such-item");
  });

  test("an inherited name such as constructor is refused", async () => {
    await refusedWith({ values: JSON.parse('{"constructor": {"nodes": []}}') }, "constructor");
    await refusedWith({ values: JSON.parse('{"__proto__": {"nodes": []}}') }, "__proto__");
  });

  test("a value that is no object is refused naming the item", async () => {
    await refusedWith({ values: { [TREE]: "text" } }, TREE);
  });

  test("a Tree value whose node has no label is refused naming the item", async () => {
    const values = edited();
    const tree = values[TREE] as { nodes: { label?: string }[] };
    delete tree.nodes[0]?.label;
    await refusedWith({ values }, TREE);
  });

  test("a plan whose edited link names an item that is no Tree is refused", async () => {
    const values = edited();
    (values[PLAN] as Json).workPackages = "erp-export";
    await refusedWith({ values }, PLAN);
  });

  test("values equal to what was sent are no content, even beside derived values", async () => {
    const { core } = await setup();
    const [question] = core.board(ASK_ID)?.document.items ?? [];
    const sent = (question as unknown as { props: { items: Json[] } }).props.items;
    const same = Object.fromEntries(sent.map((item) => [item.id as string, item.props]));
    await refusedWith(
      { values: copyOf(same), derived: { [`${PLAN}.finish`]: "2026-12-02" } },
      "content",
    );
  });

  test("an answer whose only content is derived values is refused", async () => {
    await refusedWith({ derived: { [`${PLAN}.finish`]: "2026-12-02" } }, "content");
  });
});

describe("derived values in an answer act", () => {
  test("a field no widget declares is refused naming the key", async () => {
    await refusedWith({ values: edited(), derived: { [`${PLAN}.margin`]: 3 } }, `${PLAN}.margin`);
  });

  test("a key of no item of the question is refused", async () => {
    await refusedWith(
      { values: edited(), derived: { "other.finish": "2026-12-02" } },
      "other.finish",
    );
  });

  test("a node that is not in the Tree is refused", async () => {
    await refusedWith({ values: edited(), derived: { [`${TREE}.ghost.expected`]: 1 } }, "ghost");
  });

  test("a value that is not JSON is refused", async () => {
    const { core } = await setup();
    const outcome = send(core, { values: edited(), derived: { [`${PLAN}.finish`]: undefined } });
    expect(outcome.ok).toBe(false);
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test("derived of an untouched plan is admitted beside values for the Tree alone", async () => {
    const { core, heard } = await setup();
    const values = { [TREE]: edited()[TREE] };
    const derived = {
      [`${TREE}.expected`]: 40,
      [`${PLAN}.finish`]: "2026-12-02",
      [`${PLAN}.criticalPath`]: ["ux"],
    };
    expect(send(core, { values, derived }).ok).toBe(true);
    expect(appendedOf(heard)).toHaveLength(1);
  });
});
