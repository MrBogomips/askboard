import { describe, expect, mock, test } from "bun:test";
import {
  ganttBoardDocument,
  ganttEditedValue,
  lifecycleBoardDocument,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import { CHOICE, componentsOf, renderedOf } from "./components.ts";
import {
  type BoardContent,
  type CatalogComponent,
  componentFor,
  type DerivedValues,
  type ItemProps,
  readyEffect,
  register,
  registeredComponents,
} from "./port.ts";

// A test-only widget item and its value, with arbitrary props, never a real widget's (design
// decision 12).
type ProbeItem = {
  readonly type: "probe";
  readonly id: string;
  readonly props: { readonly size: number };
};
type ProbeValue = { readonly size: number };
const Probe: CatalogComponent<ProbeItem, ProbeValue> = ({ item, value }) =>
  `${item.id}:${value?.size ?? item.props.size}`;

// Test-only board documents: the plain question with a `probe` widget item, and a question that
// holds only one (design decision 12).
const [question] = plainChoiceBoardDocument.items;
const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };
const withItems = (
  items: readonly WidgetItem[],
  options = true,
): ViewDocument & { readonly items: readonly [ViewQuestion] } => {
  const { options: kept, ...props } = question.props;
  return {
    ...plainChoiceBoardDocument,
    items: [{ ...question, props: { ...props, ...(options ? { options: kept } : {}), items } }],
  };
};

describe("which component renders an item (AD-9, design decision 7)", () => {
  test("a plain question renders its options with the Choice atom", () => {
    expect(renderedOf(question)).toEqual([{ item: question, component: CHOICE }]);
    expect(CHOICE).toBe("choice");
  });

  test("a widget item renders with the component its type names, after the options", () => {
    const [both] = withItems([sketch]).items;
    expect(renderedOf(both)).toEqual([
      { item: both, component: "choice" },
      { item: sketch, component: "probe" },
    ]);
    const [only] = withItems([sketch], false).items;
    expect(renderedOf(only)).toEqual([{ item: sketch, component: "probe" }]);
  });

  test("a widget item typed question is no question: its type names its component", () => {
    const nested = { type: "question", id: "nested", props: {} };
    const [holding] = withItems([nested], false).items;
    expect(renderedOf(holding)).toEqual([{ item: nested, component: "question" }]);
  });

  test("a Gantt item renders with the component gantt, by its type (gantt-widget design decision 10)", () => {
    const [schedule] = ganttBoardDocument.items;
    const [release] = schedule.props.items;
    expect(renderedOf(schedule)).toEqual([{ item: release, component: "gantt" }]);
    expect(componentsOf(ganttBoardDocument)).toEqual(["gantt"]);
  });

  test("a board needs each component once", () => {
    expect(componentsOf(plainChoiceBoardDocument)).toEqual(["choice"]);
    expect(componentsOf(withItems([sketch, { ...sketch, id: "second" }]))).toEqual([
      "choice",
      "probe",
    ]);
    expect(componentsOf(withItems([sketch], false))).toEqual(["probe"]);
  });
});

describe("a Markdown option preview needs the Text atom's chunk (atoms, design decision 5)", () => {
  const withOptions = (options: unknown[]): ViewDocument => {
    const { items } = plainChoiceBoardDocument;
    return {
      ...plainChoiceBoardDocument,
      items: items.map((one) => ({ ...one, props: { ...one.props, options } })),
    } as unknown as ViewDocument;
  };

  test("a question holding an option marked as Markdown adds text, once, beside choice", () => {
    const markdown = { label: "A", preview: "`code`", previewFormat: "markdown" };
    expect(componentsOf(withOptions([markdown, { ...markdown, label: "B" }]))).toEqual([
      "choice",
      "text",
    ]);
  });

  test("a plain preview, a format with no preview and no preview add nothing", () => {
    expect(
      componentsOf(withOptions([{ label: "A", preview: "x", previewFormat: "plain" }])),
    ).toEqual(["choice"]);
    expect(componentsOf(withOptions([{ label: "A", preview: "x" }]))).toEqual(["choice"]);
    expect(componentsOf(withOptions([{ label: "A", previewFormat: "markdown" }]))).toEqual([
      "choice",
    ]);
    expect(componentsOf(withOptions([{ label: "A" }]))).toEqual(["choice"]);
  });

  test("it renders no item of its own: renderedOf is unchanged", () => {
    const markdown = { label: "A", preview: "x", previewFormat: "markdown" };
    const [first] = (withOptions([markdown]) as unknown as { items: [ViewQuestion] }).items;
    expect(renderedOf(first)).toEqual([{ item: first, component: "choice" }]);
  });

  test("a Markdown Text item and a Markdown preview together still name text once", () => {
    const markdown = { label: "A", preview: "x", previewFormat: "markdown" };
    const document = withOptions([markdown]) as unknown as { items: [ViewQuestion] };
    const text: WidgetItem = { type: "text", id: "intro", props: { text: "a" } };
    const [first] = document.items;
    const both = { ...document, items: [{ ...first, props: { ...first.props, items: [text] } }] };
    expect(componentsOf(both as unknown as ViewDocument)).toEqual(["choice", "text"]);
  });
});

describe("the CatalogRenderer port", () => {
  const component: CatalogComponent = () => null;

  test("a registered component is found by its name", () => {
    register("test-widget", component);
    expect(componentFor("test-widget")).toBe(component);
    expect(registeredComponents()).toContain("test-widget");
  });

  test("an unknown name, an inherited one included, finds nothing", () => {
    expect(componentFor("test-unknown")).toBeUndefined();
    expect(componentFor("constructor")).toBeUndefined();
  });

  test("a second registration of one name fails, naming it", () => {
    register("test-twice", component);
    expect(() => register("test-twice", component)).toThrow('"test-twice"');
  });
});

describe("the port carries any item and any value (design decision 7)", () => {
  test("a component typed by its own item and value registers", () => {
    register("test-probe", Probe);
    expect(componentFor("test-probe") as unknown).toBe(Probe);
  });

  test("it gets the item, its question's ID and its value, undefined while untouched", () => {
    const seen: ItemProps<ProbeItem, ProbeValue>[] = [];
    register<ProbeItem, ProbeValue>("test-probe-props", (props) => {
      seen.push(props);
      return null;
    });
    const changes: unknown[] = [];
    const props: ItemProps = {
      item: { type: "probe", id: "sketch", props: { size: 3 } },
      questionId: "plan",
      value: undefined,
      onValueChange: (value) => changes.push(value),
      onValuesChange: (values) => changes.push(values),
      result: undefined,
      onResultChange: () => {},
      disabled: false,
      ready: () => {},
      board: { items: [], draft: new Map(), shown: new Map() },
      onDerived: () => {},
      entry: undefined,
      onEntryChange: () => {},
    };
    componentFor("test-probe-props")?.(props);
    const [got] = seen;
    expect(got?.item.props.size).toBe(3);
    expect(got?.questionId).toBe("plan");
    expect(got?.value).toBeUndefined();
    got?.onValueChange({ size: 4 });
    got?.onValueChange(undefined);
    expect(changes).toEqual([{ size: 4 }, undefined]);
  });

  test("it puts several items of its question in one update, undefined removing one (molecules, design decision 11)", () => {
    const seen: ItemProps<ProbeItem, ProbeValue>[] = [];
    register<ProbeItem, ProbeValue>("test-probe-linked", (props) => {
      seen.push(props);
      return null;
    });
    const updates: Readonly<Record<string, unknown>>[] = [];
    componentFor("test-probe-linked")?.({
      item: sketch,
      questionId: "plan",
      value: undefined,
      onValueChange: () => {},
      onValuesChange: (values) => updates.push(values),
      result: undefined,
      onResultChange: () => {},
      disabled: false,
      ready: () => {},
      board: { items: [sketch], draft: new Map(), shown: new Map() },
      onDerived: () => {},
      entry: undefined,
      onEntryChange: () => {},
    });
    seen[0]?.onValuesChange({ sketch: { size: 4 }, second: undefined });
    expect(updates).toEqual([{ sketch: { size: 4 }, second: undefined }]);
  });
});

describe("the port gives a component its board and takes its derived values (gantt-widget design decisions 7 and 10)", () => {
  test("it gets the board's items as sent and the draft record, and reports derived values", () => {
    const seen: ItemProps<WidgetItem>[] = [];
    register<WidgetItem, unknown>("test-board", (props) => {
      seen.push(props);
      return null;
    });
    const [schedule] = ganttBoardDocument.items;
    const [release] = schedule.props.items;
    const draft = new Map([["release", ganttEditedValue]]);
    const board: BoardContent = { items: [release], draft, shown: draft };
    const reports: DerivedValues[] = [];
    componentFor("test-board")?.({
      item: release,
      questionId: schedule.id,
      value: ganttEditedValue,
      onValueChange: () => {},
      onValuesChange: () => {},
      result: undefined,
      onResultChange: () => {},
      disabled: false,
      ready: () => {},
      board,
      onDerived: (values) => reports.push(values),
      entry: undefined,
      onEntryChange: () => {},
    });
    const [got] = seen;
    expect(got?.board.items).toEqual([release]);
    expect(got?.board.draft.get("release")).toBe(ganttEditedValue);
    got?.onDerived({ "release.finish": "2026-12-16", "release.criticalPath": ["reporting"] });
    expect(reports).toEqual([
      { "release.finish": "2026-12-16", "release.criticalPath": ["reporting"] },
    ]);
  });
});

describe("a component reports ready after its content is laid out (AD-9)", () => {
  const frames = () => {
    const pending = new Map<number, () => void>();
    let next = 0;
    const request = mock((callback: () => void) => {
      next += 1;
      pending.set(next, callback);
      return next;
    });
    const cancel = mock((id: number) => {
      pending.delete(id);
    });
    const run = () => {
      for (const [id, callback] of [...pending]) {
        pending.delete(id);
        callback();
      }
    };
    return { request, cancel, run };
  };

  test("once settled, on the next frame, not during the layout effect", () => {
    const { request, cancel, run } = frames();
    const ready = mock(() => {});
    readyEffect(ready, true, request, cancel)();
    expect(ready).not.toHaveBeenCalled();
    run();
    expect(ready).toHaveBeenCalledTimes(1);
  });

  test("not while its asynchronous work has not settled", () => {
    const { request, cancel, run } = frames();
    const ready = mock(() => {});
    expect(readyEffect(ready, false, request, cancel)()).toBeUndefined();
    run();
    expect(request).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });

  test("not once the component is gone before the frame", () => {
    const { request, cancel, run } = frames();
    const ready = mock(() => {});
    readyEffect(ready, true, request, cancel)()?.();
    run();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
  });
});

describe("a board of several questions or of areas (ask-lifecycle, design decision 6)", () => {
  test("the components of every question, areas' included, each once", () => {
    expect(componentsOf(lifecycleBoardDocument)).toEqual(["choice"]);
    const [area] = lifecycleBoardDocument.items;
    const mixed: ViewDocument = {
      ...lifecycleBoardDocument,
      items: [
        area,
        {
          type: "area",
          id: "later",
          props: { title: "Later", items: [withItems([sketch], false).items[0]] },
        },
      ],
    } as ViewDocument;
    expect(componentsOf(mixed)).toEqual(["choice", "probe"]);
  });
});
