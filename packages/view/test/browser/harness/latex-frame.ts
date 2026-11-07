// A bare LaTeX render in a browser engine (latex-kanban-timeline, tasks 4.10, 4.11, 4.15 and 6.8): the
// page the board page makes for the view, a parent page holding a `sandbox="allow-scripts"` srcdoc
// frame, and in the frame KaTeX's stylesheet with its woff2 fonts inlined as the build inlines them
// and a bundle of the widgets' scan, render options and output tree that draws as `renderInto` will:
// the scan, KaTeX's tree, the tree's size, then its nodes in place of the element's children. It
// applies no refusal and no bound: a probe needs to see what they would stop. No server, no board. Every request is aborted, so nothing leaves the machine and a font
// cannot arrive late; a render's time runs from the call to the end of a forced layout.
//
// A crash ("Target crashed"), 10 seconds without an answer or a parent page that does not answer
// an `evaluate` within 2 seconds is a failure; the engine is then discarded and the next render
// starts a new one, so a hung renderer cannot hang the run.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Browser, BrowserContext, Frame, Page } from "playwright";
import { launchEngine } from "./browser.ts";
import type { Engine } from "./engines.ts";
import { LATEX_SOURCES } from "./latex-measure.ts";

const WIDGETS = LATEX_SOURCES.widgets;

/** An answer is due within this, from the parent page's `evaluate` after each render. */
export const PARENT_ANSWER_MS = 2_000;
/** A render that has not answered by this is a failure. */
export const RENDER_TIMEOUT_MS = 10_000;
const CLOSE_TIMEOUT_MS = 5_000;

export type Failure = {
  readonly ok: false;
  readonly reason: "crash" | "timeout" | "parent" | "error";
  readonly message: string;
};

export type RenderResult = ({ readonly ok: true; readonly parentMs: number } & Drawn) | Failure;

/** What one draw reports: its time, the page's elements, the tree's size and the work before the bound. */
export type Drawn = {
  /** From the call to the end of a forced layout: the scan, the tree, its size, its nodes, the layout. */
  readonly ms: number;
  /** The elements the draw put in the page. */
  readonly nodes: number;
  readonly scanDepth: number;
  readonly treeDepth: number;
  readonly treeNodes: number;
  /** The scan, KaTeX's tree and its size, before any node is made. */
  readonly beforeMs: number;
};

/** Ten elements drawn in one task, or one per task: the total and the longest task. */
export type Many = { readonly totalMs: number; readonly longestMs: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// KaTeX's stylesheet with each face's source reduced to its woff2 file as a data: URL.
const katexStyles = async (): Promise<string> => {
  const path = Bun.resolveSync("katex/dist/katex.min.css", WIDGETS);
  const css = await readFile(path, "utf8");
  const faces = [...css.matchAll(/src:url\(([^)]*?\.woff2)\)[^;}]*/g)];
  let result = css;
  for (const [source, file] of faces) {
    const bytes = await readFile(join(dirname(path), file as string));
    result = result.replace(
      source,
      `src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2")`,
    );
  }
  return result;
};

// The script of the frame: the widgets' scan, render options and output tree, bundled for a browser.
const probeScript = async (): Promise<string> => {
  const folder = await mkdtemp(join(tmpdir(), "askboard-latex-frame-"));
  try {
    const entry = join(folder, "entry.ts");
    await writeFile(
      entry,
      `import { scanLatex } from ${JSON.stringify(LATEX_SOURCES.contract)};
import { renderOptions } from ${JSON.stringify(LATEX_SOURCES.render)};
import { renderTree, treeSizeOf } from ${JSON.stringify(LATEX_SOURCES.tree)};
const target = document.getElementById("t") as HTMLElement;
const draw = (expression: string, element: HTMLElement) => {
  const started = performance.now();
  const scan = scanLatex(expression);
  const tree = renderTree(expression, renderOptions());
  const size = treeSizeOf(tree);
  const beforeMs = performance.now() - started;
  element.replaceChildren(tree.toNode());
  element.getBoundingClientRect();
  document.documentElement.offsetHeight;
  return {
    ms: performance.now() - started,
    nodes: element.getElementsByTagName("*").length,
    scanDepth: scan.depth,
    treeDepth: size.depth,
    treeNodes: size.nodes,
    beforeMs,
  };
};
const page = window as unknown as Record<string, unknown>;
page.__timed = (expression: string) => draw(expression, target);
// Ten elements: all drawn in one task, or one per task (a timeout of 0 between them).
page.__many = async (expression: string, count: number, perTask: boolean) => {
  const elements = Array.from({ length: count }, () => document.createElement("div"));
  for (const element of elements) document.body.append(element);
  const started = performance.now();
  let longest = 0;
  const one = (element: HTMLElement) => {
    const at = performance.now();
    draw(expression, element);
    longest = Math.max(longest, performance.now() - at);
  };
  if (perTask) {
    for (const element of elements) {
      await new Promise<void>((resolve) => setTimeout(() => { one(element); resolve(); }, 0));
    }
  } else {
    for (const element of elements) one(element);
    longest = performance.now() - started;
  }
  const totalMs = performance.now() - started;
  for (const element of elements) element.remove();
  return { totalMs, longestMs: longest };
};
`,
    );
    const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "iife" });
    if (!built.success) throw new Error(built.logs.map(String).join("\n"));
    return (await built.outputs[0]?.text())?.replaceAll("</script", "<\\/script") ?? "";
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
};

let framePage: Promise<string> | undefined;
// The srcdoc of the frame, built once per process.
const srcdoc = (): Promise<string> => {
  framePage ??= Promise.all([katexStyles(), probeScript()]).then(
    ([css, script]) =>
      `<!doctype html><html><head><style>${css}</style><style>body{margin:8px;width:900px}</style></head><body><div id="t"></div><script>${script}</script></body></html>`,
  );
  return framePage;
};

const WARM_UP =
  "\\frac{\\mathbb{R}\\mathcal{L}\\mathfrak{g}\\mathscr{S}}{\\mathsf{a}\\mathtt{b}\\mathbf{c}\\mathit{d}\\boldsymbol{e}} + \\left(\\Bigg(\\int\\sum\\bigg)\\right) + \\sqrt{\\hat{x}^{2}} + \\text{abc}";

/** One engine's page, started on the first render and again after a failure. */
export class LatexFrame {
  readonly engine: Engine;
  #browser: Browser | undefined;
  #context: BrowserContext | undefined;
  #page: Page | undefined;
  #frame: Frame | undefined;
  #version = "";

  constructor(engine: Engine) {
    this.engine = engine;
  }

  /** The engine's version, once a render has started it. */
  get version(): string {
    return this.#version;
  }

  async #start(): Promise<void> {
    if (this.#frame !== undefined) return;
    const browser = await launchEngine(this.engine);
    this.#browser = browser;
    this.#version = browser.version();
    this.#context = await browser.newContext();
    await this.#context.route("**/*", (route) => route.abort());
    const page = await this.#context.newPage();
    this.#page = page;
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.evaluate(
      `(() => { const f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-scripts"); f.style.cssText = "width:1000px;height:600px;border:0"; f.srcdoc = ${JSON.stringify(await srcdoc())}; document.body.append(f); })()`,
    );
    const handle = await page.waitForSelector("iframe");
    const frame = await handle.contentFrame();
    if (frame === null) throw new Error("the frame has no content frame");
    for (let tries = 0; tries < 100; tries += 1) {
      if ((await frame.evaluate("typeof window.__timed").catch(() => "")) === "function") break;
      await sleep(100);
    }
    this.#frame = frame;
    // Fonts load on first use: draw something that uses them all, then wait for them.
    await frame.evaluate(`window.__timed(${JSON.stringify(WARM_UP)})`);
    await frame.evaluate("document.fonts.ready.then(() => 1)");
    await frame.evaluate(`window.__timed(${JSON.stringify(WARM_UP)})`);
  }

  /** Closes the engine; a hung renderer does not hold the run beyond a few seconds. */
  async close(): Promise<void> {
    const browser = this.#browser;
    this.#browser = this.#context = this.#page = this.#frame = undefined;
    if (browser !== undefined)
      await Promise.race([browser.close().catch(() => undefined), sleep(CLOSE_TIMEOUT_MS)]);
  }

  /** Draws `expression`; a failure discards the engine, and the next call starts a new one. */
  async render(expression: string, timeoutMs = RENDER_TIMEOUT_MS): Promise<RenderResult> {
    const result = await this.#call<Drawn>(
      `window.__timed(${JSON.stringify(expression)})`,
      timeoutMs,
    );
    return result.ok ? { ok: true, ...result.value, parentMs: result.parentMs } : result;
  }

  /** Draws `count` copies of `expression` in as many elements, all in one task or one per task. */
  async many(
    expression: string,
    count: number,
    perTask: boolean,
    timeoutMs = RENDER_TIMEOUT_MS * 6,
  ): Promise<({ readonly ok: true; readonly parentMs: number } & Many) | Failure> {
    const result = await this.#call<Many>(
      `window.__many(${JSON.stringify(expression)}, ${count}, ${perTask})`,
      timeoutMs,
    );
    return result.ok ? { ok: true, ...result.value, parentMs: result.parentMs } : result;
  }

  async #call<T>(
    script: string,
    timeoutMs: number,
  ): Promise<{ readonly ok: true; readonly value: T; readonly parentMs: number } | Failure> {
    await this.#start();
    const page = this.#page as Page;
    const frame = this.#frame as Frame;
    const crashed = new Promise<"crash">((resolve) => page.once("crash", () => resolve("crash")));
    const ran = frame.evaluate(script).then(
      (value) => ({ value: value as T }),
      (error: unknown) => ({ error: String(error) }),
    );
    const first = await Promise.race([
      ran,
      crashed,
      sleep(timeoutMs).then(() => "timeout" as const),
    ]);
    if (first === "crash" || first === "timeout") {
      await this.close();
      return {
        ok: false,
        reason: first,
        message: first === "crash" ? "Target crashed" : `no answer in ${timeoutMs} ms`,
      };
    }
    if ("error" in first) {
      const crash = /crash/i.test(first.error);
      if (crash) await this.close();
      return { ok: false, reason: crash ? "crash" : "error", message: first.error.slice(0, 200) };
    }
    const asked = Date.now();
    const answer = await Promise.race([
      page.evaluate("1").then(() => "answered" as const),
      sleep(PARENT_ANSWER_MS).then(() => "slow" as const),
    ]);
    if (answer === "slow") {
      await this.close();
      return {
        ok: false,
        reason: "parent",
        message: `the parent page did not answer in ${PARENT_ANSWER_MS} ms`,
      };
    }
    return { ok: true, value: first.value, parentMs: Date.now() - asked };
  }
}
