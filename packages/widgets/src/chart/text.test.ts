import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { echartsFile, importZrender, zrenderFile } from "../../test/zrender.ts";
import { chartText, escapedText, formatChartValue, formatReadingValue } from "./text.ts";

// View-and-widgets spec: Agent text on a chart, Chart tooltips (chart-widget, design decision 3):
// agent text reaches the canvas as data. The chart library reads `{name|text}` in any text with
// `rich` styles as markup, and the rich tooltip always has them, so `chartText` breaks every
// opener with a word joiner and the tests run zrender's own parser on what it gives.

type Token = { text: string; styleName?: string | null };
type Parse = (
  text: string,
  style: { rich: Record<string, object>; font: string },
) => { lines: { tokens: Token[] }[] };

let parse: Parse;

beforeAll(async () => {
  const platform = await importZrender("lib/core/platform.js");
  // zrender measures text through a canvas: a stand-in with a fixed advance, as no DOM is here.
  (platform.setPlatformAPI as (api: object) => void)({
    createCanvas: () => ({
      getContext: () => ({ font: "", measureText: (text: string) => ({ width: text.length * 6 }) }),
    }),
  });
  parse = (await importZrender("lib/graphic/helper/parseText.js")).parseRichText as Parse;
});

// Every style name a hostile label may name is defined, as the tooltip's are, so a match would style.
const STYLES = Object.fromEntries(
  ["a", "b", "c", "_", "9"].map((name) => [name, { fontWeight: "bold" }]),
);
const tokensOf = (text: string): Token[] =>
  parse(text, { rich: STYLES, font: "12px sans-serif" }).lines.flatMap((line) => line.tokens);

// One plain token: a single piece of text, no style name, which is the text as written.
const expectPlain = (text: string): void => {
  const tokens = tokensOf(text);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]?.styleName ?? null).toBeNull();
  expect(tokens[0]?.text).toBe(text);
};

const WORD_JOINER = "⁠";

describe("the chart library reads markup in text (what the guard protects)", () => {
  test("raw agent text is read as styled tokens", () => {
    expect(tokensOf("{b|Fix} {c}").map((token) => token.styleName ?? null)).toEqual(["b", null]);
    expect(tokensOf("{a|{b|x}}").length).toBeGreaterThan(1);
    expect(tokensOf("{9|x}")[0]?.styleName).toBe("9");
  });
});

describe("chartText", () => {
  const HOSTILE = [
    "{b|Fix} {c}",
    "{a|{b|x}}",
    "{_|}",
    "{9|x}",
    `${"{a|".repeat(60)}x}`,
    "{a|".repeat(60),
    "before {a|x} between {b|y} after",
  ];

  test("gives each hostile label as one plain token from zrender's own parser", () => {
    for (const label of HOSTILE) expectPlain(chartText(label));
  });

  test("keeps the text: only joiners are added, one after each opener", () => {
    for (const label of HOSTILE) {
      expect(chartText(label).replaceAll(WORD_JOINER, "")).toBe(label);
    }
    expect(chartText("{b|Fix} {c}")).toBe(`${WORD_JOINER}{${WORD_JOINER}b|Fix} {c}`);
  });

  test("shows a control or a bidirectional character as its visible escape", () => {
    expect(chartText("a‮b")).toBe(`${WORD_JOINER}a\\u202Eb`);
    expect(chartText("line\nbreak")).toBe(`${WORD_JOINER}line\\u000Abreak`);
    expect(chartText("nul\u0000")).toBe(`${WORD_JOINER}nul\\u0000`);
    expect(chartText("⁦x⁩؜‏")).toBe(`${WORD_JOINER}\\u2066x\\u2069\\u061C\\u200F`);
    expectPlain(chartText("{‮b|x}"));
  });

  test("adds only the joiner at the start of a label without an opener", () => {
    for (const label of ["Fix B", "café", "a|b}", "{ b|x}", "{a b|x}", "{}", "{|x}", "", "k€"]) {
      expect(chartText(label)).toBe(`${WORD_JOINER}${label}`);
    }
  });

  // X-1 of the review of groups 1 to 4 (design decision 3): the chart library keys a cache of text
  // widths by the text in a plain object, so no text it measures may be an inherited name, nor a
  // prefix of the text cut down to one.
  test("starts every string it returns with the joiner, once, whatever the text", () => {
    const names = Object.getOwnPropertyNames(Object.prototype);
    for (const label of [...names, ...HOSTILE, "", "Fix B", WORD_JOINER, `${WORD_JOINER}x`]) {
      const text = chartText(label);
      expect(text.startsWith(WORD_JOINER), label).toBe(true);
      expect(text.startsWith(`${WORD_JOINER}${WORD_JOINER}`), label).toBe(false);
    }
  });

  test("returns no inherited name, nor a prefix of one, for any inherited name or text starting with one", () => {
    const names = new Set(Object.getOwnPropertyNames(Object.prototype));
    for (const name of names) {
      for (const label of [
        name,
        `${name}xyz`,
        `${name}${"x".repeat(60 - name.length)}`.slice(0, 60),
      ]) {
        const text = chartText(label);
        for (let length = 0; length <= text.length; length += 1) {
          expect(names.has(text.slice(0, length)), `${label} cut at ${length}`).toBe(false);
        }
      }
    }
  });

  test("adds no joiner to a brace that opens nothing, and one to each that does", () => {
    expect(chartText("{{a|x}")).toBe(`${WORD_JOINER}{{${WORD_JOINER}a|x}`);
    expect(chartText("{a|{b|x}}").split(WORD_JOINER)).toHaveLength(4);
  });

  test("gives the same text when applied twice", () => {
    for (const label of [...HOSTILE, "a‮b\n"]) {
      expect(chartText(chartText(label))).toBe(chartText(label));
    }
  });

  test("shows an escape's own characters as text that is no markup", () => {
    expectPlain(chartText("{\\u0062|x}"));
  });
});

describe("formatChartValue", () => {
  test("shows a value in the locale with the unit after it", () => {
    expect(formatChartValue(1234.5, "en-US", "€")).toBe(`1,234.5 ${WORD_JOINER}€`);
    expect(formatChartValue(1234.5, "it-IT", "€")).toBe(`1.234,5 ${WORD_JOINER}€`);
  });

  test("shows a value without a unit as the number alone", () => {
    expect(formatChartValue(9, "en-US")).toBe("9");
    expect(formatChartValue(-0.5, "it-IT", undefined)).toBe("-0,5");
  });

  test("shows the unit as chart text: no markup, escapes visible", () => {
    expectPlain(formatChartValue(3, "en-US", "{b|runs}"));
    expect(formatChartValue(3, "en-US", "r‮g")).toBe(`3 ${WORD_JOINER}r\\u202Eg`);
  });

  test("shows the contract's largest value whole", () => {
    expect(formatChartValue(1e15, "en-US")).toBe("1,000,000,000,000,000");
  });
});

describe("escapedText and formatReadingValue (what the DOM shows)", () => {
  test("escapedText shows controls and bidirectional characters as escapes and adds no joiner", () => {
    expect(escapedText("a‮b\nc")).toBe("a\\u202Eb\\u000Ac");
    expect(escapedText("{b|Fix} {c}")).toBe("{b|Fix} {c}");
    expect(escapedText("")).toBe("");
  });

  test("formatReadingValue gives the value and the unit with no joiner, in the ask's locale", () => {
    expect(formatReadingValue(1234.5, "en-US", "€")).toBe("1,234.5 €");
    expect(formatReadingValue(1234.5, "it-IT", "€")).toBe("1.234,5 €");
    expect(formatReadingValue(9, "en-US")).toBe("9");
    expect(formatReadingValue(1, "en-US", "{b|x}\u202E")).toBe("1 {b|x}\\u202E");
  });
});

describe("the source guard (design decision 3)", () => {
  const source = (): string => readFileSync(zrenderFile("lib/graphic/helper/parseText.js"), "utf8");

  test("finds STYLE_REG in the installed zrender as the design quotes it", () => {
    expect(source()).toContain("var STYLE_REG = /\\{([a-zA-Z0-9_]+)\\|([^}]*)\\}/g;");
  });

  test("finds it once: the rule has no second reading", () => {
    expect(source().match(/STYLE_REG\s*=/g)).toHaveLength(1);
  });

  test("reads the zrender that echarts depends on, at the pinned version", () => {
    const own = JSON.parse(readFileSync(zrenderFile("package.json"), "utf8")) as {
      version: string;
    };
    expect(own.version).toBe("6.1.0");
  });

  // U-1 of the review of groups 1 to 4: the guards above read zrender, but what ECharts does with
  // a function formatter's text (no templating of its output, no text path of its own) is its own
  // code, so a bump of `echarts` alone re-opens decision 3 until these guards are read again.
  test("reads the echarts the option is written for, at the pinned version", () => {
    const own = JSON.parse(readFileSync(echartsFile("package.json"), "utf8")) as {
      version: string;
    };
    expect(own.version).toBe("6.1.0");
  });
});
