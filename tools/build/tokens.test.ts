import { describe, expect, test } from "bun:test";
import { DESIGN_FILE } from "./paths.ts";
import { readDesignTokens, themeCss, tokensCss } from "./tokens.ts";

const DESIGN = `---
name: Test
colors:
  # light
  background: '#f7f5f0'
  foreground: '#2b2722'
  muted: '#f0ece4'
  # aliases
  card-foreground: '#2b2722'  # = foreground
  accent: '#f0ece4'  # = muted
  # dark
  background-dark: '#1b1916'
  foreground-dark: '#ebe6dd'
  muted-dark: '#161411'
  card-foreground-dark: '#ebe6dd'  # = foreground
  accent-dark: '#161411'  # = muted
typography:
  question:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  body-comfortable:
    fontSize: 14px
rounded:
  md: 4px
  full: 9999px
---

# Test
`;

describe("DESIGN.md's tokens as CSS variables", () => {
  const tokens = readDesignTokens(DESIGN);

  test("each colour is a variable in the light scheme and again under .dark", () => {
    const css = tokensCss(tokens);
    const [light = "", dark = ""] = css.split(".dark{");
    expect(light).toContain("--background:#f7f5f0;");
    expect(light).toContain("--muted:#f0ece4;");
    expect(dark).toContain("--background:#1b1916;");
    expect(dark).toContain("--foreground:#ebe6dd;");
    expect(light).toContain("color-scheme:light");
    expect(dark).toContain("color-scheme:dark");
  });

  test("an alias points at its target once, the same in both schemes", () => {
    const css = tokensCss(tokens);
    const [light = "", dark = ""] = css.split(".dark{");
    expect(light).toContain("--card-foreground:var(--foreground);");
    expect(light).toContain("--accent:var(--muted);");
    expect(dark).not.toContain("--card-foreground");
  });

  test("the fonts are the system stacks (design, Non-Goals)", () => {
    const theme = themeCss(tokens);
    expect(theme).toContain("--font-sans:ui-sans-serif,system-ui");
    expect(theme).toContain("--font-mono:ui-monospace");
    expect(`${theme}${tokensCss(tokens)}`).not.toContain("Inter");
  });

  test("Tailwind's theme maps the utilities onto the variables, with the compact type ramp", () => {
    const theme = themeCss(tokens);
    expect(theme).toContain("--color-*:initial;");
    expect(theme).toContain("--text-*:initial;");
    expect(theme).toContain("--radius-*:initial;");
    expect(theme).toContain("--color-card-foreground:var(--card-foreground);");
    expect(theme).toContain("--text-question:20px;");
    expect(theme).toContain("--text-question--line-height:1.3;");
    expect(theme).toContain("--text-question--font-weight:600;");
    expect(theme).toContain("--text-question--letter-spacing:-0.01em;");
    expect(theme).toContain("--text-body:13px;");
    expect(theme).not.toContain("comfortable");
    expect(theme).toContain("--radius-md:4px;");
    expect(theme).not.toContain("--radius-full");
  });

  test("a colour without its dark value fails, naming it", () => {
    const missing = DESIGN.replace("  muted-dark: '#161411'\n", "");
    expect(() => tokensCss(readDesignTokens(missing))).toThrow('"muted"');
  });

  test("an alias whose target is no colour fails, naming it", () => {
    const wrong = DESIGN.replace("# = muted\n  # dark", "# = nothing\n  # dark");
    expect(() => tokensCss(readDesignTokens(wrong))).toThrow('"nothing"');
  });

  test("a file without front matter fails", () => {
    expect(() => readDesignTokens("# no tokens\n")).toThrow("front matter");
  });

  test("the real DESIGN.md gives every colour in both schemes", async () => {
    const real = readDesignTokens(await Bun.file(DESIGN_FILE).text());
    const css = tokensCss(real);
    expect(Object.keys(real.colors).length).toBeGreaterThan(50);
    expect(css).toContain("--primary:#0b6e7f;");
    expect(css).toContain("--primary:#5fb4c2;");
    expect(css).toContain("--input:var(--border-strong);");
  });
});
