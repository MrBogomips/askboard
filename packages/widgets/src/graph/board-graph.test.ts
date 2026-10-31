import { describe, expect, test } from "bun:test";
import { GraphSourceError } from "@askboard/compute";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { type BoardContent, type BoardContentItem, liveGraph, sentGraph } from "./board-graph.ts";

// The board's widget items as sent, every question's items flattened, as the port will give them.
const ITEMS = ganttBoardDocument.items.flatMap((question) => question.props.items);
const NOTHING: ReadonlyMap<string, unknown> = new Map();
const EDITED: ReadonlyMap<string, unknown> = new Map([["release", ganttEditedValue]]);

const board = (
  draft: ReadonlyMap<string, unknown>,
  items: readonly BoardContentItem[] = ITEMS,
): BoardContent => ({
  items,
  draft,
});

describe("the board's graph", () => {
  test("schedules the Gantt as sent", () => {
    const graph = sentGraph(board(NOTHING));
    expect(graph?.read("release.reporting.startDate")).toBe("2026-12-04");
    expect(graph?.read("release.reporting.finishDate")).toBe("2026-12-11");
    expect(graph?.read("release.finishDate")).toBe("2026-12-11");
    expect(graph?.warnings).toEqual([]);
  });

  test("schedules the live Gantt with the draft's value in place of its props", () => {
    const live = liveGraph(board(EDITED));
    expect(live?.read("release.reporting.startDate")).toBe("2026-12-09");
    expect(live?.read("release.reporting.earliestDate")).toBe("2026-12-04");
    expect(live?.read("release.billing.duration")).toBe(11);
    expect(live?.read("release.finishDate")).toBe("2026-12-16");
    // The sent graph of the same board still reads the agent's props.
    const sent = sentGraph(board(EDITED));
    expect(sent?.read("release.reporting.startDate")).toBe("2026-12-04");
    expect(sent?.read("release.billing.duration")).toBe(9);
  });

  test("ignores draft values of items the board does not hold", () => {
    const draft = new Map([["elsewhere", ganttEditedValue]]);
    expect(liveGraph(board(draft))).toBe(sentGraph(board(draft)));
  });

  test("builds the sent graph once per items list, whatever the draft", () => {
    const first = sentGraph(board(NOTHING));
    expect(sentGraph(board(EDITED))).toBe(first);
    expect(sentGraph(board(new Map()))).toBe(first);
    // A new items list is a new board revision, even with the same content.
    expect(sentGraph(board(NOTHING, [...ITEMS]))).not.toBe(first);
  });

  test("builds the live graph once per items list and draft record", () => {
    const first = liveGraph(board(EDITED));
    expect(liveGraph(board(EDITED))).toBe(first);
    expect(liveGraph(board(new Map(EDITED)))).not.toBe(first);
    expect(liveGraph(board(EDITED, [...ITEMS]))).not.toBe(first);
  });

  test("shares the sent graph while the draft holds nothing for the board's items", () => {
    expect(liveGraph(board(NOTHING))).toBe(sentGraph(board(NOTHING)));
    expect(liveGraph(board(new Map([["release", undefined]])))).toBe(sentGraph(board(NOTHING)));
  });

  test("builds nothing for a board with no Gantt", () => {
    const items = [
      { type: "tree", id: "wbs", props: { columns: [], nodes: [] } },
      { type: "question", id: "plain", props: { text: "Which?" } },
    ];
    const draft = new Map([["wbs", { columns: [], nodes: [] }]]);
    expect(sentGraph(board(draft, items))).toBeUndefined();
    expect(liveGraph(board(draft, items))).toBeUndefined();
    expect(liveGraph(board(NOTHING, []))).toBeUndefined();
  });

  test("gives a frozen, read-only graph", () => {
    const graph = sentGraph(board(NOTHING));
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.keys(graph ?? {}).sort()).toEqual(["read", "warnings"]);
  });

  test("lists the graph's warnings, as for a cycle from the agent", () => {
    const tasks = [
      { id: "a", label: "A", duration: 1, dependencies: ["b"] },
      { id: "b", label: "B", duration: 1, dependencies: ["a"] },
    ];
    const cyclic = [{ type: "gantt", id: "release", props: { start: "2026-11-02", tasks } }];
    const graph = sentGraph(board(NOTHING, cyclic));
    const warnings = graph?.warnings.map((warning) => `${warning.error}@${warning.address}`);
    expect(warnings).toContain("cycle@release.a.es");
    expect(warnings).toContain("cycle@release.b.es");
    expect(graph?.read("release.a.startDate")).toMatchObject({ error: "cycle" });
  });

  test("refuses malformed props each time, keeping no failed build", () => {
    const broken = [{ type: "gantt", id: "release", props: { start: "2026-11-02", tasks: 3 } }];
    expect(() => sentGraph(board(NOTHING, broken))).toThrow(GraphSourceError);
    expect(() => sentGraph(board(NOTHING, broken))).toThrow(GraphSourceError);
    const draft = new Map([["release", { start: "2026-11-02", tasks: [{ id: "a" }] }]]);
    expect(() => liveGraph(board(draft))).toThrow(GraphSourceError);
    expect(() => liveGraph(board(draft))).toThrow(GraphSourceError);
  });
});
