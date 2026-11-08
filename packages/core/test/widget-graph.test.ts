import { describe, expect, test } from "bun:test";
import { boardGraphSource, buildGraph } from "@askboard/compute";
import { GANTT_MAX_PREDECESSORS, GANTT_MAX_TASKS, RESULT_MAX_CHARS } from "@askboard/contract";
import { FORMULA_WARNINGS_MAX_CHARS } from "../src/graph-check.ts";
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

// Core spec, The send-time graph check ("Warnings past the bound", "The worst plan the contract
// admits", "Under the bound") and "An update that replaces the work packages"; design decision 4.

type Json = Record<string, unknown>;

const longId = (kind: string, n: number): string =>
  `${kind}${String(n).padStart(64 - kind.length, "0")}`;

const leaf = (id: string): Json => ({
  id,
  label: id.slice(0, 20),
  optimistic: 1,
  mostLikely: 2,
  pessimistic: 3,
});

const ESTIMATE_COLUMNS = ["optimistic", "mostLikely", "pessimistic"].map((field) => ({
  field,
  label: field,
  type: "number",
}));

const planAsk = (leaves: readonly string[], tasks: Json): Parameters<AskCore["ask"]>[0] =>
  ({
    askId: "bound-plan-k2m9",
    title: "A plan",
    delivery: "submitted",
    items: [
      {
        type: "question",
        id: "plan",
        props: {
          text: "Does this fit?",
          items: [
            {
              type: "tree",
              id: "wbs",
              props: { pert: true, columns: ESTIMATE_COLUMNS, nodes: leaves.map(leaf) },
            },
            {
              type: "gantt",
              id: "schedule",
              props: { workPackages: "wbs", start: "2026-11-02", tasks },
            },
          ],
        },
      },
    ],
  }) as unknown as Parameters<AskCore["ask"]>[0];

const unknownPredecessors = (leaves: readonly string[], per: number, kind = "u"): Json =>
  Object.fromEntries(
    leaves.map((id, i) => [
      id,
      { dependencies: Array.from({ length: per }, (_, k) => longId(kind, i * per + k)) },
    ]),
  );

const formulaOf = (warnings: readonly { code: string }[] | undefined) =>
  (warnings ?? []).filter((warning) => warning.code === "formula") as unknown as readonly {
    code: "formula";
    itemId: string;
    address: string;
    error: string;
    message: string;
  }[];

const createdWith = async (request: Parameters<AskCore["ask"]>[0]) => {
  const core = new AskCore(fakePorts().ports);
  const outcome = await core.ask(request);
  if (outcome.kind !== "created")
    throw new Error(`not created: ${JSON.stringify(outcome).slice(0, 600)}`);
  return { core, outcome };
};

const sentPlanAgain = (core: AskCore, tasks: Json) =>
  core.update({
    askId: "bound-plan-k2m9",
    actions: [{ action: "change", itemId: "schedule", props: { tasks } }],
  } as unknown as Parameters<AskCore["update"]>[0]);

describe("the send-time warnings are bounded", () => {
  test("warnings past the bound: the plan's warning first, the rest counted, the text within 10,000 characters", async () => {
    const leaves = Array.from({ length: 60 }, (_, i) => `leaf-${i}`);
    const request = planAsk(leaves, unknownPredecessors(leaves, 5));
    const sent = request as unknown as { items: { props: { items: unknown[] } }[] };
    const graph = buildGraph(boardGraphSource(sent.items[0]?.props.items as never)).warnings;
    expect(JSON.stringify(graph).length).toBeGreaterThan(FORMULA_WARNINGS_MAX_CHARS);
    const { outcome } = await createdWith(request);
    const warnings = formulaOf(outcome.warnings);
    expect(JSON.stringify(warnings).length).toBeLessThanOrEqual(FORMULA_WARNINGS_MAX_CHARS);
    expect(warnings[0]?.address).toBe(`schedule.${graph[0]?.address.split(".")[1]}`);
    expect(warnings[0]?.message).toContain("the plan names");
    const closing = warnings[warnings.length - 1];
    const left = Number(
      /and (\d+) more formula warnings are left out\.$/.exec(closing?.message ?? "")?.[1],
    );
    expect(left).toBeGreaterThan(0);
    // The kept ones, the closing one that stands for the next, and the count after it.
    expect(warnings.length + left).toBe(graph.length);
    // The closing warning stands for the first problem left out.
    expect(closing).toMatchObject({ address: graph[warnings.length - 1]?.address });
  });

  test("under the bound: the UJ-2 ask with one unknown predecessor has no closing warning", async () => {
    const warnings = formulaOf(await warningsOf(sentWith({ billing: ["review"] })));
    expect(warnings).toHaveLength(2);
    expect(JSON.stringify(warnings)).not.toContain("left out");
  });

  test("an update that replaces the work packages warns once, naming five old IDs and counting 145", async () => {
    const old = Array.from({ length: 150 }, (_, i) => `old-${i}`);
    const { core } = await createdWith(
      planAsk(old, Object.fromEntries(old.map((id) => [id, { dependencies: [] }]))),
    );
    const fresh = Array.from({ length: 150 }, (_, i) => `new-${i}`);
    const outcome = await core.update({
      askId: "bound-plan-k2m9",
      actions: [{ action: "change", itemId: "wbs", props: { nodes: fresh.map(leaf) } }],
    } as unknown as Parameters<AskCore["update"]>[0]);
    expect(outcome.kind).toBe("updated");
    const warnings = formulaOf(outcome.kind === "updated" ? outcome.warnings : []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ itemId: "schedule", address: "schedule.old-0" });
    expect(warnings[0]?.message).toContain("old-0, old-1, old-2, old-3, old-4 and 145 more IDs");
    expect(warnings[0]?.message).toContain("wbs");
    expect(JSON.stringify(outcome).length).toBeLessThan(RESULT_MAX_CHARS);
  });

  test("the worst plan the contract admits is accepted on ask and on update, each under the result limit", async () => {
    const leaves = Array.from({ length: GANTT_MAX_TASKS }, (_, i) => longId("l", i));
    const tasks = unknownPredecessors(leaves, GANTT_MAX_PREDECESSORS);
    const { core, outcome } = await createdWith(planAsk(leaves, tasks));
    expect(JSON.stringify(outcome).length).toBeLessThan(RESULT_MAX_CHARS);
    const warnings = formulaOf(outcome.warnings);
    expect(JSON.stringify(warnings).length).toBeLessThanOrEqual(FORMULA_WARNINGS_MAX_CHARS);
    expect(warnings[warnings.length - 1]?.message).toMatch(/more formula warnings are left out\.$/);
    const again = await sentPlanAgain(core, tasks);
    expect(again.kind).toBe("updated");
    expect(JSON.stringify(again).length).toBeLessThan(RESULT_MAX_CHARS);
  });
});
