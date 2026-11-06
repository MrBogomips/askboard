import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boardPageHtml } from "./board-page.ts";
import { BASE_CSS } from "./paths.ts";
import { DARK_VARIANT, runTailwind, tailwindInput, writeTokenFiles } from "./styles.ts";

let work = "";
beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "askboard-styles-"));
  await writeTokenFiles(work);
});
afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

describe("Tailwind's input per chunk", () => {
  test("a document's input has preflight, the tokens, the base layer and the dark variant", () => {
    const input = tailwindInput("document", ["/a/shell/index.tsx"], work);
    expect(input).toContain("preflight.css");
    expect(input).toContain(JSON.stringify(join(work, "tokens.css")));
    expect(input).toContain(JSON.stringify(BASE_CSS));
    expect(input).toContain(JSON.stringify(join(work, "theme.css")));
    expect(input).toContain('@source "/a/shell/index.tsx";');
    expect(input).toContain("source(none)");
    expect(input).toContain(DARK_VARIANT);
  });

  test("a component's input has only its utilities, on the same theme and dark variant", () => {
    const input = tailwindInput("utilities", ["/a/choice/index.tsx"], work);
    expect(input).not.toContain("preflight.css");
    expect(input).not.toContain("tokens.css");
    expect(input).toContain(JSON.stringify(join(work, "theme.css")));
    expect(DARK_VARIANT).toBe("@custom-variant dark (&:where(.dark, .dark *));");
    expect(input).toContain(DARK_VARIANT);
  });

  test("the CLI turns a chunk's sources into its utilities, on the token variables", async () => {
    const source = join(work, "card.tsx");
    await Bun.write(
      source,
      'export const c = "rounded-md bg-card text-question gap-md h-header-row dark:bg-muted";\n',
    );
    const input = join(work, "card.css");
    await Bun.write(input, tailwindInput("utilities", [source], work));
    const css = await runTailwind(input, join(work, "card.out.css"));
    expect(css).toContain("background-color:var(--card)");
    expect(css).toContain(":where(.dark,.dark *)");
    expect(css).toContain("font-size:var(--fs-question)");
    expect(css).toContain("gap:var(--md)");
    expect(css).toContain("height:var(--header-row)");
    expect(css).toContain("border-radius:4px");
  });

  test("a document's styles hold the tokens of both schemes", async () => {
    const input = join(work, "document.css");
    await Bun.write(input, tailwindInput("document", [], work));
    const css = await runTailwind(input, join(work, "document.out.css"));
    expect(css).toContain("--background:#f7f5f0");
    expect(css).toContain("--background:#1b1916");
    expect(css).toContain("ui-sans-serif");
  });

  test("a document's styles hold the hover layer, which the dark scheme re-points", async () => {
    const input = join(work, "hover.css");
    await Bun.write(input, tailwindInput("document", [], work));
    const css = await runTailwind(input, join(work, "hover.out.css"));
    expect(css).toContain("--hover-fill:var(--muted)");
    expect(css).toContain("cursor:pointer");
    expect(css).toContain("cursor:not-allowed");
    expect(css).toContain("[data-editable]");
    expect(css).toContain("var(--hover-outline)");
  });

  test("a failing run names the input", async () => {
    const input = join(work, "broken.css");
    await Bun.write(input, '@import "./missing.css";\n');
    await expect(runTailwind(input, join(work, "broken.out.css"))).rejects.toThrow("broken.css");
  });
});

describe("the board page", () => {
  test("is HTML with its styles and script inline, exactly as their files hold them", () => {
    const html = boardPageHtml("(()=>{})();\n", "body{margin:0}");
    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<link rel="icon" href="data:,">');
    expect(html).toContain("<style>body{margin:0}</style>");
    expect(html).toContain("<script>(()=>{})();\n</script>");
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<style/g)).toHaveLength(1);
  });

  test("leaves the style element out when there are no styles", () => {
    expect(boardPageHtml("1;", "")).not.toContain("<style>");
  });

  test("fixes its base URL at the origin's root first in its head, so the view inherits no token (AD-8)", () => {
    const html = boardPageHtml("1;", "body{margin:0}");
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    expect(html.match(/<base /g)).toHaveLength(1);
    expect(head).toContain('<base href="/">');
    expect(head.indexOf("<base ")).toBeLessThan(head.indexOf("<link "));
  });
});
