import { describe, expect, test } from "bun:test";
import { CHART_KEYS } from "@askboard/contract";
import { type ChartKey, chartKeyAction } from "../src/chart/model.ts";
import { expectedActions, parityMismatches, reachedActions, type Taken } from "./key-presses.ts";

// The Chart's key table against its handler (keyboard-shortcuts-help, design decision 9; spec: Key
// tables match the handlers): `chartKeyAction`, which the component calls, for each key, Space and
// Enter included, under each of the 16 sets of modifiers.
const MOVES: Readonly<Record<ChartKey, string>> = {
  ArrowLeft: "cursor.left",
  ArrowRight: "cursor.right",
  ArrowUp: "cursor.up",
  ArrowDown: "cursor.down",
  Home: "cursor.first",
  End: "cursor.last",
};

const plot: Taken = (_key, _flags, press) => {
  const action = chartKeyAction(press);
  if (action === undefined) return undefined;
  return action.kind === "move" ? MOVES[action.key] : "chart.highlight";
};

describe("the Chart's table matches its handler", () => {
  test("plot: every key under every hold gives the table's action or nothing", () => {
    expect(parityMismatches(CHART_KEYS, "plot", plot)).toEqual([]);
  });

  test("plot: every entry is reached by one of its bindings, Space and Enter among them", () => {
    expect(reachedActions(CHART_KEYS, "plot", plot)).toEqual(expectedActions(CHART_KEYS, "plot"));
    expect(
      CHART_KEYS.find((entry) => entry.action === "chart.highlight")?.keys.map((k) => k.key),
    ).toEqual([" ", "Enter"]);
  });
});
