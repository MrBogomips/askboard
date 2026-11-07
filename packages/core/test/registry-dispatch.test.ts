import { describe, expect, test } from "bun:test";
import { type QuestionProps, WIDGET_TYPES } from "@askboard/contract";
import { PROBE_SESSION, PROBE_TYPES } from "@askboard/contract/fixtures";
import { fetchItemOf } from "../src/context/fetch-item.ts";
import { formulaWarnings } from "../src/graph-check.ts";
import type { BoardModel } from "../src/lifecycle/model.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { holderOf, type WidgetUpdate } from "../src/lifecycle/widget-update.ts";
import { isWidgetProblem, widgetContentOf } from "../src/lifecycle/widget-values.ts";
import { modelOf, PROBE_ITEM } from "./probe-fakes.ts";

// Core spec: ask-core dispatches on the widget-type registry (widget-registry design decision 2):
// the probe type, which only the registry holds, is found, checked, diffed, fetched and held by its
// entry; Tree and Gantt keep their outcomes; a board with no computing type builds no graph.

const props = (model: BoardModel): QuestionProps =>
  model.propsOf(model.question("choose") as never);
const content = (act: Record<string, unknown>, model: BoardModel, types = PROBE_TYPES) =>
  widgetContentOf(act, props(model), types);

const withOptions = (...ids: string[]) => ({
  options: ids.map((id) => ({ id, label: id.toUpperCase() })),
});

describe("values and derived keys of a probe item", () => {
  test("an edited probe value is checked by its entry and diffed by its shape", () => {
    const model = modelOf([PROBE_ITEM]);
    const edited = withOptions("a", "b", "c");
    const checked = content({ values: { pick: edited } }, model);
    if (isWidgetProblem(checked)) throw new Error(checked.detail);
    expect(checked.values).toEqual({ pick: edited });
    expect(checked.sent.map(({ id }) => id)).toEqual(["pick"]);
  });

  test("a probe value its entry refuses is refused naming the item and the reason", () => {
    const model = modelOf([PROBE_ITEM]);
    const checked = content({ values: { pick: withOptions("a", "a") } }, model);
    expect(isWidgetProblem(checked) && checked.detail).toContain('item "pick"');
    expect(isWidgetProblem(checked) && checked.detail).toContain("unique IDs");
  });

  test("a probe's derived key is checked by its declaration", () => {
    const model = modelOf([PROBE_ITEM]);
    expect(isWidgetProblem(content({ derived: { "pick.count": 2 } }, model))).toBe(false);
    const wrong = content({ derived: { "pick.total": 2 } }, model);
    expect(isWidgetProblem(wrong) && wrong.detail).toContain("a probe declares count");
  });

  test("a type the registry does not hold is no widget item of the question", () => {
    const model = modelOf([PROBE_ITEM]);
    const checked = content({ values: { pick: withOptions("a") } }, model, WIDGET_TYPES);
    expect(isWidgetProblem(checked) && checked.detail).toContain('"pick"');
    expect(isWidgetProblem(checked) && checked.detail).toContain(
      "no Tree, Gantt, Approval or Scale item",
    );
  });

  test("the refusal names the registry's own types", () => {
    const model = modelOf([PROBE_ITEM]);
    const checked = content({ values: { nothing: {} } }, model);
    expect(isWidgetProblem(checked) && checked.detail).toContain(
      "no Tree, Gantt, Approval, Scale or Probe item",
    );
  });

  test("a derived key of an item whose type declares none is refused", () => {
    const bare = { ...PROBE_TYPES.at(-1), derived: undefined } as never;
    const model = modelOf([PROBE_ITEM]);
    const checked = content({ derived: { "pick.count": 2 } }, model, [bare]);
    expect(isWidgetProblem(checked) && checked.detail).toContain("declares no derived values");
  });
});

describe("a probe item, held and fetched as left", () => {
  const status = (model: BoardModel) =>
    questionStatus(model.question(PROBE_SESSION.question)?.mark, []);

  test("a probe item is held by the question as sent", () => {
    const model = modelOf([PROBE_ITEM]);
    const [first] = (props(model) as unknown as { items: unknown[] }).items;
    expect(first).toEqual(PROBE_ITEM);
    const question = model.boardQuestion(model.question("choose") as never);
    expect(JSON.stringify(question)).toContain('"probe"');
  });

  test("a probe item alone is fetched as the user left it", () => {
    const model = modelOf([PROBE_ITEM]);
    const kept = new Map();
    const found = widgetItemValue(
      model,
      "pick",
      () => status(model),
      { map: new Map(), source: undefined, kept },
      PROBE_TYPES,
    );
    expect(found?.item).toMatchObject({
      type: "probe",
      id: "pick",
      questionId: "choose",
      props: PROBE_ITEM.props,
      state: "open",
    });
  });

  test("with the shipped registry the probe item is no widget item", () => {
    const model = modelOf([PROBE_ITEM]);
    const found = widgetItemValue(model, "pick", () => status(model), {
      map: new Map(),
      source: undefined,
      kept: new Map(),
    });
    expect(found).toBeUndefined();
  });

  test("the update's holder of a probe item is found through the registry", () => {
    const model = modelOf([PROBE_ITEM]);
    const widgets: WidgetUpdate = {
      source: undefined,
      expansion: new Map(),
      references: new Map(),
    };
    expect(holderOf(model, widgets, "pick", PROBE_TYPES)?.item.id).toBe("pick");
    expect(holderOf(model, widgets, "pick")).toBeUndefined();
  });

  test("a probe item in a question's fetch value passes through unchanged", () => {
    const model = modelOf([PROBE_ITEM]);
    const value = fetchItemOf(
      model.boardQuestion(model.question("choose") as never) as never,
    ) as unknown as { props: { items: unknown[] } };
    expect(value.props.items).toEqual([PROBE_ITEM]);
  });
});

// A Gantt whose task names a predecessor that is no task: the graph warns of it.
const brokenGantt = {
  type: "question",
  id: "q",
  props: {
    text: "Plan",
    items: [
      {
        type: "gantt",
        id: "plan",
        props: { start: "2026-01-05", tasks: [{ id: "a", duration: 1, dependencies: ["zz"] }] },
      },
    ],
  },
};

describe("the send-time graph check", () => {
  test("it runs when a registered type declares derived values", () => {
    const warnings = formulaWarnings([brokenGantt], new Map());
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatchObject({ code: "formula" });
  });

  test("it builds no graph when no registered type declares derived values", () => {
    const none = WIDGET_TYPES.map((entry) => ({ ...entry, derived: undefined }));
    expect(formulaWarnings([brokenGantt], new Map(), none as never)).toEqual([]);
  });

  test("a Choice-only ask builds no graph and warns nothing", () => {
    const choice = {
      type: "question",
      id: "q",
      props: { text: "Which?", options: [{ label: "A" }] },
    };
    expect(formulaWarnings([choice], new Map())).toEqual([]);
  });
});
