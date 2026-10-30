// The view spec's scenarios about the view itself, in each engine (specs/view-and-widgets):
// sandbox and origin, no token in the view, the view's `fetch`, the policy, agent content as text,
// question loading, an item that throws, and the theme.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { MARKUP_LABEL, markupBoardDocument } from "./fixtures/markup-document.ts";
import {
  enabledCount,
  expectNoCspProblem,
  expectNoTokenInView,
  QUESTION,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { parsePolicy } from "./harness/policy.ts";
import { replayTranscripts, withDocument } from "./harness/transcripts.ts";
import { readViewBuild, withThrowingChoice } from "./harness/view-build.ts";

const dist = await readViewBuild();
const throwing = await withThrowingChoice(dist);
const { opening } = replayTranscripts;

// DESIGN.md's page background in each scheme, as a computed style reads it.
const design = await Bun.file(
  join(import.meta.dir, "../../../../docs/ux-askboard-2026-10-27/DESIGN.md"),
).text();
const colors = (
  Bun.YAML.parse(/^---\n([\s\S]*?)\n---$/m.exec(design)?.[1] ?? "") as {
    colors: Record<string, string>;
  }
).colors;
const rgb = (hex = "") =>
  `rgb(${(hex.slice(1).match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)).join(", ")})`;
const BACKGROUND = { light: rgb(colors.background), dark: rgb(colors["background-dark"]) };

// Runs in the document it is evaluated in.
const background = () => getComputedStyle(document.documentElement).backgroundColor;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the view`, () => {
    const { start } = useEngine(engine);

    test(
      "the view holds no part of the token: not in its base URL, its referrer or its location",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        await expectNoTokenInView(board, run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the view's origin is opaque and its frame is sandboxed with allow-scripts only",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        expect(await board.frame.count()).toBe(1);
        expect(await board.frame.getAttribute("sandbox")).toBe("allow-scripts");
        expect(await board.frame.getAttribute("srcdoc")).toContain("askboard-data");
        const view = await board.viewFrame();
        expect(await view.evaluate(() => self.origin)).toBe("null");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the view tries to reach the network: the request fails and the session receives nothing",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        const path = `/view-fetch-probe-${crypto.randomUUID()}`;
        const url = new URL(path, run.session.link).href;
        const view = await board.viewFrame();
        const outcome = await view.evaluate(async (target) => {
          try {
            await fetch(target);
            return "fetched";
          } catch {
            return "failed";
          }
        }, url);
        await Bun.sleep(300);
        expect(outcome).toBe("failed");
        expect(run.session.requests()).not.toContain(`GET ${path}`);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a board loads with no CSP violation from the view, the board page or the console",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        const srcdoc = (await board.frame.getAttribute("srcdoc")) ?? "";
        const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(srcdoc);
        const policy = parsePolicy(meta?.[1] ?? "");
        expect(policy.get("default-src")).toEqual(["'none'"]);
        for (const directive of [
          "connect-src",
          "object-src",
          "frame-src",
          "form-action",
          "base-uri",
        ]) {
          expect(policy.get(directive)).toEqual(["'none'"]);
        }
        expect(meta?.[1] ?? "").not.toMatch(/unsafe-|wasm/);
        await Bun.sleep(1_000);
        expect(run.browser.errors).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "markup in an option label, and in every other agent string, shows as text",
      async () => {
        const transcript = withDocument(opening, markupBoardDocument);
        const run = await start({ transcript, view: dist });
        const board = await run.open();
        const [question] = markupBoardDocument.items;
        await board.option(MARKUP_LABEL).waitFor({ timeout: STEP_TIMEOUT_MS });
        const view = await board.viewFrame();
        // biome-ignore lint/performance/useDomNodeTextContent: the rendered text is what the user sees.
        const shown = await view.evaluate(() => document.body.innerText);
        for (const text of [
          markupBoardDocument.title,
          question.props.text,
          question.props.header ?? "",
          ...question.props.options.flatMap((option) => [option.label, option.description ?? ""]),
        ]) {
          expect(shown).toContain(text);
        }
        // No element made from the agent's markup; the data block holds it as JSON, not as code.
        const created = await view.evaluate(() => {
          const code = [
            ...document.querySelectorAll('script:not([type="application/json"]), style'),
          ];
          return [
            ...document.querySelectorAll('img[src="x"], [onerror], a[href^="https://example.com"]'),
            ...[...document.querySelectorAll("b, i")].filter((element) =>
              ["Bold title", "chip"].includes(element.textContent ?? ""),
            ),
            ...code.filter((element) =>
              /document\.title='owned'|\*\{display:none\}/.test(element.textContent ?? ""),
            ),
          ].map((element) => element.outerHTML.slice(0, 80));
        });
        expect(created).toEqual([]);
        expect(await board.page.title()).toBe(`${markupBoardDocument.title} · AskBoard`);
        expect(run.browser.dialogs).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question becomes visible once its options have rendered, and its box is unchanged 1 s later",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        const card = board.question(QUESTION);
        expect(await board.options.count()).toBe(3);
        const first = await card.boundingBox();
        await Bun.sleep(1_000);
        expect(await card.getAttribute("aria-busy")).not.toBe("true");
        expect(await card.boundingBox()).toEqual(first);
        expect(first?.height ?? 0).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a component that throws: the item shows an error, the board stays usable, no Answer",
      async () => {
        const run = await start({ transcript: opening, view: throwing });
        const board = await run.openTab();
        const card = board.question(QUESTION);
        await card.getByRole("alert").waitFor({ timeout: STEP_TIMEOUT_MS * 2 });
        await board.header
          .getByText("Waiting", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.header.textContent()).toContain(plainChoiceBoardDocument.title);
        expect(await enabledCount(board.answer)).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    for (const scheme of ["dark", "light"] as const) {
      test(
        `a ${scheme} system: the board page and the view use DESIGN.md's ${scheme} tokens`,
        async () => {
          const run = await start({ transcript: opening, view: dist }, { colorScheme: scheme });
          const board = await run.open();
          const view = await board.viewFrame();
          expect(await board.page.evaluate(background)).toBe(BACKGROUND[scheme]);
          expect(await view.evaluate(background)).toBe(BACKGROUND[scheme]);
          const dark = await view.evaluate(() => document.querySelector(".dark") !== null);
          expect(dark).toBe(scheme === "dark");
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
