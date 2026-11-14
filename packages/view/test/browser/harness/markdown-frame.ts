// The Markdown renderer in a browser engine (atoms, task 4.1; view-and-widgets spec: Markdown
// rendered as data): the view's real document shape, a parent page holding a `sandbox="allow-scripts"`
// srcdoc frame whose meta tag carries the view's own policy (`viewPolicy`, with the one inline script
// by its hash and no style at all), and in the frame a bundle of `renderMarkdown` that fills a
// container the way the Text component will. What the page sees is recorded: the container's HTML,
// each element's attributes, every CSP violation (the frame's event, and the console lines that
// report a block, which WebKit may log only there) and every request the context made. Nothing leaves
// the machine: every request is aborted. No server, no board.

import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, BrowserContext, Frame, Page } from "playwright";
import { viewPolicy } from "../../../src/assemble/index.ts";
import type { SelectedChunk } from "../../../src/assemble/select.ts";
import { launchEngine } from "./browser.ts";
import type { Engine } from "./engines.ts";
import { isCspConsoleLine } from "./policy.ts";

const MARKDOWN = join(import.meta.dir, "../../../src/markdown/markdown.ts");
const SETTLE_MS = 150;

/** What one render left in the frame. */
export type Rendered = {
  /** `undefined` when the renderer gave none: over its bound, or no sanitizer. */
  readonly html: string | undefined;
  /** Every element's tag with its attributes, `tag name=value`, in document order. */
  readonly attributes: readonly string[];
  /** The text the container shows. */
  readonly text: string;
  /** From the call to the end of a forced layout, in milliseconds. */
  readonly ms: number;
  /** The CSP violations raised since the render began, from the frame and the console. */
  readonly violations: readonly string[];
  /** The elements in the container. */
  readonly nodes: number;
};

const script = async (): Promise<string> => {
  const folder = await mkdtemp(join(tmpdir(), "askboard-markdown-frame-"));
  try {
    const entry = join(folder, "entry.ts");
    await writeFile(
      entry,
      `import { renderMarkdown, sanitizeHtml } from ${JSON.stringify(MARKDOWN)};
const target = document.getElementById("t") as HTMLElement;
const violations: string[] = [];
document.addEventListener("securitypolicyviolation", (event) => {
  violations.push(event.violatedDirective + " " + event.blockedURI);
});
const page = window as unknown as Record<string, unknown>;
// What the container holds after a fragment is put in it, once the engine has had time to report.
const shown = async (fragment: DocumentFragment | undefined, started: number) => {
  target.replaceChildren(...(fragment === undefined ? [] : [fragment]));
  target.getBoundingClientRect();
  document.documentElement.offsetHeight;
  const ms = performance.now() - started;
  await new Promise<void>((resolve) => setTimeout(resolve, ${SETTLE_MS}));
  return {
    html: fragment === undefined ? undefined : target.innerHTML,
    attributes: Array.from(target.getElementsByTagName("*"), (element) =>
      [element.tagName.toLowerCase(), ...Array.from(element.attributes, (a) => a.name + "=" + a.value)].join(" ")),
    text: target.textContent ?? "",
    ms,
    violations: [...violations],
    nodes: target.getElementsByTagName("*").length,
  };
};
page.__render = (source: string) => {
  violations.length = 0;
  const started = performance.now();
  return shown(renderMarkdown(source, window), started);
};
// The sanitizer alone, on HTML markdown-it would never write.
page.__sanitize = (dirty: string) => {
  violations.length = 0;
  const started = performance.now();
  return shown(sanitizeHtml(dirty, window), started);
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

let srcdocOnce: Promise<string> | undefined;

// The frame's document: the view's policy, naming only this script by its hash.
const srcdoc = (): Promise<string> => {
  srcdocOnce ??= script().then((code) => {
    const sha256 = createHash("sha256").update(code).digest("hex");
    const selection = [{ name: "markdown", chunk: { script: { sha256 }, styles: [] } }];
    const policy = viewPolicy(selection as unknown as readonly SelectedChunk[]);
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body><div id="t"></div><script>${code}</script></body></html>`;
  });
  return srcdocOnce;
};

/** One engine's page with the renderer in a sandboxed, policed frame. */
export class MarkdownFrame {
  readonly engine: Engine;
  #browser: Browser | undefined;
  #context: BrowserContext | undefined;
  #page: Page | undefined;
  #frame: Frame | undefined;
  readonly #requests: string[] = [];
  readonly #console: string[] = [];

  constructor(engine: Engine) {
    this.engine = engine;
  }

  /** The URL of every request the context made, none expected. */
  get requests(): readonly string[] {
    return this.#requests;
  }

  async #start(): Promise<Frame> {
    if (this.#frame !== undefined) return this.#frame;
    const browser = await launchEngine(this.engine);
    this.#browser = browser;
    const context = await browser.newContext();
    this.#context = context;
    await context.route("**/*", (route) => {
      this.#requests.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    this.#page = page;
    page.on("console", (message) => {
      if (isCspConsoleLine(message.text())) this.#console.push(message.text());
    });
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.evaluate(
      `(() => { const f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-scripts"); f.srcdoc = ${JSON.stringify(await srcdoc())}; document.body.append(f); })()`,
    );
    const handle = await page.waitForSelector("iframe");
    const frame = await handle.contentFrame();
    if (frame === null) throw new Error("the frame has no content frame");
    for (let tries = 0; tries < 100; tries += 1) {
      if ((await frame.evaluate("typeof window.__render").catch(() => "")) === "function") break;
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    this.#requests.length = 0;
    this.#frame = frame;
    return frame;
  }

  async close(): Promise<void> {
    const browser = this.#browser;
    this.#browser = this.#context = this.#page = this.#frame = undefined;
    await browser?.close().catch(() => undefined);
  }

  /** Renders `source` into the frame's container and says what the page saw. */
  render(source: string): Promise<Rendered> {
    return this.#call("__render", source);
  }

  /** Puts `dirty` HTML through the sanitizer alone into the container, and says what the page saw. */
  sanitize(dirty: string): Promise<Rendered> {
    return this.#call("__sanitize", dirty);
  }

  async #call(name: "__render" | "__sanitize", argument: string): Promise<Rendered> {
    const frame = await this.#start();
    this.#console.length = 0;
    const result = (await frame.evaluate(
      `window.${name}(${JSON.stringify(argument)})`,
    )) as Rendered;
    return { ...result, violations: [...result.violations, ...this.#console] };
  }
}
