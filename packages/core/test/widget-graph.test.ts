import { describe, expect, test } from "bun:test";
import { AskCore } from "../src/index.ts";
import { coreWith, fakePorts, plainChoiceAsk } from "./fakes.ts";
import {
  copyOf,
  fakeMoleculeSource,
  ganttPlan,
  scheduleData,
  uj2Ask,
  wbsData,
  wbsPert,
} from "./molecules.ts";

// Core spec: The send-time graph check (widget-answers design decision 5).

type Dependencies = Record<string, readonly string[]>;
type Request = {
  items: { props: { items: { props: { data: { dependencies: Dependencies } } }[] } }[];
};

const sentWith = (dependencies: Dependencies) => {
  const request = copyOf(uj2Ask) as unknown as Request;
  const schedule = request.items[0]?.props.items[1];
  if (schedule !== undefined) Object.assign(schedule.props.data.dependencies, dependencies);
  return request as unknown as Parameters<AskCore["ask"]>[0];
};

const widgetCore = () =>
  new AskCore({
    ...fakePorts().ports,
    molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
  });

const warningsOf = async (request: Parameters<AskCore["ask"]>[0]) => {
  const outcome = await widgetCore().ask(request);
  if (outcome.kind !== "created") throw new Error(`not created: ${JSON.stringify(outcome)}`);
  return outcome.warnings ?? [];
};

describe("the send-time graph check", () => {
  test("a predecessor that names no task warns twice, with the references, never the expanded IDs", async () => {
    const warnings = await warningsOf(sentWith({ billing: ["review"] }));
    const formula = warnings.filter((warning) => warning.code === "formula");
    expect(formula).toHaveLength(2);
    expect(formula[0]).toMatchObject({ address: "schedule.review", error: "missing-reference" });
    expect(formula[1]).toMatchObject({
      address: "schedule.billing.es",
      error: "missing-reference",
    });
    for (const warning of formula) {
      expect(warning).toMatchObject({ code: "formula", itemId: "schedule" });
      expect(warning.code === "formula" ? warning.address : "").toStartWith("schedule.");
    }
    const text = JSON.stringify(formula);
    expect(text).toContain("review");
    expect(text).not.toContain("schedule__plan");
    expect(text).not.toContain("wbs__tree");
  });

  test("an entry that names no work package warns, naming the plan and the entry", async () => {
    const warnings = await warningsOf(sentWith({ review: ["ux"] }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "formula",
      itemId: "schedule",
      address: "schedule.review",
      error: "missing-reference",
    });
    const text = JSON.stringify(warnings);
    expect(text).toContain("schedule");
    expect(text).toContain("review");
    expect(text).toContain("wbs");
    expect(text).not.toContain("schedule__plan");
    expect(text).not.toContain("wbs__tree");
  });

  test("a cycle warns with kind cycle and the ask is still created", async () => {
    const warnings = await warningsOf(sentWith({ portal: ["reporting"], reporting: ["portal"] }));
    expect(
      warnings.some((warning) => warning.code === "formula" && warning.error === "cycle"),
    ).toBe(true);
  });

  test("the approved UJ-2 ask warns nothing", async () => {
    expect(await warningsOf(copyOf(uj2Ask) as unknown as Parameters<AskCore["ask"]>[0])).toEqual(
      [],
    );
  });

  test("a plain-choice ask builds no graph and warns nothing new", async () => {
    const { core } = coreWith();
    const outcome = await core.ask(plainChoiceAsk());
    expect(outcome.kind === "created" ? outcome.warnings : "x").toBeUndefined();
  });
});

type Node = { id: string; children?: Node[] };
type Updated = Awaited<ReturnType<AskCore["update"]>>;

const withoutBilling = (): unknown => {
  const data = copyOf(wbsData) as unknown as { nodes: Node[] };
  for (const node of data.nodes) {
    if (node.children !== undefined)
      node.children = node.children.filter(({ id }) => id !== "billing");
  }
  return data;
};

const changeOf = (itemId: string, data: unknown) => ({ action: "change", itemId, props: { data } });

const sentUpdate = async (core: AskCore, actions: unknown[]): Promise<Updated> =>
  core.update({ askId: uj2Ask.askId, actions } as unknown as Parameters<AskCore["update"]>[0]);

const formulaWarnings = (outcome: Updated) =>
  (outcome.kind === "updated" ? (outcome.warnings ?? []) : []).filter(
    (warning) => warning.code === "formula",
  );

describe("a plan that names no work package, on update", () => {
  const askedCore = async () => {
    const core = widgetCore();
    const created = await core.ask(copyOf(uj2Ask) as unknown as Parameters<AskCore["ask"]>[0]);
    if (created.kind !== "created") throw new Error(created.kind);
    return core;
  };

  test("a Tree sent without billing warns at the plan's entry, and the plan keeps the entry", async () => {
    const core = await askedCore();
    const outcome = await sentUpdate(core, [changeOf("wbs", withoutBilling())]);
    expect(outcome.kind).toBe("updated");
    const warnings = formulaWarnings(outcome);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      itemId: "schedule",
      address: "schedule.billing",
      error: "missing-reference",
    });
    const text = JSON.stringify(warnings);
    expect(text).toContain("wbs");
    expect(text).toContain("billing");
    expect(text).not.toContain("schedule__plan");
    expect(text).not.toContain("wbs__tree");
    expect(JSON.stringify(core.fullValue(uj2Ask.askId, "schedule"))).toContain("billing");
  });

  test("a second change that drops the entry too leaves no warning about billing", async () => {
    const core = await askedCore();
    const { billing: _gone, ...dependencies } = (
      scheduleData as unknown as { dependencies: Record<string, string[]> }
    ).dependencies;
    const outcome = await sentUpdate(core, [
      changeOf("wbs", withoutBilling()),
      changeOf("schedule", { ...scheduleData, dependencies }),
    ]);
    expect(outcome.kind).toBe("updated");
    expect(JSON.stringify(formulaWarnings(outcome))).not.toContain("billing");
  });
});
