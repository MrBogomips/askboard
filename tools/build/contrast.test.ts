import { describe, expect, test } from "bun:test";
import { PALETTES } from "@askboard/contract";
import {
  CONTRAST_PAIRS,
  contrastRatio,
  contrastReport,
  contrastTable,
  minimumOf,
  pairRatio,
  reportLines,
  roleReport,
  roleValue,
} from "./contrast.ts";
import { DESIGN_FILE } from "./paths.ts";
import { type DesignTokens, readDesignTokens } from "./tokens.ts";

// The contrast and role report (palettes, task 2.2, design decision D10): ratios, the pairs, the
// eight palette and scheme combinations, and a report that names what falls short without failing.

const real = readDesignTokens(await Bun.file(DESIGN_FILE).text());

// DESIGN.md's Contrast table in Carta, light and dark, to two decimals (the value its section
// holds today; the generated table must equal them).
const CARTA: Record<string, readonly [number, number]> = {
  "Primary text / page": [13.61, 14.11],
  "Primary text / surface": [14.6, 13.05],
  "Secondary text / surface": [8.07, 9.0],
  "Muted text / page": [5.43, 6.32],
  "Muted text / sunken": [5.02, 6.62],
  "Accent text / surface": [6.69, 7.8],
  "Accent text / pressed fill": [5.83, 6.69],
  "On-accent / accent": [5.91, 7.04],
  "On-danger / danger": [6.5, 5.13],
  "Error text / surface": [7.93, 7.61],
  "Input border / surface": [3.49, 3.42],
  "Focus ring / surface": [3.97, 8.45],
  "Hover outline / surface": [3.49, 3.42],
  "Selected underline / track": [5.02, 7.7],
  "Change line, pin / surface": [6.34, 5.94],
  "Change text / change bg": [7.12, 7.97],
  "Pin label / pin": [6.44, 6.42],
  "Success text / subtle": [6.22, 8.19],
  "Danger text / subtle": [6.93, 7.17],
  "Warning text / subtle": [6.28, 8.66],
  "Warning mark / surface": [4.0, 8.02],
  "Info text / subtle": [5.83, 7.25],
  "Agent text / agent bg": [7.2, 7.84],
  "Agent dot / agent bg": [5.67, 5.61],
  "Partly answered marker / surface": [8.07, 9.0],
  "Critical path / surface": [14.6, 13.05],
  "Critical bar / task bar": [4.18, 3.82],
  "Text / diff added": [12.61, 11.9],
  "Text / diff removed": [12.07, 12.31],
  "Syntax keyword / surface, diff added, diff removed (lowest)": [6.01, 7.07],
  "Syntax string (lowest of the three)": [5.21, 8.39],
  "Syntax number (lowest of the three)": [5.09, 7.44],
  "Syntax function (lowest of the three)": [5.69, 7.48],
  "Syntax comment (lowest of the three)": [4.81, 5.33],
};

describe("the ratio", () => {
  test("black on white is 21.00, and a colour on itself 1.00", () => {
    expect(contrastRatio("#000000", "#ffffff").toFixed(2)).toBe("21.00");
    expect(contrastRatio("#ffffff", "#000000").toFixed(2)).toBe("21.00");
    expect(contrastRatio("#2b2722", "#2b2722").toFixed(2)).toBe("1.00");
  });

  test("Carta's Primary text / page in light is 13.61", () => {
    expect(contrastRatio("#2b2722", "#f7f5f0").toFixed(2)).toBe("13.61");
  });

  test("a colour that is not #rrggbb fails", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow("red");
  });
});

describe("Carta's marks", () => {
  test.each(Object.entries(CARTA))("%s", (name, [light, dark]) => {
    const pair = CONTRAST_PAIRS.find((candidate) => candidate.name === name);
    expect(pair).toBeDefined();
    if (pair === undefined) return;
    expect(pairRatio(real, "carta", "light", pair).toFixed(2)).toBe(light.toFixed(2));
    expect(pairRatio(real, "carta", "dark", pair).toFixed(2)).toBe(dark.toFixed(2));
  });

  test("every row of DESIGN.md's table is a pair, and the layout's pairs follow them", () => {
    const names = CONTRAST_PAIRS.map((pair) => pair.name);
    expect(names.slice(0, Object.keys(CARTA).length)).toEqual(Object.keys(CARTA));
    expect(new Set(names).size).toBe(names.length);
  });

  test("the layout's pairs meet their minimum in Carta (an assertion for Carta only, D11)", () => {
    const layout = CONTRAST_PAIRS.slice(Object.keys(CARTA).length).map((pair) => pair.name);
    const short = contrastReport(real, ["carta"]).filter(
      (result) => layout.includes(result.pair) && !result.met,
    );
    expect(
      short.map((result) => `${result.scheme} ${result.pair} ${result.ratio.toFixed(2)}`),
    ).toEqual([]);
  });
});

// The arrival mark's pairs (answer-moves-to-top, D6): the text on the mark's fill, and its edge. The
// spec names secondary text too, so the pairs are four where D6's list has three.
describe("the arrival mark's pairs", () => {
  const ARRIVAL = [
    ["Text / arrival fill", "text"],
    ["Secondary text / arrival fill", "text"],
    ["Muted text / arrival fill", "text"],
    ["Arrival edge / fill", "mark"],
  ] as const;

  test.each(ARRIVAL)("%s is a %s pair of the report", (name, kind) => {
    expect(CONTRAST_PAIRS.find((pair) => pair.name === name)?.kind).toBe(kind);
  });

  test("each meets its minimum in every palette and scheme", () => {
    const names: readonly string[] = ARRIVAL.map(([name]) => name);
    const results = contrastReport(real).filter((result) => names.includes(result.pair));
    expect(results).toHaveLength(PALETTES.length * 2 * ARRIVAL.length);
    expect(
      results
        .filter((result) => !result.met)
        .map((r) => `${r.palette} ${r.scheme} ${r.pair} ${r.ratio.toFixed(2)}`),
    ).toEqual([]);
  });
});

// A palette of three roles, to show the report's behaviour without the real file.
const tokensWith = (muted: string): DesignTokens => ({
  colors: {
    background: "#ffffff",
    "background-dark": "#000000",
    foreground: "#000000",
    "foreground-dark": "#ffffff",
    "muted-foreground": "#777777",
    "muted-foreground-dark": "#999999",
  },
  aliases: {},
  palettes: {
    nordico: {
      background: "#ffffff",
      "background-dark": "#000000",
      "muted-foreground": muted,
      "muted-foreground-dark": "#999999",
    },
  },
  typography: {},
  rounded: {},
  spacing: {},
});

describe("a pair under its minimum", () => {
  test("is named with its palette, scheme and ratio, and nothing throws", () => {
    const pair = {
      name: "Test / page",
      kind: "text",
      foreground: "muted-foreground",
      background: "background",
    } as const;
    expect(minimumOf("nordico", "text")).toBe(4.5);
    const ratio = pairRatio(tokensWith("#8a8a8a"), "nordico", "light", pair);
    expect(ratio).toBeLessThan(4.5);
    expect(ratio.toFixed(2)).toBe(contrastRatio("#8a8a8a", "#ffffff").toFixed(2));
  });

  test("Contrasto's targets are 7:1 for text and 4.5:1 for marks, the others 4.5:1 and 3:1", () => {
    expect(minimumOf("contrasto", "text")).toBe(7);
    expect(minimumOf("contrasto", "mark")).toBe(4.5);
    expect(minimumOf("carta", "text")).toBe(4.5);
    expect(minimumOf("grafite", "mark")).toBe(3);
  });

  test("a pair naming a role a palette lacks fails, naming the palette and the role", () => {
    expect(() => roleValue(real, "nordico", "light", "sparkle")).toThrow('"sparkle"');
    expect(() => roleValue(real, "inchiostro", "light", "card")).toThrow('"inchiostro"');
  });
});

describe("every palette and scheme", () => {
  test("the report holds every pair for each of the eight combinations", () => {
    const results = contrastReport(real);
    expect(results).toHaveLength(PALETTES.length * 2 * CONTRAST_PAIRS.length);
    for (const palette of PALETTES) {
      for (const scheme of ["light", "dark"]) {
        expect(results.filter((r) => r.palette === palette && r.scheme === scheme)).toHaveLength(
          CONTRAST_PAIRS.length,
        );
      }
    }
  });

  test("the role rules are reported for each combination, and each rule is one the colour role rules name", () => {
    const results = roleReport(real);
    expect(results).toHaveLength(PALETTES.length * 2 * 3);
    expect(new Set(results.map((r) => r.rule))).toEqual(
      new Set(["agent to change", "agent to primary", "change to primary"]),
    );
  });

  // The report reports, it does not block (PRD L27, L28; DESIGN.md, Contrast): the lines are printed
  // for whoever runs the test, and nothing here fails on a value under its minimum.
  test("the pairs under their minimum and the rules not met are printed, and the test still passes", () => {
    const lines = reportLines(real);
    console.log(
      lines.length === 0 ? "contrast report: every pair meets its minimum" : lines.join("\n"),
    );
    expect(Array.isArray(lines)).toBe(true);
  });

  test("the table of a palette has a row per pair and Carta's values", () => {
    const table = contrastTable(real, "carta");
    expect(table.split("\n")).toHaveLength(2 + CONTRAST_PAIRS.length);
    expect(table).toContain("| Primary text / page | text, 4.5:1 | 13.61 | 14.11 |");
    expect(contrastTable(real, "contrasto")).toContain("text, 7:1");
  });

  test("DESIGN.md's Contrast tables are the script's output, one per palette", async () => {
    const text = await Bun.file(DESIGN_FILE).text();
    for (const palette of PALETTES) {
      expect(text).toContain(contrastTable(real, palette));
    }
  });
});
