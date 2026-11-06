import { describe, expect, test } from "bun:test";
import { uj2ExpandedQuestion } from "@askboard/contract/fixtures";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";

// Core spec: Molecules expanded when an ask is sent (widget-answers design decision 5), with a
// fake `MoleculeSource` over the two shipped definitions.

const widgetCore = (source = fakeMoleculeSource([wbsPert, ganttPlan]).source) => {
  const fakes = fakePorts();
  const core = new AskCore({ ...fakes.ports, molecules: source });
  return { core, ...fakes };
};

const askOf = () => copyOf(uj2Ask) as unknown as Parameters<AskCore["ask"]>[0];

describe("expansion on ask", () => {
  test("the UJ-2 ask's board document holds the expanded items and no molecule item", async () => {
    const { core } = widgetCore();
    const outcome = await core.ask(askOf());
    expect(outcome.kind).toBe("created");
    const [plan] = core.board(uj2Ask.askId)?.document.items ?? [];
    expect(plan).toEqual({ ...uj2ExpandedQuestion, rev: 1 });
    expect(JSON.stringify(core.board(uj2Ask.askId)?.document)).not.toContain('"molecule"');
  });

  test("an unknown molecule refuses naming the reference, and creates nothing", async () => {
    const { core, calls } = widgetCore();
    const request = askOf() as unknown as {
      items: { props: { items: { props: { molecule: string } }[] } }[];
    };
    const [first] = request.items[0]?.props.items ?? [];
    if (first !== undefined) first.props.molecule = "org-chart";
    const outcome = await core.ask(request);
    expect(outcome.kind).toBe("invalid");
    const problems = outcome.kind === "invalid" ? outcome.problems : [];
    expect(problems[0]).toMatchObject({
      itemId: "wbs",
      path: "/items/0/props/items/0/props/molecule",
    });
    expect(problems[0]?.message).toContain('"org-chart"');
    expect(problems[0]?.message).toContain("gantt-plan");
    expect(core.board(uj2Ask.askId)).toBeUndefined();
    expect(calls.filter((call) => call.startsWith("link") || call === "open")).toEqual([]);
  });

  test("an identical resend returns the same board, other data is refused as in use", async () => {
    const { core } = widgetCore();
    const first = await core.ask(askOf());
    const again = await core.ask(askOf());
    expect(again.kind).toBe("resent");
    expect(again.kind === "resent" && first.kind === "created" ? again.ask.board : "").toBe(
      first.kind === "created" ? first.ask.board : "x",
    );
    const other = askOf() as unknown as {
      items: { props: { items: { props: { data: { nodes: { label: string }[] } } }[] } }[];
    };
    const node = other.items[0]?.props.items[0]?.props.data.nodes[0];
    if (node !== undefined) node.label = "Changed";
    expect((await core.ask(other)).kind).toBe("in-use");
  });

  test("a session without a molecule source refuses a reference as one AskBoard does not ship", async () => {
    const fakes = fakePorts();
    const core = new AskCore(fakes.ports);
    const outcome = await core.ask(askOf());
    expect(outcome.kind).toBe("invalid");
  });
});
