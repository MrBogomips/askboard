import { describe, expect, test } from "bun:test";
import { join, relative } from "node:path";

// The source guard of nested items (layouts, design decision 2): every direct read of a
// question's `items` in a package's sources, outside the walker, is listed here with the reason it
// reads one level. A read that is not listed fails, so a unit that should walk the layouts cannot
// be added unseen, and an entry that no read matches fails too, so the table does not go stale.

type Read = {
  readonly file: string;
  readonly text: string;
  readonly reason: string;
  /** How many lines of the file the entry covers: one unless it says more. */
  readonly count?: number;
};

const CONTEXT = "context items and molecule references stay in the question's own items";
const AREA = "an area's items are its questions, never layouts";
const RANKING = "a Ranking's items are its elements, never a question's items";
const PATH = "the path of an item as the request names it, from which the walker's paths continue";
const FIXTURE = "a fixture's own area or question, whose items hold no layout";
const THROUGH =
  "the question's own list, the walker's start: the layouts in it are walked from here (task 1.3)";

/** The direct reads in `contract`'s sources: each starts from a question's own list or names a path. */
const CONTRACT_READS: readonly Read[] = [
  {
    file: "packages/contract/src/ask-items.ts",
    text: "Array.isArray(props.items)",
    reason: "the list an area or a question holds: the walker's start, and the area's questions",
  },
  {
    file: "packages/contract/src/ask-items.ts",
    text: 'contextOf(question), [...at, "props", "items"]',
    reason: THROUGH,
    count: 2,
  },
  {
    file: "packages/contract/src/ask-items.ts",
    text: 'placedItems(childrenOf(item), [...at, "props", "items"]',
    reason: AREA,
  },
  {
    file: "packages/contract/src/ask-items.ts",
    text: '[...place, "props", "items", String(each)]',
    reason: AREA,
  },
  {
    file: "packages/contract/src/ask-items.ts",
    text: 'isArea(item) && rest[0] === "props"',
    reason: `${AREA}; the path below it names a question`,
  },
  { file: "packages/contract/src/ask-items.ts", text: "rest.length > 3", reason: PATH },
  {
    file: "packages/contract/src/ask-items.ts",
    text: '"items" in props',
    reason: "a question with options and items together is refused for its options",
  },
  {
    file: "packages/contract/src/context/document.ts",
    text: "props.items",
    reason: CONTEXT,
    count: 2,
  },
  {
    file: "packages/contract/src/draft-record.ts",
    text: "item.props.items : [item]",
    reason: AREA,
  },
  { file: "packages/contract/src/draft-record.ts", text: "question.props as", reason: THROUGH },
  {
    file: "packages/contract/src/fixtures/gantt.ts",
    text: "TREE_QUESTION.props.items",
    reason: FIXTURE,
  },
  {
    file: "packages/contract/src/fixtures/lifecycle-messages.ts",
    text: "props.items",
    reason: FIXTURE,
    count: 2,
  },
  {
    file: "packages/contract/src/fixtures/lifecycle.ts",
    text: "props.items",
    reason: FIXTURE,
    count: 2,
  },
  {
    file: "packages/contract/src/fixtures/lifecycle.ts",
    text: "...regionProps } = region.props",
    reason: FIXTURE,
  },
  {
    file: "packages/contract/src/fixtures/molecules.ts",
    text: "PLAN_QUESTION.props.items",
    reason: FIXTURE,
  },
  {
    file: "packages/contract/src/fixtures/snapshot.ts",
    text: "delivery.props.items",
    reason: FIXTURE,
    count: 2,
  },
  { file: "packages/contract/src/requests.ts", text: 'segments[0] === "items"', reason: PATH },
  { file: "packages/contract/src/requests.ts", text: 'segments[0] !== "items"', reason: PATH },
  { file: "packages/contract/src/widgets/gantt/checks.ts", text: "props.items", reason: THROUGH },
  {
    file: "packages/contract/src/widgets/row/checks.ts",
    text: "props.items",
    reason: "a Row's own items, the IDs its widths may name; the items inside them are another's",
  },
  {
    file: "packages/contract/src/widgets/ranking/checks.ts",
    text: "props.items",
    reason: RANKING,
    count: 2,
  },
  {
    file: "packages/contract/src/widgets/ranking/wording.ts",
    text: '!== "items"',
    reason: RANKING,
  },
  {
    file: "packages/contract/src/widgets/ranking/wording.ts",
    text: "item.props.items",
    reason: RANKING,
  },
];

const START = "the question's own list, the walker's start: the layouts in it are walked from here";
const MOLECULES = "molecule references stay in the question's own items, never in a layout";
const REFERENCES =
  "a molecule reference's items stay in the question's own list, where reference addressing reads them";

/** The direct reads in `core`'s sources (layouts, tasks 2.1 and 2.2). */
const CORE_READS: readonly Read[] = [
  { file: "packages/core/src/graph-check.ts", text: "item.props.items", reason: START },
  { file: "packages/core/src/core.ts", text: "first.props.items[0]", reason: AREA },
  {
    file: "packages/core/src/ask.ts",
    text: "boardQuestion(question).props.items",
    reason: "a context item's pointer source: context items stay in the question's own items",
  },
  { file: "packages/core/src/context/board-props.ts", text: "...rest } = props", reason: CONTEXT },
  { file: "packages/core/src/context/fetch-item.ts", text: "item.props.items", reason: AREA },
  { file: "packages/core/src/context/fetch-item.ts", text: "{ items } = props", reason: CONTEXT },
  { file: "packages/core/src/context/resolve.ts", text: "props.items", reason: CONTEXT, count: 3 },
  { file: "packages/core/src/context/warnings.ts", text: "props.items", reason: CONTEXT },
  {
    file: "packages/core/src/lifecycle/model.ts",
    text: "item.props.items",
    reason: AREA,
    count: 2,
  },
  { file: "packages/core/src/lifecycle/updates.ts", text: "item.props.items", reason: AREA },
  { file: "packages/core/src/lifecycle/widget-fetch.ts", text: "area.props.items", reason: AREA },
  { file: "packages/core/src/lifecycle/model.ts", text: "{ items } = (props", reason: START },
  {
    file: "packages/core/src/lifecycle/widget-fetch.ts",
    text: "{ items } = props",
    reason: REFERENCES,
  },
  { file: "packages/core/src/lifecycle/widget-fetch.ts", text: "{ items = [] }", reason: START },
  { file: "packages/core/src/lifecycle/widget-update.ts", text: "{ items }", reason: START },
  {
    file: "packages/core/src/lifecycle/widget-values.ts",
    text: "{ items } = props",
    reason: START,
    count: 2,
  },
  { file: "packages/core/src/molecules/addressing.ts", text: "question.props as", reason: START },
  {
    file: "packages/core/src/molecules/expand.ts",
    text: "props.items",
    reason: MOLECULES,
    count: 2,
  },
  {
    file: "packages/core/src/molecules/expand.ts",
    text: '"props", "items"',
    reason: MOLECULES,
    count: 3,
  },
  {
    file: "packages/core/src/molecules/references.ts",
    text: "props.items",
    reason: MOLECULES,
    count: 2,
  },
];

/** `compute` reads no question's items: the graph source takes the flat list `core` hands it. */
const COMPUTE_READS: readonly Read[] = [];

/** The direct reads in `server`'s sources. */
const SERVER_READS: readonly Read[] = [
  { file: "packages/server/src/mcp-tools/wait.ts", text: "item.props.items", reason: AREA },
  { file: "packages/server/src/mcp-tools/wait.ts", text: "question.props as", reason: START },
];

const HANDED =
  "the question's own list, handed to the view's walker (`nested-items.ts`), which walks the layouts";
const CARD =
  "the card's own list, which `renderedOf` keeps: a layout draws its items through the port";
const VIEW_AREA = "an area's items are its questions, never layouts";

/** The direct reads in `view`'s sources (layouts, task 3.1). */
const VIEW_READS: readonly Read[] = [
  {
    file: "packages/view/src/board-page/model.ts",
    text: "valueItemsOf(question.props.items)",
    reason: HANDED,
    count: 2,
  },
  {
    file: "packages/view/src/board-page/references.ts",
    text: "nestedWidgetItemsOf(question.props.items)",
    reason: HANDED,
  },
  {
    file: "packages/view/src/catalog/components.ts",
    text: "(question.props.items ?? [])",
    reason: CARD,
  },
  {
    file: "packages/view/src/catalog/components.ts",
    text: "nestedWidgetItemsOf(question.props.items)",
    reason: HANDED,
  },
  {
    file: "packages/view/src/catalog/layouts/layout.ts",
    text: "props.items",
    reason: "a layout's own item list, which it draws one level through the port's renderer",
  },
  {
    file: "packages/view/src/shell/board-content.ts",
    text: "nestedWidgetItemsOf(props.items)",
    reason: HANDED,
    count: 2,
  },
  {
    file: "packages/view/src/shell/board-content.ts",
    text: "valueItemsOf(question.props.items)",
    reason: HANDED,
    count: 2,
  },
  {
    file: "packages/view/src/shell/board-draft.ts",
    text: "valueItemsOf(question.props.items)",
    reason: HANDED,
  },
  {
    file: "packages/view/src/shell/board-draft.ts",
    text: "nestedItemById(question.props.items",
    reason: HANDED,
    count: 2,
  },
  {
    file: "packages/view/src/shell/board-draft.ts",
    text: "nestedItemById(shown.props.items",
    reason: HANDED,
  },
  {
    file: "packages/view/src/shell/board-view.ts",
    text: "area.props.items",
    reason: VIEW_AREA,
    count: 3,
  },
  {
    file: "packages/view/src/shell/entries.ts",
    text: "nestedItemById(question.props.items",
    reason: HANDED,
  },
  {
    file: "packages/view/src/shell/entries.ts",
    text: "valueItemsOf(question.props.items)",
    reason: HANDED,
  },
  {
    file: "packages/view/src/shell/question-state.ts",
    text: "valueItemsOf(question.props.items)",
    reason: HANDED,
  },
  {
    file: "packages/view/src/shell/reason.ts",
    text: "valueItemsOf(question.props.items)",
    reason: HANDED,
  },
  {
    file: "packages/view/src/shell/revision-confirm.ts",
    text: "valueItemsOf(question.props.items)",
    reason: HANDED,
  },
  {
    file: "packages/view/src/view-document.ts",
    text: "item.props.items",
    reason: VIEW_AREA,
    count: 2,
  },
];

const RANKING_ELEMENTS = "a Ranking's items are its elements, never a question's items";

/** The direct reads in `widgets`' sources: a Ranking's elements. */
const WIDGETS_READS: readonly Read[] = [
  {
    file: "packages/widgets/src/ranking/model.ts",
    text: "props.items.map",
    reason: RANKING_ELEMENTS,
  },
  {
    file: "packages/widgets/src/ranking/props.ts",
    text: "{ items } = props",
    reason: RANKING_ELEMENTS,
  },
  {
    file: "packages/widgets/src/ranking/widget.tsx",
    text: "props.items.map",
    reason: RANKING_ELEMENTS,
  },
];

const TABLES: Readonly<Record<string, readonly Read[]>> = {
  contract: CONTRACT_READS,
  core: CORE_READS,
  compute: COMPUTE_READS,
  server: SERVER_READS,
  view: VIEW_READS,
  widgets: WIDGETS_READS,
};

/** The lines of a source that read a question's `items` directly: `props.items`, `{ items } = props`, or the key `"items"` of a path. */
export const directReadsOf = (source: string): string[] => {
  const reads: string[] = [];
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    const quoted = trimmed.replace(/\/\/ .*$/, "");
    const code = quoted
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");
    const property = /\bprops\??\.items\b/.test(code) || /\bprops\b[^;]*\)\??\.items\b/.test(code);
    const destructured = /\{[^}]*\bitems\b[^}]*\}\s*=\s*[^;]*\b(props\b|propsOf)/.test(code);
    const key =
      /"props",\s*"items"/.test(quoted) ||
      /[=!]==\s*["']items["']/.test(quoted) ||
      /["']items["']\s+in\b/.test(quoted);
    if (property || destructured || key) reads.push(trimmed);
  }
  return reads;
};

type Source = { readonly file: string; readonly text: string };

/**
 * The reads no entry of `table` covers, and the entries no read matches. An entry covers `count`
 * lines (one unless it says more) of its file that contain its text: a further matching line is a
 * new read, listed or not, and an entry with fewer lines than it says is stale.
 */
export const guardProblems = (sources: readonly Source[], table: readonly Read[]): string[] => {
  const problems: string[] = [];
  const used = new Map<Read, number>();
  for (const { file, text } of sources) {
    for (const read of directReadsOf(text)) {
      const open = table.find(
        (each) =>
          each.file === file &&
          read.includes(each.text) &&
          (used.get(each) ?? 0) < (each.count ?? 1),
      );
      if (open === undefined) problems.push(`${file}: unlisted direct read of items: ${read}`);
      else used.set(open, (used.get(open) ?? 0) + 1);
    }
  }
  for (const entry of table) {
    if ((used.get(entry) ?? 0) < (entry.count ?? 1)) {
      problems.push(`${entry.file}: stale entry: ${entry.text}`);
    }
  }
  return problems;
};

const root = join(import.meta.dir, "..");

const sourcesOf = async (name: string): Promise<Source[]> => {
  const base = join(root, "packages", name, "src");
  const paths = [...new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: base })]
    .filter((path) => !/\.test\.tsx?$/.test(path) && path !== "nested-items.ts")
    .sort();
  return Promise.all(
    paths.map(async (path) => ({
      file: relative(root, join(base, path)),
      text: await Bun.file(join(base, path)).text(),
    })),
  );
};

describe("the source guard of nested items", () => {
  test("finds a planted direct read and passes without it", () => {
    const planted = "export const first = (question: Q) => question.props.items[0];\n";
    const clean = "export const first = (question: Q) => walk(question);\n";
    const file = "packages/contract/src/planted.ts";
    expect(guardProblems([{ file, text: planted }], [])).toEqual([
      `${file}: unlisted direct read of items: export const first = (question: Q) => question.props.items[0];`,
    ]);
    expect(guardProblems([{ file, text: clean }], [])).toEqual([]);
  });

  test("fails on a planted direct read in a contract source", async () => {
    const sources = await sourcesOf("contract");
    const file = "packages/contract/src/planted.ts";
    const planted = [...sources, { file, text: "export const a = (q: Q) => q.props.items;\n" }];
    expect(guardProblems(planted, CONTRACT_READS)).toEqual([
      `${file}: unlisted direct read of items: export const a = (q: Q) => q.props.items;`,
    ]);
  });

  test("fails on a second matching read added to a file already listed (review S-2)", async () => {
    const sources = await sourcesOf("contract");
    const file = "packages/contract/src/ask-items.ts";
    const extra = "export const again = (q: Q) => q.props.items.length;\n";
    const planted = sources.map((source) =>
      source.file === file ? { ...source, text: `${source.text}\n${extra}` } : source,
    );
    expect(guardProblems(planted, CONTRACT_READS)).toEqual([
      `${file}: unlisted direct read of items: export const again = (q: Q) => q.props.items.length;`,
    ]);
    // The same text planted in another listed file, and in a core file, fails the same way.
    for (const name of ["draft-record.ts", "context/document.ts"]) {
      const at = `packages/contract/src/${name}`;
      const again = sources.map((source) =>
        source.file === at ? { ...source, text: `${source.text}\n${extra}` } : source,
      );
      expect(guardProblems(again, CONTRACT_READS)).toHaveLength(1);
    }
  });

  for (const name of ["core", "compute", "server", "view", "widgets"]) {
    test(`fails on a planted direct read in a ${name} source`, async () => {
      const sources = await sourcesOf(name);
      const file = `packages/${name}/src/planted.ts`;
      const text = "export const first = (q: Q) => q.props.items[0];\n";
      expect(guardProblems([...sources, { file, text }], TABLES[name] ?? [])).toEqual([
        `${file}: unlisted direct read of items: export const first = (q: Q) => q.props.items[0];`,
      ]);
    });
  }

  test("reads a property, a destructuring and the key, and not comments, strings or wording", () => {
    const reads = directReadsOf(
      [
        "const a = question.props.items;",
        "const { items } = props as Props;",
        "const { items } = question.props as Props;",
        'if (segments[0] === "items") return;',
        "// props.items in a comment",
        " * props.items in a doc comment",
        'const wording = "question.props.items[]";',
        "const keyed = { ...props, items };",
        "const text = `see props.items`;",
      ].join("\n"),
    );
    expect(reads).toEqual([
      "const a = question.props.items;",
      "const { items } = props as Props;",
      "const { items } = question.props as Props;",
      'if (segments[0] === "items") return;',
    ]);
  });

  test("fails on an entry that no read matches", () => {
    const file = "packages/contract/src/x.ts";
    const stale = { file, text: "gone.props.items", reason: "none" };
    expect(guardProblems([{ file, text: "const a = 1;\n" }], [stale])).toEqual([
      `${file}: stale entry: gone.props.items`,
    ]);
  });

  for (const [name, table] of Object.entries(TABLES)) {
    test(`${name}'s sources hold no unlisted direct read of items`, async () => {
      expect(guardProblems(await sourcesOf(name), table)).toEqual([]);
    });
  }

  test("every entry gives its reason", () => {
    for (const table of Object.values(TABLES)) {
      for (const entry of table) expect(entry.reason.length).toBeGreaterThan(10);
    }
  });
});
