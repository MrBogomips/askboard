import { describe, expect, test } from "bun:test";
import { PALETTES } from "@askboard/contract";
import { DESIGN_FILE } from "./paths.ts";
import { checkPalettes, paletteCss, readDesignTokens, themeCss, tokensCss } from "./tokens.ts";

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
spacing:
  unit: 8px
  sm: 8px
  control-height: 28px
  header-row: 32px
  viewport-floor: 1280px
  sm-comfortable: 12px
  control-height-comfortable: 32px
  header-row-comfortable: 40px
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
    expect(theme).toContain("--text-question:var(--fs-question);");
    expect(theme).toContain("--text-question--line-height:1.3;");
    expect(theme).toContain("--text-question--font-weight:600;");
    expect(theme).toContain("--text-question--letter-spacing:-0.01em;");
    expect(theme).toContain("--text-body:var(--fs-body);");
    expect(theme).not.toContain("comfortable");
    expect(theme).toContain("--radius-md:4px;");
    expect(theme).not.toContain("--radius-full");
  });

  test("the spacing and the type ramp are variables whose comfortable values re-point under .comfortable", () => {
    const css = tokensCss(tokens);
    const [root = "", rest = ""] = css.split(".dark{");
    const comfortable = rest.split(".comfortable{")[1] ?? "";
    expect(root).toContain("--sm:8px;");
    expect(root).toContain("--control-height:28px;");
    expect(root).toContain("--header-row:32px;");
    expect(root).toContain("--fs-body:13px;");
    expect(root).toContain("--fs-question:20px;");
    expect(root).not.toContain("viewport-floor");
    expect(comfortable).toContain("--sm:12px;");
    expect(comfortable).toContain("--control-height:32px;");
    expect(comfortable).toContain("--header-row:40px;");
    expect(comfortable).toContain("--fs-body:14px;");
    expect(comfortable).not.toContain("--fs-question");
    expect(comfortable).not.toContain("--background");
  });

  test("Tailwind's theme reads the density variables, so a utility follows the class", () => {
    const theme = themeCss(tokens);
    expect(theme).toContain("--spacing-sm:var(--sm);");
    expect(theme).toContain("--spacing-control-height:var(--control-height);");
    expect(theme).toContain("--spacing-header-row:var(--header-row);");
    expect(theme).not.toContain("viewport-floor");
  });

  test("a comfortable key without its compact key fails, naming it", () => {
    const orphan = DESIGN.replace("  sm-comfortable: 12px", "  xl-comfortable: 12px");
    expect(() => tokensCss(readDesignTokens(orphan))).toThrow('"xl-comfortable"');
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
    expect(css).toContain(".comfortable{");
    // The board has no bottom action bar (answering-flow-visual).
    expect(css).not.toContain("--bottom-bar");
    // The rail is 256 px, and the question is 15 px compact and 17 px comfortable (decisions 2 and 8).
    expect(css).toContain("--outline-rail:256px;");
    expect(css).toContain("--fs-question:15px;");
    expect(css).toContain("--fs-question:17px;");
  });

  // The Chart's palette (chart-widget, design decision 7): DESIGN's `chart-1` to `chart-5`, light and
  // dark, reach the stylesheet through the generic colour rule, with no code of `tokens.ts` naming them.
  test("the real DESIGN.md's chart palette is in the stylesheet, light and under .dark", async () => {
    const css = tokensCss(readDesignTokens(await Bun.file(DESIGN_FILE).text()));
    const [light = "", rest = ""] = css.split(".dark{");
    const dark = rest.split(".comfortable{")[0] ?? "";
    const LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#6250d6", "#eda100"];
    const DARK = ["#3987e5", "#d95926", "#199e70", "#9085e9", "#c98500"];
    LIGHT.forEach((value, at) => {
      expect(light).toContain(`--chart-${at + 1}:${value};`);
      expect(dark).not.toContain(`--chart-${at + 1}:${value};`);
    });
    DARK.forEach((value, at) => {
      expect(dark).toContain(`--chart-${at + 1}:${value};`);
      expect(light).not.toContain(`--chart-${at + 1}:${value};`);
    });
    expect(light).not.toContain("--chart-6");
  });

  test("Tailwind's theme maps the chart colours onto their variables", async () => {
    const theme = themeCss(readDesignTokens(await Bun.file(DESIGN_FILE).text()));
    for (const at of [1, 2, 3, 4, 5]) {
      expect(theme).toContain(`--color-chart-${at}:var(--chart-${at});`);
    }
  });
});

// The named palettes (palettes, task 2.1, design decisions D2 and D3): `palettes:` holds one group
// per palette but Carta, each with every role of `colors` and its `-dark` twin, and CSS under
// `:root[data-palette]`.
const WITH_PALETTE = DESIGN.replace(
  "typography:",
  `palettes:
  nordico:
    background: '#eceff4'
    foreground: '#222936'
    muted: '#e2e7ee'
    background-dark: '#232933'
    foreground-dark: '#e7ebf1'
    muted-dark: '#323a47'
typography:`,
);

describe("the named palettes", () => {
  const tokens = readDesignTokens(WITH_PALETTE);

  test("readDesignTokens returns each palette's keys; a file without the group has none", () => {
    expect(Object.keys(tokens.palettes)).toEqual(["nordico"]);
    expect(tokens.palettes.nordico?.background).toBe("#eceff4");
    expect(readDesignTokens(DESIGN).palettes).toEqual({});
  });

  test("paletteCss writes the light roles on :root[data-palette] and the dark ones on its .dark form", () => {
    const css = paletteCss(tokens, "nordico");
    expect(css).toBe(
      ':root[data-palette="nordico"]{--background:#eceff4;--foreground:#222936;--muted:#e2e7ee;}\n' +
        ':root[data-palette="nordico"].dark{--background:#232933;--foreground:#e7ebf1;--muted:#323a47;}\n',
    );
  });

  test("a palette holds roles only: no density variable, no alias, no color-scheme", () => {
    const css = paletteCss(tokens, "nordico");
    expect(css).not.toContain("color-scheme");
    expect(css).not.toContain("--sm");
    expect(css).not.toContain("var(");
  });

  test("a missing dark twin fails, naming the palette and the key", () => {
    const missing = readDesignTokens(WITH_PALETTE.replace("    muted-dark: '#323a47'\n", ""));
    expect(() => paletteCss(missing, "nordico")).toThrow('"nordico"');
    expect(() => checkPalettes(missing, ["carta", "nordico"])).toThrow('"muted-dark"');
  });

  test("a role of colors the palette lacks fails, naming it", () => {
    const lacking = readDesignTokens(
      WITH_PALETTE.replace("    muted: '#e2e7ee'\n", "").replace("    muted-dark: '#323a47'\n", ""),
    );
    expect(() => checkPalettes(lacking, ["carta", "nordico"])).toThrow('"muted"');
  });

  test("a key colors lacks fails, naming it", () => {
    const extra = readDesignTokens(
      WITH_PALETTE.replace("    muted: '#e2e7ee'", "    sparkle: '#ffffff'\n    muted: '#e2e7ee'"),
    );
    expect(() => checkPalettes(extra, ["carta", "nordico"])).toThrow('"sparkle"');
  });

  test("an alias set by a palette fails, naming the palette and the alias", () => {
    const aliased = readDesignTokens(
      WITH_PALETTE.replace("    muted: '#e2e7ee'", "    accent: '#e2e7ee'\n    muted: '#e2e7ee'"),
    );
    expect(() => checkPalettes(aliased, ["carta", "nordico"])).toThrow('"nordico"');
    expect(() => checkPalettes(aliased, ["carta", "nordico"])).toThrow('"accent"');
  });

  test("a palette the contract does not name fails, and so does one it names without a group", () => {
    expect(() => checkPalettes(tokens, ["carta"])).toThrow('"nordico"');
    expect(() => checkPalettes(tokens, ["carta", "nordico", "grafite"])).toThrow('"grafite"');
    expect(() => paletteCss(tokens, "inchiostro")).toThrow('"inchiostro"');
    expect(() => paletteCss(tokens, 'carta"] body{')).toThrow();
  });

  test("a palette that is whole passes, and carta needs no group", () => {
    expect(() => checkPalettes(tokens, ["carta", "nordico"])).not.toThrow();
  });

  test("Carta's stylesheet is unchanged: tokensCss ignores the palettes", () => {
    expect(tokensCss(tokens)).toBe(tokensCss(readDesignTokens(DESIGN)));
  });

  test("the real DESIGN.md holds a whole group for every palette the contract names but Carta", async () => {
    const real = readDesignTokens(await Bun.file(DESIGN_FILE).text());
    expect(() => checkPalettes(real, PALETTES)).not.toThrow();
    expect(Object.keys(real.palettes)).toEqual(PALETTES.filter((name) => name !== "carta"));
    for (const name of PALETTES) {
      if (name === "carta") continue;
      const css = paletteCss(real, name);
      expect(css).toContain(`:root[data-palette="${name}"]{`);
      expect(css).toContain(`:root[data-palette="${name}"].dark{`);
      expect(css).not.toContain("!important");
    }
  });
});
