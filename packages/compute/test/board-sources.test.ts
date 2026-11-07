// The graph sources by widget type (widget-registry, task 1.4; compute spec, "Graph sources by
// widget type"): a table a computing widget extends, empty today, which maps a board item of a
// type other than the Tree and the Gantt; an item whose type has no source adds nothing.

import { describe, expect, test } from "bun:test";
import { WIDGET_TYPES } from "@askboard/contract";
import { PROBE_TYPES } from "@askboard/contract/fixtures";
import {
  BOARD_SOURCES,
  type BoardSource,
  type BoardSourceItem,
  boardGraphSource,
} from "../src/index.ts";

const GANTT = {
  type: "gantt",
  id: "release",
  props: { start: "2026-11-02", tasks: [{ id: "ux", label: "UX", duration: 6 }] },
};
const probe = (id: string): BoardSourceItem => ({ type: "probe", id, props: { options: [] } });

// A source for the test-only type: one `fields` item per probe item, named by the item.
const PROBE_SOURCE: BoardSource = (item) => [
  { kind: "fields", id: item.id, fields: { count: { type: "number", value: 2 } } },
];

describe("BOARD_SOURCES", () => {
  test("is empty today, frozen, and holds no inherited name", () => {
    expect(Object.keys(BOARD_SOURCES)).toEqual([]);
    expect(Object.isFrozen(BOARD_SOURCES)).toBe(true);
  });

  test("gives a source for every registered type that declares derived values", () => {
    const computing = PROBE_TYPES.filter(({ derived }) => derived !== undefined).map(
      ({ type }) => type,
    );
    expect(computing).toEqual(["tree", "gantt", "probe"]);
    // The shipped registry: each computing type is a Tree, a Gantt or has a source.
    for (const { type, derived } of WIDGET_TYPES) {
      if (derived !== undefined) {
        expect(["tree", "gantt", ...Object.keys(BOARD_SOURCES)]).toContain(type);
      }
    }
  });
});

describe("boardGraphSource with a table of sources", () => {
  test("puts a probe source's items in board order with the Gantt's", () => {
    const source = boardGraphSource([probe("p1"), GANTT, probe("p2")], { probe: PROBE_SOURCE });
    expect(source.items.map((item) => (item as { id: string }).id)).toEqual([
      "p1",
      "release",
      "p2",
    ]);
    expect(source.items.map(({ kind }) => kind)).toEqual(["fields", "gantt", "fields"]);
  });

  test("adds nothing for a type with no source", () => {
    const without = boardGraphSource([GANTT]);
    expect(boardGraphSource([probe("p1"), GANTT, probe("p2")])).toEqual(without);
    expect(boardGraphSource([probe("p1"), GANTT], { other: PROBE_SOURCE })).toEqual(without);
  });

  test("never reads an inherited name as a source", () => {
    const item = { type: "constructor", id: "c" };
    expect(boardGraphSource([item], {})).toEqual({ items: [] });
    expect(boardGraphSource([{ type: "toString", id: "t" }])).toEqual({ items: [] });
  });

  test("leaves the Tree's and Gantt's mapping to its own code, whatever the table holds", () => {
    const trap: BoardSource = () => {
      throw new Error("a source for a type that has its own mapping must not run");
    };
    expect(boardGraphSource([GANTT], { gantt: trap, tree: trap })).toEqual(
      boardGraphSource([GANTT]),
    );
  });

  test("hands the source the item as it is on the board", () => {
    const seen: BoardSourceItem[] = [];
    const item = probe("p1");
    boardGraphSource([item], {
      probe: (given) => {
        seen.push(given);
        return [];
      },
    });
    expect(seen).toEqual([item]);
  });
});
