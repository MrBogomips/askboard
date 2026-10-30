// The browser side of the harness (design decision 11): Playwright's Chromium, Firefox and WebKit,
// one context per test, recording what the tests assert on besides the page itself.
//
// - CSP violations from every document: an init script listens for `securitypolicyviolation` in
//   each frame, the sandboxed view included, and reports through a binding the browser installs
//   in every frame, beyond the reach of either policy. WebKit reports a blocked `eval` in the view
//   to the board page only, so violations count wherever they land (renderer row 17).
// - Console lines, of which those reporting a CSP block count too: WebKit logs some blocks only
//   there. Page errors and dialogs.
// - Every WebSocket the board page opens, with each frame it sent or received, in order.

import {
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  chromium,
  firefox,
  type Page,
  webkit,
} from "playwright";
import type { Engine } from "./engines.ts";
import { pageMessagesOf, type RecordedSocket, type SentMessage } from "./messages.ts";
import { isCspConsoleLine } from "./policy.ts";

const ENGINE_TYPES = { chromium, firefox, webkit } as const;

export const launchEngine = (engine: Engine): Promise<Browser> => ENGINE_TYPES[engine].launch();

export type Violation = {
  /** The document that received it: the board page's URL, or `about:srcdoc` for the view. */
  readonly url: string;
  readonly directive: string;
  readonly blocked: string;
};

export type ConsoleLine = { readonly type: string; readonly text: string; readonly url: string };

const BINDING = "__askboardTestViolation";
const ACTION_TIMEOUT_MS = 5_000;
const NAVIGATION_TIMEOUT_MS = 10_000;

// Runs in every frame before the frame's own scripts. Test code: it reaches the page through the
// browser's debugging protocol, which no CSP governs.
const listenForViolations = (binding: string) => {
  document.addEventListener(
    "securitypolicyviolation",
    (event) => {
      const report = (globalThis as unknown as Record<string, unknown>)[binding];
      if (typeof report !== "function") return;
      report({
        url: location.href,
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      });
    },
    true,
  );
};

type MutableSocket = { url: string; frames: { dir: "sent" | "received"; text: string }[] };

export type BoardContextOptions = { readonly colorScheme?: "light" | "dark" };

/** One browser context with its recorders; every tab a test opens belongs to it. */
export class BoardContext {
  readonly violations: Violation[] = [];
  readonly console: ConsoleLine[] = [];
  readonly errors: string[] = [];
  readonly dialogs: string[] = [];
  readonly #sockets: MutableSocket[] = [];
  readonly #context: BrowserContext;

  private constructor(context: BrowserContext) {
    this.#context = context;
  }

  static async open(browser: Browser, options: BoardContextOptions = {}): Promise<BoardContext> {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: options.colorScheme ?? "light",
    });
    // Bounded below a test's timeout, so a stuck step fails with what it waited for.
    context.setDefaultTimeout(ACTION_TIMEOUT_MS);
    context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    const board = new BoardContext(context);
    await context.exposeBinding(BINDING, (_source, violation: Violation) => {
      board.violations.push(violation);
    });
    await context.addInitScript(listenForViolations, BINDING);
    return board;
  }

  get context(): BrowserContext {
    return this.#context;
  }

  /** Every WebSocket opened so far, with its frames; one that never opened has none. */
  get sockets(): readonly RecordedSocket[] {
    return this.#sockets;
  }

  /** What the board page sent, by socket, numbered as the transcripts number them. */
  pageMessages(): SentMessage[] {
    return pageMessagesOf(this.#sockets);
  }

  /** Violations and CSP console lines, one line each: what a test expects to be empty. */
  cspProblems(): string[] {
    return [
      ...this.violations.map(
        (v) => `violation in ${v.url}: ${v.directive} blocked ${v.blocked || "(inline)"}`,
      ),
      ...this.console
        .filter((line) => isCspConsoleLine(line.text))
        .map((line) => `console of ${line.url || "the page"}: ${line.text}`),
    ];
  }

  /** A new tab with the recorders attached, at the link. */
  async newTab(link: string): Promise<Page> {
    const page = await this.#context.newPage();
    page.on("console", (message: ConsoleMessage) => {
      this.console.push({
        type: message.type(),
        text: message.text(),
        url: message.location().url,
      });
    });
    page.on("pageerror", (error) => this.errors.push(String(error)));
    page.on("dialog", (dialog) => {
      this.dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    page.on("websocket", (socket) => {
      const record: MutableSocket = { url: socket.url(), frames: [] };
      this.#sockets.push(record);
      socket.on("framesent", (frame) =>
        record.frames.push({ dir: "sent", text: String(frame.payload) }),
      );
      socket.on("framereceived", (frame) =>
        record.frames.push({ dir: "received", text: String(frame.payload) }),
      );
    });
    await page.goto(link);
    return page;
  }

  async close(): Promise<void> {
    await this.#context.close();
  }
}
