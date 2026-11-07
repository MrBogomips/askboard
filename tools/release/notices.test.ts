import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  BUNDLE_PATH,
  type BuiltBundle,
  buildServerBundle,
  bundleNotices,
  main,
  noticesMarkdown,
  renderNotices,
} from "./notices.ts";

// The notices of the session process bundle (plugin-release, design decision 5; packaging spec,
// "Notices for the bundle"). The fixtures are miniature checkouts; the real-repository tests build
// the bundle in memory once.

const ROOT = join(import.meta.dir, "..", "..");
const folders: string[] = [];

afterAll(() => {
  for (const path of folders) rmSync(path, { recursive: true, force: true });
});

const write = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const json = (value: unknown): string => JSON.stringify(value);
const store = (name: string, version: string): string =>
  `node_modules/.bun/${name.replace("/", "+")}@${version}/node_modules/${name}`;

type Fixture = { readonly root: string; readonly inputs: string[] };

/** A checkout with a bundle, two licensed packages, one without a licence file, one workspace package. */
const fixture = (options: { readonly bare?: boolean } = {}): Fixture => {
  const root = mkdtempSync(join(tmpdir(), "askboard-notices-"));
  folders.push(root);
  write(root, "LICENSE", "MIT License\n\nCopyright (c) AskBoard\n");
  write(root, BUNDLE_PATH, "// the bundle\n");
  write(
    root,
    "packages/server/package.json",
    json({ name: "@askboard/server", version: "0.1.0", license: "MIT" }),
  );
  write(root, "packages/server/src/main.ts", "");
  const react = store("react", "19.3.1");
  write(root, `${react}/package.json`, json({ name: "react", version: "19.3.1", license: "MIT" }));
  write(root, `${react}/LICENSE`, "MIT License\n\nCopyright (c) Meta\n");
  write(root, `${react}/index.js`, "");
  const core = store("@scope/core", "2.4.0");
  write(
    root,
    `${core}/package.json`,
    json({ name: "@scope/core", version: "2.4.0", license: { type: "Apache-2.0" } }),
  );
  write(root, `${core}/LICENSE.md`, "Apache ``` License 2.0\n");
  write(root, `${core}/NOTICE`, "Notice text\n");
  write(root, `${core}/dist/index.js`, "");
  const inputs = [
    join(root, "packages/server/src/main.ts"),
    join(root, react, "index.js"),
    join(root, core, "dist/index.js"),
  ];
  if (options.bare === true) {
    const bare = store("bare", "1.0.0");
    write(root, `${bare}/package.json`, json({ name: "bare", version: "1.0.0", license: "MIT" }));
    write(root, `${bare}/index.js`, "");
    inputs.push(join(root, bare, "index.js"));
  }
  return { root, inputs };
};

const built =
  (inputs: readonly string[], code = "// the bundle\n") =>
  async (): Promise<BuiltBundle> => ({ code, inputs });

describe("bundleNotices on a miniature checkout", () => {
  test("one notice per third-party package with name, version, licence and text, none for AskBoard's own", async () => {
    const { root, inputs } = fixture();
    const notices = await bundleNotices(root, { build: built(inputs) });
    expect(
      notices.map(({ notice }) => `${notice.package} ${notice.version} ${notice.licence}`),
    ).toEqual(["@scope/core 2.4.0 Apache-2.0", "react 19.3.1 MIT"]);
    expect(notices[1]?.text).toContain("Copyright (c) Meta");
    expect(notices[0]?.text).toContain("Notice text");
    expect(notices.some(({ notice }) => notice.package.startsWith("@askboard/"))).toBe(false);
  });

  test("a package without a licence text fails naming it", async () => {
    const { root, inputs } = fixture({ bare: true });
    await expect(bundleNotices(root, { build: built(inputs) })).rejects.toThrow(
      /bare 1\.0\.0.*no licence file/,
    );
  });

  test("a bundle that differs from the build fails naming the file and the build", async () => {
    const { root, inputs } = fixture();
    const failure = bundleNotices(root, { build: built(inputs, "// another bundle\n") });
    await expect(failure).rejects.toThrow(BUNDLE_PATH);
    await expect(failure).rejects.toThrow("bun run build:server");
  });

  test("a missing bundle fails naming the file", async () => {
    const { root, inputs } = fixture();
    rmSync(join(root, BUNDLE_PATH));
    await expect(bundleNotices(root, { build: built(inputs) })).rejects.toThrow(
      `${BUNDLE_PATH} is missing`,
    );
  });

  test("the bundle file can be named by the caller", async () => {
    const { root, inputs } = fixture();
    write(root, "elsewhere.mjs", "// built elsewhere\n");
    const notices = await bundleNotices(root, {
      build: built(inputs, "// built elsewhere\n"),
      bundleFile: join(root, "elsewhere.mjs"),
    });
    expect(notices).toHaveLength(2);
  });
});

describe("renderNotices and noticesMarkdown", () => {
  test("a section per package with name, version, licence and text, in package order", async () => {
    const { root, inputs } = fixture();
    const markdown = await noticesMarkdown(root, { build: built(inputs) });
    expect(markdown.startsWith("# Third-party notices\n")).toBe(true);
    expect(markdown.match(/^## /gm)).toHaveLength(2);
    expect(markdown.indexOf("## @scope/core 2.4.0 (Apache-2.0)")).toBeGreaterThan(0);
    expect(markdown.indexOf("## @scope/core")).toBeLessThan(
      markdown.indexOf("## react 19.3.1 (MIT)"),
    );
    expect(markdown).toContain("Copyright (c) Meta");
    expect(markdown).not.toContain("@askboard/");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  test("a text holding a code fence is fenced by a longer one", () => {
    const markdown = renderNotices([
      {
        notice: { package: "x", version: "1.0.0", licence: "MIT", path: "licences/x-1.0.0.txt" },
        text: "before\n```\nafter",
      },
    ]);
    expect(markdown).toContain("````\nbefore\n```\nafter\n````");
  });

  test("no packages is said, not an empty file", () => {
    expect(renderNotices([])).toContain("no third-party package");
  });
});

describe("main", () => {
  const run = async (root: string, args: string[], build: ReturnType<typeof built>) => {
    const lines: string[] = [];
    const code = await main(root, args, (line) => lines.push(line), { build });
    return { code, lines };
  };

  test("--out writes the notices file", async () => {
    const { root, inputs } = fixture();
    const out = join(root, "out", "THIRD-PARTY-NOTICES.md");
    const { code, lines } = await run(root, ["--out", out], built(inputs));
    expect(code).toBe(0);
    expect(readFileSync(out, "utf8")).toContain("## react 19.3.1 (MIT)");
    expect(lines.join("\n")).toContain("2 packages");
  });

  test("a failure is reported and exits 1, writing nothing", async () => {
    const { root, inputs } = fixture({ bare: true });
    const out = join(root, "n.md");
    const { code, lines } = await run(root, ["--out", out], built(inputs));
    expect(code).toBe(1);
    expect(lines.join("\n")).toContain("bare 1.0.0");
    expect(existsSync(out)).toBe(false);
  });

  test("a missing --out is a usage error", async () => {
    const { root, inputs } = fixture();
    expect((await run(root, [], built(inputs))).code).toBe(2);
    expect((await run(root, ["--out"], built(inputs))).code).toBe(2);
    expect((await run(root, ["--out", "a", "b"], built(inputs))).code).toBe(2);
  });
});

describe("buildServerBundle", () => {
  test("refuses a root that is not the working directory, naming both", async () => {
    const { root } = fixture();
    await expect(buildServerBundle(root)).rejects.toThrow(process.cwd());
    await expect(buildServerBundle(root)).rejects.toThrow(root);
  });
});

describe("the real bundle", () => {
  const onDisk = existsSync(join(ROOT, BUNDLE_PATH));
  const here = process.cwd() === ROOT;
  if (!onDisk) {
    process.stderr.write(
      `notices.test.ts: bundle comparison skipped, ${BUNDLE_PATH} is missing: run bun run build:server\n`,
    );
  }
  let real: BuiltBundle | undefined;
  beforeAll(async () => {
    if (here) real = await buildServerBundle(ROOT);
  });

  test.skipIf(!onDisk || !here)("the in-memory build equals dist/askboard.mjs", () => {
    expect(real?.code === readFileSync(join(ROOT, BUNDLE_PATH), "utf8")).toBe(true);
  });

  test.skipIf(!here)(
    "every third-party package among the inputs has one notice, and no AskBoard package has",
    async () => {
      const code = real?.code ?? "";
      const dir = mkdtempSync(join(tmpdir(), "askboard-notices-real-"));
      folders.push(dir);
      const bundleFile = join(dir, "askboard.mjs");
      writeFileSync(bundleFile, code);
      const notices = await bundleNotices(ROOT, {
        build: async () => real as BuiltBundle,
        bundleFile,
      });
      const names = notices.map(({ notice }) => `${notice.package}@${notice.version}`);
      const expected = new Set(
        (real?.inputs ?? [])
          .map((file) =>
            file.match(/node_modules\/\.bun\/[^/]+\/node_modules\/((?:@[^/]+\/)?[^/]+)\//),
          )
          .filter((match): match is RegExpMatchArray => match !== null)
          .map((match) => match[1] as string),
      );
      expect(expected.size).toBeGreaterThan(5);
      expect(new Set(notices.map(({ notice }) => notice.package))).toEqual(expected);
      expect(names).toHaveLength(new Set(names).size);
      for (const { notice, text } of notices) {
        expect(notice.package.startsWith("@askboard/")).toBe(false);
        expect(notice.version).not.toBe("");
        expect(notice.licence).not.toBe("");
        expect(text.length).toBeGreaterThan(20);
      }
    },
  );
});
