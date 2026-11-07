import { describe, expect, test } from "bun:test";
import { join, relative } from "node:path";

// The source guard of nested items (layouts, design decision 2): every direct read of a
// question's `items` in a package's sources, outside the walker, is listed here with the reason it
// reads one level. A read that is not listed fails, so a unit that should walk the layouts cannot
// be added unseen, and an entry that no read matches fails too, so the table does not go stale.

type Read = { readonly file: string; readonly text: string; readonly reason: string };

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
    reason: THROUGH,
  },
  { file: "packages/contract/src/ask-items.ts", text: '"props", "items"', reason: THROUGH },
  { file: "packages/contract/src/ask-items.ts", text: 'rest[1] === "items"', reason: PATH },
  {
    file: "packages/contract/src/ask-items.ts",
    text: '"items" in props',
    reason: "a question with options and items together is refused for its options",
  },
  { file: "packages/contract/src/context/document.ts", text: "props.items", reason: CONTEXT },
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
  },
  { file: "packages/contract/src/fixtures/lifecycle.ts", text: "props.items", reason: FIXTURE },
  {
    file: "packages/contract/src/fixtures/molecules.ts",
    text: "PLAN_QUESTION.props.items",
    reason: FIXTURE,
  },
  {
    file: "packages/contract/src/fixtures/snapshot.ts",
    text: "delivery.props.items",
    reason: FIXTURE,
  },
  { file: "packages/contract/src/requests.ts", text: 'segments[0] === "items"', reason: PATH },
  { file: "packages/contract/src/requests.ts", text: 'segments[0] !== "items"', reason: PATH },
  { file: "packages/contract/src/widgets/gantt/checks.ts", text: "props.items", reason: THROUGH },
  {
    file: "packages/contract/src/widgets/row/checks.ts",
    text: "props.items",
    reason: "a Row's own items, the IDs its widths may name; the items inside them are another's",
  },
  { file: "packages/contract/src/widgets/ranking/checks.ts", text: "props.items", reason: RANKING },
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

const TABLES: Readonly<Record<string, readonly Read[]>> = { contract: CONTRACT_READS };

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
    const destructured = /\{[^}]*\bitems\b[^}]*\}\s*=\s*(\(?props\b|.*propsOf)/.test(code);
    const key =
      /"props",\s*"items"/.test(quoted) ||
      /[=!]==\s*["']items["']/.test(quoted) ||
      /["']items["']\s+in\b/.test(quoted);
    if (property || destructured || key) reads.push(trimmed);
  }
  return reads;
};

type Source = { readonly file: string; readonly text: string };

/** The reads no entry of `table` covers, and the entries no read matches. */
export const guardProblems = (sources: readonly Source[], table: readonly Read[]): string[] => {
  const problems: string[] = [];
  const used = new Set<Read>();
  for (const { file, text } of sources) {
    for (const read of directReadsOf(text)) {
      const entry = table.find((each) => each.file === file && read.includes(each.text));
      if (entry === undefined) problems.push(`${file}: unlisted direct read of items: ${read}`);
      else used.add(entry);
    }
  }
  for (const entry of table) {
    if (!used.has(entry)) problems.push(`${entry.file}: stale entry: ${entry.text}`);
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

  test("reads a property, a destructuring and the key, and not comments, strings or wording", () => {
    const reads = directReadsOf(
      [
        "const a = question.props.items;",
        "const { items } = props as Props;",
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
