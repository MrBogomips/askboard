// The manifest of the browser files (design decision 4): which files exist, which engines each runs
// in, which belong to the smoke set and which to the perf set. The runner chooses each engine's files
// from it, so no `bun test` process starts a file that has no tests for its engine, and
// `suites.test.ts` fails on a file the manifest does not list (and on any other drift), so a new
// browser file must be classified here.

import { basename } from "node:path";
import { ENGINES, type Engine, enginesFrom } from "./engines.ts";

export type BrowserFileEntry = {
  /** A subset of `ENGINES`; every engine when absent. Needs `why`, and the file loops over `enginesFor`. */
  readonly engines?: readonly Engine[];
  /** The requirement, or the archived change's task, that names fewer engines. */
  readonly why?: string;
  /** In the smoke set: the files that cover `SPINE_CHECKS`. */
  readonly smoke?: true;
  /** In the perf set: timed bounds, judged alone, never in `full`. */
  readonly perf?: true;
};

const MARKDOWN_ENGINES = ["chromium", "webkit"] as const;
const MARKDOWN_WHY =
  "Markdown bounded work is checked in Chromium and WebKit (the Markdown spec's bounded-work requirement); Firefox is not part of it";

/** Every `*.browser.ts` file under `packages/view/test/browser/`, by file name. */
export const BROWSER_FILES: Readonly<Record<string, BrowserFileEntry>> = {
  "approval.browser.ts": {},
  "approval-answer.browser.ts": {},
  "approval-latex.browser.ts": {},
  "approval-submit.browser.ts": {},
  "atoms-it.browser.ts": {},
  "atoms-session.browser.ts": {},
  "atoms-snapshot.browser.ts": {},
  "board.browser.ts": { smoke: true },
  "chart.browser.ts": {},
  "chart-hover.browser.ts": {},
  "chart-it.browser.ts": {},
  "chart-session.browser.ts": {},
  "chart-snapshot.browser.ts": {},
  "chart-theme.browser.ts": {},
  "connection.browser.ts": { smoke: true },
  "context-card.browser.ts": {},
  "context-items.browser.ts": {},
  "context-panel.browser.ts": { smoke: true },
  "context-reference.browser.ts": {},
  "context-snapshot.browser.ts": {},
  "context-uj1.browser.ts": {},
  "date-atom.browser.ts": {},
  "density.browser.ts": {},
  "display-atoms.browser.ts": {},
  "document-review.browser.ts": {},
  "document-review-session.browser.ts": {},
  "document-review-snapshot.browser.ts": {},
  "edit-widgets-it.browser.ts": {},
  "edit-widgets-session.browser.ts": {},
  "edit-widgets-snapshot.browser.ts": {},
  "field-atoms.browser.ts": {},
  "form-fields.browser.ts": {},
  "form-session.browser.ts": {},
  "form-snapshot.browser.ts": {},
  "gantt-axis.browser.ts": {},
  "gantt-board.browser.ts": {},
  "gantt-changes.browser.ts": {},
  "gantt-column.browser.ts": {},
  "gantt-critical-path.browser.ts": {},
  "gantt-critical-switch.browser.ts": {},
  "gantt-double-click.browser.ts": {},
  "gantt-drag.browser.ts": {},
  "gantt-editing.browser.ts": {},
  "gantt-keys.browser.ts": {},
  "gantt-layout.browser.ts": {},
  "gantt-plan.browser.ts": {},
  "gantt-plan-duration.browser.ts": {},
  "gantt-plan-tree.browser.ts": {},
  "gantt-plan-uj2.browser.ts": {},
  "gantt-predecessors.browser.ts": {},
  "gantt-reading.browser.ts": {},
  "harness.browser.ts": { smoke: true },
  "header.browser.ts": {},
  "hover-audit.browser.ts": {},
  "hover-layer.browser.ts": {},
  "kanban.browser.ts": {},
  "keep-mine-reload-session.browser.ts": {},
  "keys-browser.browser.ts": {},
  "keys-config.browser.ts": {},
  "keys-help.browser.ts": {},
  "languages.browser.ts": {},
  "latex.browser.ts": {},
  "latex-bounds.browser.ts": { perf: true },
  "layouts.browser.ts": {},
  "layouts-session.browser.ts": {},
  "layouts-snapshot.browser.ts": {},
  "lifecycle-acts.browser.ts": {},
  "lifecycle-board-page.browser.ts": { smoke: true },
  "lifecycle-card.browser.ts": {},
  "lifecycle-delivery.browser.ts": {},
  "lifecycle-header.browser.ts": {},
  "lifecycle-keyboard.browser.ts": {},
  "lifecycle-presentations.browser.ts": {},
  "lifecycle-revisions.browser.ts": {},
  "locale-widgets.browser.ts": {},
  "markdown.browser.ts": {},
  "markdown-bounds.browser.ts": { engines: MARKDOWN_ENGINES, why: MARKDOWN_WHY, perf: true },
  "markdown-total.browser.ts": { engines: MARKDOWN_ENGINES, why: MARKDOWN_WHY, perf: true },
  "number-atoms.browser.ts": {},
  "oversized-acts-session.browser.ts": {},
  "pick-field.browser.ts": {},
  "presence.browser.ts": {},
  "presentation.browser.ts": {},
  "presentation-persistence.browser.ts": {},
  "ranking.browser.ts": {},
  "ranking-keys.browser.ts": {},
  "ranking-keys-session.browser.ts": {},
  "reopen-session.browser.ts": {},
  "result-widgets-it.browser.ts": {},
  "result-widgets-session.browser.ts": {},
  "result-widgets-snapshot.browser.ts": {},
  "scale.browser.ts": {},
  "segment-underline.browser.ts": {},
  "settings-panel.browser.ts": {},
  "shown-revision-act-session.browser.ts": {},
  "shown-revision-draft-session.browser.ts": {},
  "shown-revision-items-session.browser.ts": {},
  "shown-revision-wiring-session.browser.ts": {},
  "small-fixes.browser.ts": {},
  "snapshot-banner.browser.ts": {},
  "snapshot-control.browser.ts": {},
  "snapshot-session.browser.ts": {},
  "snapshot-view.browser.ts": { smoke: true },
  "submit-failed-item-session.browser.ts": {},
  "table.browser.ts": {},
  "table-bounds.browser.ts": { perf: true },
  "table-keys.browser.ts": {},
  "table-session.browser.ts": {},
  "table-snapshot.browser.ts": {},
  "tabs.browser.ts": {},
  "text.browser.ts": {},
  "timeline.browser.ts": {},
  "toggles.browser.ts": {},
  "tree-adding.browser.ts": {},
  "tree-adjust.browser.ts": {},
  "tree-coherence.browser.ts": {},
  "tree-current-row.browser.ts": {},
  "tree-deleting.browser.ts": {},
  "tree-drag.browser.ts": {},
  "tree-drag-answer.browser.ts": {},
  "tree-editing.browser.ts": {},
  "tree-keys.browser.ts": {},
  "tree-layout.browser.ts": {},
  "tree-marks.browser.ts": {},
  "tree-moving.browser.ts": {},
  "tree-read-only.browser.ts": {},
  "tree-selection.browser.ts": {},
  "tree-toolbar.browser.ts": {},
  "tree-uj2.browser.ts": {},
  "uj2-editing-plus.browser.ts": {},
  "update-components.browser.ts": {},
  "view.browser.ts": { smoke: true },
  "wbs.browser.ts": {},
  "wbs-answer.browser.ts": {},
  "wbs-editing.browser.ts": {},
  "wbs-linking.browser.ts": {},
  "wbs-pointer.browser.ts": {},
  "widget-agent-change.browser.ts": {},
  "widget-answered.browser.ts": {},
  "widget-board-page.browser.ts": {},
  "widget-chrome-it.browser.ts": {},
  "widget-derived.browser.ts": {},
  "widget-draft-fits.browser.ts": {},
  "widget-host.browser.ts": {},
  "widget-revision.browser.ts": {},
};

export type SpineCheck = {
  readonly check: string;
  /** The smoke files and the exact test titles that cover the check. */
  readonly covers?: readonly { readonly file: string; readonly title: string }[];
  /** The reason no file covers it yet. */
  readonly why?: string;
};

/** The checks the spine's Tests row names for the smoke set. */
export const SPINE_CHECKS: readonly SpineCheck[] = [
  {
    check: "cold load",
    covers: [
      {
        file: "board.browser.ts",
        title: "the plain-choice board: tab title, header, chip, three options with descriptions",
      },
    ],
  },
  {
    check: "reload",
    covers: [
      {
        file: "board.browser.ts",
        title:
          "a reload: the board comes back answered, delivered to the agent, revisable, with no token in the view",
      },
      {
        file: "lifecycle-board-page.browser.ts",
        title:
          "a reload keeps the ready answer and the note, in submitted delivery, and nothing was sent",
      },
    ],
  },
  {
    check: "takeover",
    covers: [
      {
        file: "connection.browser.ts",
        title: "the plain-choice session: answer, delivered, taken over by a second tab, discarded",
      },
      {
        file: "lifecycle-board-page.browser.ts",
        title:
          "a takeover keeps the ready answer and the note: the older tab sends its last draft at once",
      },
    ],
  },
  {
    check: "source view",
    covers: [
      {
        file: "context-panel.browser.ts",
        title: "the source view framed from http://localhost:<port> is refused",
      },
    ],
  },
  {
    check: 'self.origin === "null"',
    covers: [
      {
        file: "view.browser.ts",
        title: "the view's origin is opaque and its frame is sandboxed with allow-scripts only",
      },
    ],
  },
  {
    check: "a failing view fetch",
    covers: [
      {
        file: "view.browser.ts",
        title:
          "the view tries to reach the network: the request fails and the session receives nothing",
      },
    ],
  },
  {
    check: "the box unchanged 1 s after visible",
    covers: [
      {
        file: "view.browser.ts",
        title:
          "a question becomes visible once its options have rendered, and its box is unchanged 1 s later",
      },
    ],
  },
  {
    check: "a board rendered",
    covers: [
      {
        file: "board.browser.ts",
        title: "the plain-choice board: tab title, header, chip, three options with descriptions",
      },
    ],
  },
  {
    check: "a Snapshot rendered",
    covers: [
      {
        file: "snapshot-view.browser.ts",
        title: "the agent's Snapshot: the top line, the answered state, no control that acts",
      },
    ],
  },
  {
    check: "CSP collection",
    covers: [
      {
        file: "view.browser.ts",
        title: "a board loads with no CSP violation from the view, the board page or the console",
      },
      { file: "harness.browser.ts", title: "catches a caught eval on the board page" },
    ],
  },
  {
    check: "NFR-10: discarded and moved states",
    covers: [
      {
        file: "connection.browser.ts",
        title:
          "the session ends: the board shows the ask discarded, stays readable, accepts no answer",
      },
    ],
  },
  {
    check: "PlantUML images",
    why: "no PlantUML widget on main (git grep -il plantuml finds none in the widgets or view sources); the check joins the smoke set with the widget",
  },
];

/** The engines a browser file runs in: its manifest engines, narrowed by `ASKBOARD_E2E_ENGINES`. */
export const enginesFor = (file: string): Engine[] => {
  const name = basename(file);
  const entry = BROWSER_FILES[name];
  if (entry === undefined) throw new Error(`${name} is not in BROWSER_FILES (harness/suites.ts)`);
  const wanted = enginesFrom(process.env.ASKBOARD_E2E_ENGINES);
  const own = entry.engines ?? ENGINES;
  return ENGINES.filter((engine) => own.includes(engine) && wanted.includes(engine));
};

const INLINE_FILTER = /enginesFrom\([^)]*\)\s*\.filter\(/;

const entryProblems = (
  name: string,
  entry: BrowserFileEntry,
  text: string | undefined,
): string[] => {
  const problems: string[] = [];
  if (entry.smoke && entry.perf) problems.push(`${name} is both smoke and perf`);
  const own = entry.engines;
  if (own === undefined) return problems;
  for (const engine of own) {
    if (!(ENGINES as readonly string[]).includes(engine)) {
      problems.push(`${name} lists an unknown engine "${engine}"`);
    }
  }
  if (own.length === 0) problems.push(`${name} lists no engine`);
  if (own.length < ENGINES.length) {
    if (entry.why === undefined || entry.why.trim() === "") {
      problems.push(`${name} narrows its engines without a why`);
    }
    if (text !== undefined && !text.includes("enginesFor(")) {
      problems.push(`${name} narrows its engines but does not call enginesFor`);
    }
  }
  return problems;
};

const spineProblems = (
  entries: Readonly<Record<string, BrowserFileEntry>>,
  texts: Readonly<Record<string, string>>,
  spine: readonly SpineCheck[],
): string[] => {
  const problems: string[] = [];
  for (const { check, covers, why } of spine) {
    if (covers === undefined || covers.length === 0) {
      if (why === undefined || why.trim() === "") problems.push(`${check}: neither covers nor why`);
      continue;
    }
    for (const { file, title } of covers) {
      if (entries[file]?.smoke !== true) {
        problems.push(`${check}: ${file} is not in the smoke set`);
      } else if (!(texts[file] ?? "").includes(title)) {
        problems.push(`${check}: "${title}" is not a title in ${file}`);
      }
    }
  }
  return problems;
};

/**
 * What is wrong with a manifest, given the text of each browser file by name: an empty list when
 * nothing is. Pure, so the test can feed it a broken manifest.
 */
export const suitesProblems = (
  entries: Readonly<Record<string, BrowserFileEntry>>,
  texts: Readonly<Record<string, string>>,
  spine: readonly SpineCheck[],
): string[] => {
  const problems: string[] = [];
  for (const name of Object.keys(texts)) {
    if (!(name in entries)) problems.push(`${name} has no entry in BROWSER_FILES`);
    if (INLINE_FILTER.test(texts[name] ?? "")) {
      problems.push(`${name} filters enginesFrom(...) inline: use enginesFor(import.meta.path)`);
    }
  }
  for (const [name, entry] of Object.entries(entries)) {
    if (!(name in texts)) problems.push(`${name} has no file`);
    problems.push(...entryProblems(name, entry, texts[name]));
  }
  return [...problems, ...spineProblems(entries, texts, spine)];
};
