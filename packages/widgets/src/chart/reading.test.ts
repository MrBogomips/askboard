import { describe, expect, test } from "bun:test";
import type { ChartProps } from "@askboard/contract";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import { counterText, pointReading } from "./reading.ts";

// What a Chart says aloud and under the plot (view-and-widgets spec: A Chart's points read aloud,
// Highlighting data points, The Chart's strings): pure text from the props, the ask's locale and the
// strings, with the agent's own words kept as chart text.

const [BAR] = CHART_FIXTURE_ITEMS.map((item) => item.props) as [ChartProps];
const WORDS: Readonly<Record<string, string>> = {
  "chart.highlighted": "highlighted",
  "chart.noPoints": "No points highlighted",
};
const say = (key: string, slots?: Readonly<Record<string, string | number>>): string => {
  if (key === "chart.points") {
    return `${slots?.count} point${slots?.count === 1 ? "" : "s"} highlighted`;
  }
  return WORDS[key] ?? key;
};

describe("pointReading", () => {
  test("names the category, the series and the value with its unit", () => {
    expect(
      pointReading(BAR, { series: "fails", category: "fix-b" }, { locale: "en-US", say }),
    ).toBe("Fix B, Failures: 9 runs");
  });

  test("adds the word highlighted for a highlighted point", () => {
    expect(
      pointReading(
        BAR,
        { series: "fails", category: "fix-b" },
        { locale: "en-US", say, highlighted: true },
      ),
    ).toBe("Fix B, Failures: 9 runs, highlighted");
  });

  test("writes the value in the ask's locale", () => {
    const props: ChartProps = {
      kind: "bar",
      categories: [{ id: "a", label: "A" }],
      series: [{ id: "s", label: "S", values: [1234.5] }],
      unit: "€",
    };
    const point = { series: "s", category: "a" };
    expect(pointReading(props, point, { locale: "en-US", say })).toBe("A, S: 1,234.5 €");
    expect(pointReading(props, point, { locale: "it-IT", say })).toBe("A, S: 1.234,5 €");
  });

  test("shows a control character in a label as its escape, and breaks the library's markup", () => {
    const props: ChartProps = {
      kind: "bar",
      categories: [{ id: "a", label: "{b|Fix}‮" }],
      series: [{ id: "s", label: "S", values: [2] }],
    };
    const reading = pointReading(props, { series: "s", category: "a" }, { locale: "en-US", say });
    expect(reading).toContain("\\u202E");
    expect(reading).not.toContain("{b|");
  });

  test("is empty for a point the props do not hold or that has no value", () => {
    const ask = { locale: "en-US", say } as const;
    expect(pointReading(BAR, { series: "reruns", category: "fix-c" }, ask)).toBe("");
    expect(pointReading(BAR, { series: "nope", category: "fix-a" }, ask)).toBe("");
    expect(pointReading(BAR, { series: "fails", category: "nope" }, ask)).toBe("");
  });
});

describe("counterText", () => {
  test("says no point while none is highlighted, else how many", () => {
    expect(counterText(0, say)).toBe("No points highlighted");
    expect(counterText(1, say)).toBe("1 point highlighted");
    expect(counterText(3, say)).toBe("3 points highlighted");
  });
});
