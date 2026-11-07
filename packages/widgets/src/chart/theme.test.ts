import { describe, expect, test } from "bun:test";
import { chartTokens, tokensFrom } from "./theme.ts";

// The Chart's tokens as the theme resolves them (view-and-widgets spec: A Chart follows the theme;
// design decision 4): read once per theme from the resolved variables, which a stand-in gives here.
const VARIABLES: Readonly<Record<string, string>> = {
  "--chart-1": "#2a78d6",
  "--chart-2": "#eb6834",
  "--chart-3": "#1baf7a",
  "--chart-4": "#6250d6",
  "--chart-5": "#eda100",
  "--border": "#e4ded3",
  "--muted-foreground": "#6b645a",
  "--popover": "#fffdf9",
  "--popover-foreground": "#2b2722",
  "--change": "#c2410c",
  "--card": "#fffdf9",
  "--font-sans": 'ui-sans-serif, system-ui, "Segoe UI"',
  "--fs-badge": "11.5px",
};
const read = (name: string): string => VARIABLES[name] ?? "";

describe("tokensFrom", () => {
  test("gives the five series colours in order, then the other tokens", () => {
    expect(tokensFrom(read)).toEqual({
      chart: ["#2a78d6", "#eb6834", "#1baf7a", "#6250d6", "#eda100"],
      border: "#e4ded3",
      mutedForeground: "#6b645a",
      popover: "#fffdf9",
      popoverForeground: "#2b2722",
      change: "#c2410c",
      card: "#fffdf9",
      fontSans: 'ui-sans-serif, system-ui, "Segoe UI"',
      badgeSize: 11.5,
    });
  });

  test("trims what the browser pads a custom property with", () => {
    const padded = (name: string): string => ` ${read(name)}\n`;
    expect(tokensFrom(padded).chart[0]).toBe("#2a78d6");
    expect(tokensFrom(padded).badgeSize).toBe(11.5);
  });

  test("refuses a token that has no value, naming it, rather than drawing in a default", () => {
    const without = (missing: string) => (name: string) => (name === missing ? "" : read(name));
    expect(() => tokensFrom(without("--chart-3"))).toThrow("--chart-3");
    expect(() => tokensFrom(without("--change"))).toThrow("--change");
    expect(() => tokensFrom(without("--font-sans"))).toThrow("--font-sans");
  });

  test("refuses a badge size that is no length in pixels", () => {
    const odd = (name: string) => (name === "--fs-badge" ? "large" : read(name));
    expect(() => tokensFrom(odd)).toThrow("--fs-badge");
  });
});

describe("chartTokens", () => {
  test("reads each variable from the element's computed style", () => {
    const asked: string[] = [];
    const element = {} as Element;
    const tokens = chartTokens(element, () => ({
      getPropertyValue: (name: string) => {
        asked.push(name);
        return read(name);
      },
    }));
    expect(tokens.chart).toHaveLength(5);
    expect(asked).toContain("--popover-foreground");
    expect(asked).toContain("--fs-badge");
  });
});
