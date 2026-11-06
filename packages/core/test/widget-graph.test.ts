import { describe, expect, test } from "bun:test";
import { AskCore } from "../src/index.ts";
import { coreWith, fakePorts, plainChoiceAsk } from "./fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";

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
  test("a predecessor that names no task warns with the references, never the expanded IDs", async () => {
    const warnings = await warningsOf(sentWith({ billing: ["review"] }));
    const formula = warnings.filter((warning) => warning.code === "formula");
    expect(formula).toHaveLength(1);
    expect(formula[0]).toMatchObject({
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
