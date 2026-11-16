import { describe, expect, test } from "bun:test";

// The stripe's styles, per state, as design decision 7 gives them (answering-flow-visual).
const css = await Bun.file(new URL("./state.css", import.meta.url)).text();
const ruleOf = (state: string): string =>
  css.match(new RegExp(`\\[data-askboard-stripe="${state}"\\] \\{([^}]*)\\}`))?.[1] ?? "";

const EXPECTED: Readonly<Record<string, readonly [string, string]>> = {
  todo: ["var(--border)", "solid"],
  draft: ["var(--primary)", "dashed"],
  ready: ["var(--primary)", "solid"],
  "not-sent-yet": ["var(--muted-foreground)", "dashed"],
  sent: ["var(--success)", "dashed"],
  delivered: ["var(--success)", "solid"],
  postponed: ["var(--muted-foreground)", "dotted"],
  declined: ["var(--muted-foreground)", "solid"],
};

describe("the state stripe", () => {
  for (const [state, [colour, style]] of Object.entries(EXPECTED)) {
    test(`${state}: ${style} in ${colour}`, () => {
      const rule = ruleOf(state);
      expect(rule).toContain(`border-left-color: ${colour};`);
      expect(rule).toContain(`border-left-style: ${style};`);
    });
  }

  test("the stripe is 4 px, and the base stylesheet imports the file", async () => {
    expect(css).toContain("border-left-width: 4px;");
    expect(await Bun.file(new URL("./base.css", import.meta.url)).text()).toContain(
      '@import "./state.css";',
    );
  });

  test("the answered look subdues the options that are not chosen", () => {
    expect(css).toContain('[data-askboard-answered] [role="radio"][data-state="unchecked"]');
  });
});
