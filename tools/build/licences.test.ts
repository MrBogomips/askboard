import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KATEX_VERSION } from "./katex-version.ts";
import {
  chunkInputs,
  collectNotices,
  exceptedPackageProblems,
  FONT_LICENCES,
  type FontLicence,
  type FontLicences,
  fontEntryProblems,
  LICENCE_EXCEPTIONS,
  LICENCE_TEXTS,
  licencePath,
  missingFontLicences,
  staleFontLicences,
  staleLicenceTexts,
} from "./licences.ts";
import { ROOT } from "./paths.ts";

let root = "";
const write = (path: string, text: string) => Bun.write(join(root, path), text);
const json = (value: unknown) => JSON.stringify(value);
const store = (name: string, version: string) =>
  `node_modules/.bun/${name.replace("/", "+")}@${version}/node_modules/${name}`;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "askboard-licences-"));
  await write("LICENSE", "MIT License\n\nCopyright (c) AskBoard\n");
  await write(
    "packages/view/package.json",
    json({ name: "@askboard/view", version: "0.0.0", license: "MIT" }),
  );
  await write("packages/view/src/shell/index.tsx", "");
  await write(
    "packages/contract/package.json",
    json({ name: "@askboard/contract", version: "0.0.0", license: "MIT" }),
  );
  await write("packages/contract/src/routes.ts", "");
  const react = store("react", "19.3.1");
  await write(`${react}/package.json`, json({ name: "react", version: "19.3.1", license: "MIT" }));
  await write(`${react}/LICENSE`, "MIT License\n\nCopyright (c) Meta\n");
  await write(`${react}/cjs/react.production.js`, "");
  await write(`${react}/index.js`, "");
  const core = store("@modelcontextprotocol/core", "2.4.0");
  await write(
    `${core}/package.json`,
    json({ name: "@modelcontextprotocol/core", version: "2.4.0", license: { type: "Apache-2.0" } }),
  );
  await write(`${core}/LICENSE.md`, "Apache License 2.0\n");
  await write(`${core}/NOTICE`, "Notice text\n");
  await write(`${core}/dist/index.js`, "");
  const bare = store("bare", "1.0.0");
  await write(`${bare}/package.json`, json({ name: "bare", version: "1.0.0", license: "MIT" }));
  await write(`${bare}/index.js`, "");
  const unlicensed = store("unlicensed", "1.0.0");
  await write(`${unlicensed}/package.json`, json({ name: "unlicensed", version: "1.0.0" }));
  await write(`${unlicensed}/LICENSE`, "text\n");
  await write(`${unlicensed}/index.js`, "");
  const fonty = store("fonty", "2.0.0");
  await write(`${fonty}/package.json`, json({ name: "fonty", version: "2.0.0", license: "MIT" }));
  await write(`${fonty}/LICENSE`, "MIT License\n\nCopyright (c) Fonty\n");
  await write(`${fonty}/dist/code.mjs`, "");
  await write(`${fonty}/dist/plain.js`, "");
  const dual = store("dual", "1.0.0");
  await write(
    `${dual}/package.json`,
    json({ name: "dual", version: "1.0.0", license: "MIT OR Apache-2.0" }),
  );
  await write(`${dual}/LICENSE`, "Dual licence text\n");
  await write(`${dual}/index.js`, "");
  await writeEmbedding();
});

// Packages with a `licenses/` folder (chart-widget, task 7.4): the folder holds the texts of code
// the package embeds, not the package's own licence.
const embedding = (name: string) => ({ name, version: "1.0.0", license: "MIT" });
const writeEmbedding = async () => {
  const only = store("only-embedded", "1.0.0");
  await write(`${only}/package.json`, json(embedding("only-embedded")));
  await write(`${only}/licenses/LICENSE-third`, "Third Party BSD text\n");
  await write(`${only}/index.js`, "");
  const both = store("both", "1.0.0");
  await write(`${both}/package.json`, json(embedding("both")));
  await write(`${both}/LICENSE`, "Both own MIT text\n");
  await write(`${both}/licenses/LICENSE-third`, "Both third text\n");
  await write(`${both}/licenses/readme.txt`, "not a licence file\n");
  await write(`${both}/index.js`, "");
  const flat = store("flat", "1.0.0");
  await write(`${flat}/package.json`, json(embedding("flat")));
  await write(`${flat}/LICENSE`, "Flat own text\n");
  await write(`${flat}/licenses`, "a file where the folder should be\n");
  await write(`${flat}/index.js`, "");
  const linked = store("linked", "1.0.0");
  await write(`${linked}/package.json`, json(embedding("linked")));
  await write(`${linked}/LICENSE`, "Linked own text\n");
  await write(`${linked}/elsewhere/LICENSE-x`, "Outside text\n");
  await symlink("elsewhere", join(root, linked, "licenses"));
  await write(`${linked}/index.js`, "");
  const entry = store("entry-link", "1.0.0");
  await write(`${entry}/package.json`, json(embedding("entry-link")));
  await write(`${entry}/LICENSE`, "Entry own text\n");
  await write(`${entry}/licenses/LICENSE-real`, "Real text\n");
  await symlink("../LICENSE", join(root, entry, "licenses", "LICENSE-link"));
  await write(`${entry}/index.js`, "");
  const sealed = store("sealed", "1.0.0");
  await write(`${sealed}/package.json`, json(embedding("sealed")));
  await write(`${sealed}/LICENSE`, "Sealed own text\n");
  await write(`${sealed}/licenses/LICENSE-x`, "Sealed third text\n");
  await write(`${sealed}/index.js`, "");
  await chmod(join(root, sealed, "licenses"), 0o000);
};

afterAll(async () => {
  // A folder the tests made unreadable cannot be removed until it is readable again.
  await chmod(join(root, store("sealed", "1.0.0"), "licenses"), 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

const at = (path: string) => join(root, path);

describe("the inputs a chunk holds, from the bundler's metafile", () => {
  test("are the files the output lists, as absolute paths, without plugin modules", () => {
    const metafile = {
      inputs: {},
      outputs: {
        "./shell.js": {
          inputs: {
            "packages/view/src/shell/index.tsx": { bytesInOutput: 120 },
            "node_modules/.bun/react@19.3.1/node_modules/react/index.js": { bytesInOutput: 0 },
            "askboard-shared:react": { bytesInOutput: 40 },
          },
        },
      },
    };
    expect(chunkInputs(metafile, root)).toEqual([
      at("node_modules/.bun/react@19.3.1/node_modules/react/index.js"),
      at("packages/view/src/shell/index.tsx"),
    ]);
  });
});

describe("licence notices per chunk", () => {
  test("name each package once, with its version, SPDX licence and licence text", async () => {
    const notices = await collectNotices(
      "ext-apps",
      [
        at(`${store("@modelcontextprotocol/core", "2.4.0")}/dist/index.js`),
        at(`${store("react", "19.3.1")}/index.js`),
        at(`${store("react", "19.3.1")}/cjs/react.production.js`),
      ],
      root,
    );
    expect(notices.map(({ notice }) => notice)).toEqual([
      {
        package: "@modelcontextprotocol/core",
        version: "2.4.0",
        licence: "Apache-2.0",
        path: "licences/modelcontextprotocol-core-2.4.0.txt",
      },
      { package: "react", version: "19.3.1", licence: "MIT", path: "licences/react-19.3.1.txt" },
    ]);
    expect(notices[0]?.text).toContain("Apache License 2.0");
    expect(notices[0]?.text).toContain("Notice text");
    expect(notices[1]?.text).toContain("Copyright (c) Meta");
  });

  test("AskBoard's own code carries AskBoard's MIT notice from the repository's licence", async () => {
    const notices = await collectNotices(
      "shell",
      [at("packages/view/src/shell/index.tsx"), at("packages/contract/src/routes.ts")],
      root,
    );
    expect(notices.map(({ notice }) => notice.package)).toEqual([
      "@askboard/contract",
      "@askboard/view",
    ]);
    expect(notices[1]?.notice.path).toBe("licences/askboard-view-0.0.0.txt");
    expect(notices[1]?.text).toContain("Copyright (c) AskBoard");
  });

  test("files outside any package, such as generated entries, carry no notice", async () => {
    expect(await collectNotices("react", [at("generated/react.ts")], root)).toEqual([]);
  });

  test("a package without a licence file fails, naming the package and the chunk", async () => {
    const input = at(`${store("bare", "1.0.0")}/index.js`);
    await expect(collectNotices("radix", [input], root)).rejects.toThrow(
      'bare 1.0.0 in the chunk "radix" has no licence file',
    );
  });

  const recorded = {
    "bare@1.0.0": {
      licence: "MIT",
      source:
        "https://github.com/example/bare/blob/0123456789abcdef0123456789abcdef01234567/LICENSE",
      date: "2025-05-21",
      reason: "the package ships no licence file",
      text: "MIT License\n\nCopyright (c) Bare\n",
    },
  };

  test("a package without a licence file takes the text recorded for its exact version, under the licence its package.json names (ask-lifecycle, task 6.6)", async () => {
    const input = at(`${store("bare", "1.0.0")}/index.js`);
    const [notice] = await collectNotices("radix", [input], root, recorded);
    expect(notice?.notice).toEqual({
      package: "bare",
      version: "1.0.0",
      licence: "MIT",
      path: "licences/bare-1.0.0.txt",
    });
    expect(notice?.text).toBe("MIT License\n\nCopyright (c) Bare");
    expect(notice?.recorded).toBe("bare@1.0.0");
  });

  test("a recorded text under another licence, or for another version, does not stand in", async () => {
    const input = at(`${store("bare", "1.0.0")}/index.js`);
    const other = { "bare@1.0.0": { ...recorded["bare@1.0.0"], licence: "ISC" } };
    await expect(collectNotices("radix", [input], root, other)).rejects.toThrow(
      'bare 1.0.0 in the chunk "radix" has no licence file',
    );
    const older = { "bare@0.9.0": recorded["bare@1.0.0"] };
    await expect(collectNotices("radix", [input], root, older)).rejects.toThrow("no licence file");
  });

  test("a package that ships its own licence file keeps it, and a text recorded for it is stale", async () => {
    const input = at(`${store("react", "19.3.1")}/index.js`);
    const stale = { "react@19.3.1": { ...recorded["bare@1.0.0"] } };
    await expect(collectNotices("react", [input], root, stale)).rejects.toThrow(
      'react 19.3.1 in the chunk "react" ships its own licence file: the text recorded for "react@19.3.1" in tools/licence-texts.json is stale',
    );
  });

  describe("a package's licenses/ folder holds the texts of code it embeds (chart-widget, task 7.4)", () => {
    const input = (name: string) => at(`${store(name, "1.0.0")}/index.js`);
    const recordedOnly = {
      "only-embedded@1.0.0": { ...recorded["bare@1.0.0"], text: "Recorded own MIT text\n" },
    };

    test("a package with only that folder has no licence file of its own and is refused", async () => {
      await expect(collectNotices("chart", [input("only-embedded")], root)).rejects.toThrow(
        'only-embedded 1.0.0 in the chunk "chart" has no licence file',
      );
    });

    test("the same package with a recorded text ships it, then the folder's, and the text is not stale", async () => {
      const [notice] = await collectNotices("chart", [input("only-embedded")], root, recordedOnly);
      expect(notice?.recorded).toBe("only-embedded@1.0.0");
      expect(notice?.text).toBe("Recorded own MIT text\n\nThird Party BSD text");
    });

    test("a package with its own licence file ships it first, then the folder's licence files only", async () => {
      const [notice] = await collectNotices("chart", [input("both")], root);
      expect(notice?.text).toBe("Both own MIT text\n\nBoth third text");
      expect(notice?.recorded).toBeUndefined();
    });

    test("a text recorded for a package that ships its own file is stale, with or without the folder", async () => {
      const stale = { "both@1.0.0": { ...recorded["bare@1.0.0"] } };
      await expect(collectNotices("chart", [input("both")], root, stale)).rejects.toThrow(
        'both 1.0.0 in the chunk "chart" ships its own licence file',
      );
    });

    test("a licenses entry that is a file is reported, not skipped", async () => {
      await expect(collectNotices("chart", [input("flat")], root)).rejects.toThrow(
        /flat.*licenses.*not a folder/,
      );
    });

    test("a licenses folder that is a link is reported, not followed", async () => {
      await expect(collectNotices("chart", [input("linked")], root)).rejects.toThrow(
        /linked.*licenses.*not a folder/,
      );
    });

    test("a link among the folder's licence files is reported, not read", async () => {
      await expect(collectNotices("chart", [input("entry-link")], root)).rejects.toThrow(
        /entry-link.*LICENSE-link.*not a file/,
      );
    });

    test("a folder that cannot be read is reported: only a missing folder means none", async () => {
      await expect(collectNotices("chart", [input("sealed")], root)).rejects.toThrow(
        /sealed.*licenses.*EACCES/,
      );
      const [plain] = await collectNotices(
        "react",
        [at(`${store("react", "19.3.1")}/index.js`)],
        root,
      );
      expect(plain?.text).toBe("MIT License\n\nCopyright (c) Meta");
    });
  });

  test("a recorded text no chunk used is stale, and fails the build", () => {
    expect(staleLicenceTexts(recorded, new Set(["bare@1.0.0"]))).toEqual([]);
    expect(staleLicenceTexts(recorded, new Set())).toEqual([
      'the text recorded for "bare@1.0.0" in tools/licence-texts.json is stale: no chunk holds that package without a licence file',
    ]);
  });

  test("each recorded text names its licence, its source at a commit, its date and why, and is in the repository whole", () => {
    expect(Object.keys(LICENCE_TEXTS)).toEqual(["react-remove-scroll-bar@2.3.8"]);
    for (const entry of Object.values(LICENCE_TEXTS)) {
      expect(entry.licence).toBe("MIT");
      expect(entry.source).toMatch(/^https:\/\/github\.com\/.+\/blob\/[0-9a-f]{40}\/LICENSE$/);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.reason).not.toBe("");
      expect(entry.text).toContain("Permission is hereby granted");
      expect(entry.text).toContain("Copyright (c)");
    }
  });

  test("a package without a licence field fails, naming it", async () => {
    const input = at(`${store("unlicensed", "1.0.0")}/index.js`);
    await expect(collectNotices("radix", [input], root)).rejects.toThrow("unlicensed 1.0.0");
  });

  test("a notice's file name is the package name and version, without the scope's @", () => {
    expect(licencePath("@radix-ui/react-radio-group", "1.5.1")).toBe(
      "licences/radix-ui-react-radio-group-1.5.1.txt",
    );
  });
});

const fontEntry = (over: Partial<FontLicence> = {}): FontLicence => ({
  licence: "OFL-1.1",
  fonts: "dist/fonts",
  derived: ["dist/code.mjs"],
  source: "https://github.com/example/fonty/blob/0123456789abcdef0123456789abcdef01234567/OFL.txt",
  date: "2026-11-07",
  reason: "the fonts' name tables say OFL-1.1",
  text: "Fonty 2.0.0: the fonts and glyph outlines.\n\nOFL text\n",
  ...over,
});

describe("the fonts' licence in a package's notice (latex-kanban-timeline, task 3.4; review X-1)", () => {
  const table: FontLicences = { "fonty@2.0.0": fontEntry() };
  const fonty = (file: string) => at(`${store("fonty", "2.0.0")}/${file}`);

  test("a package with an entry reads `<licence> AND OFL-1.1`, its text the package's then the entry's after a blank line", async () => {
    const [file] = await collectNotices("latex", [fonty("dist/plain.js")], root, {}, table);
    expect(file?.notice).toEqual({
      package: "fonty",
      version: "2.0.0",
      licence: "MIT AND OFL-1.1",
      path: "licences/fonty-2.0.0.txt",
    });
    expect(file?.text).toBe(
      "MIT License\n\nCopyright (c) Fonty\n\nFonty 2.0.0: the fonts and glyph outlines.\n\nOFL text",
    );
    expect(file?.font).toEqual({ key: "fonty@2.0.0", derived: false });
  });

  test("a compound package licence is parenthesised", async () => {
    const dual = { "dual@1.0.0": fontEntry() };
    const input = at(`${store("dual", "1.0.0")}/index.js`);
    const [file] = await collectNotices("latex", [input], root, {}, dual);
    expect(file?.notice.licence).toBe("(MIT OR Apache-2.0) AND OFL-1.1");
  });

  test("a package with no entry keeps today's notice, and an entry for another version does not stand in", async () => {
    const input = at(`${store("react", "19.3.1")}/index.js`);
    const [plain] = await collectNotices("react", [input], root, {}, table);
    expect(plain?.notice.licence).toBe("MIT");
    expect(plain?.font).toBeUndefined();
    const older = { "fonty@1.0.0": fontEntry() };
    const [file] = await collectNotices("latex", [fonty("dist/plain.js")], root, {}, older);
    expect(file?.notice.licence).toBe("MIT");
    expect(file?.text).toBe("MIT License\n\nCopyright (c) Fonty");
  });

  test("a derived file among the inputs is marked, and the notice is one file though the package is linked twice", async () => {
    const inputs = [fonty("dist/code.mjs"), fonty("dist/plain.js")];
    const files = await collectNotices("latex", inputs, root, {}, table);
    expect(files).toHaveLength(1);
    expect(files[0]?.font).toEqual({ key: "fonty@2.0.0", derived: true });
  });

  test("an entry with no font folder, only derived code, reads `<licence> AND <entry licence>` as well (atoms, task 5.1)", async () => {
    const { fonts: _fonts, ...helpers } = fontEntry({ licence: "MIT", derived: ["index.js"] });
    const input = at(`${store("dual", "1.0.0")}/index.js`);
    const [file] = await collectNotices("text", [input], root, {}, { "dual@1.0.0": helpers });
    expect(file?.notice.licence).toBe("(MIT OR Apache-2.0) AND MIT");
    expect(file?.font).toEqual({ key: "dual@1.0.0", derived: true });
    expect(file?.text).toContain("Fonty 2.0.0: the fonts and glyph outlines.");
  });

  test("DOMPurify's chunk reads `(MPL-2.0 OR Apache-2.0) AND MIT` and carries Babel's helper text, which its own licence files lack (atoms, task 5.1)", async () => {
    const entry = join(ROOT, "packages/view/virtual-purify-entry.ts");
    const built = await Bun.build({
      entrypoints: [entry],
      files: { [entry]: 'import purify from "dompurify"; console.log(purify);' },
      format: "iife",
      target: "browser",
      metafile: true,
    });
    if (built.metafile === undefined) throw new Error("the bundle has no metafile");
    const inputs = chunkInputs(built.metafile, process.cwd());
    const purify = FONT_LICENCES["dompurify@3.4.17"];
    expect(purify?.derived).toEqual(["dist/purify.es.mjs"]);
    expect(purify?.fonts).toBeUndefined();
    const files = await collectNotices("text", inputs, ROOT);
    const notice = files.find((file) => file.notice.package === "dompurify");
    expect(notice?.notice).toEqual({
      package: "dompurify",
      version: "3.4.17",
      licence: "(MPL-2.0 OR Apache-2.0) AND MIT",
      path: "licences/dompurify-3.4.17.txt",
    });
    expect(notice?.font).toEqual({ key: "dompurify@3.4.17", derived: true });
    expect(notice?.text).toContain("Apache License");
    expect(notice?.text).toContain("Facebook, Inc. (ONLY ./src/helpers/regenerator* files)");
    expect(notice?.text).toContain("Permission is hereby granted");
  }, 60_000);

  test("markdown-it's chunk reads `BSD-2-Clause AND MIT` for entities and carries he's licence text, which entities' own LICENSE lacks (atoms, task 5.1; review 4.4 U-1)", async () => {
    const entry = join(ROOT, "packages/view/virtual-markdown-entry.ts");
    const built = await Bun.build({
      entrypoints: [entry],
      files: { [entry]: 'import md from "markdown-it"; console.log(md);' },
      format: "iife",
      target: "browser",
      metafile: true,
    });
    if (built.metafile === undefined) throw new Error("the bundle has no metafile");
    const inputs = chunkInputs(built.metafile, process.cwd());
    const entities = FONT_LICENCES["entities@8.1.0"];
    expect(entities?.derived).toEqual(["dist/decode-codepoint.js"]);
    expect(entities?.fonts).toBeUndefined();
    expect(inputs.some((input) => input.endsWith("/entities/dist/decode-codepoint.js"))).toBe(true);
    const files = await collectNotices("text", inputs, ROOT);
    const notice = files.find((file) => file.notice.package === "entities");
    expect(notice?.notice.licence).toBe("BSD-2-Clause AND MIT");
    expect(notice?.font).toEqual({ key: "entities@8.1.0", derived: true });
    expect(notice?.text).toContain("Felix Böhm");
    expect(notice?.text).toContain("Copyright Mathias Bynens <https://mathiasbynens.be/>");
  }, 60_000);

  test("KaTeX's script alone, with no stylesheet, gives the `katex` notice `MIT AND OFL-1.1` (review X-1)", async () => {
    // What Bun bundles for `import "katex"` from the widgets, read from a real bundle's inputs.
    const entry = join(ROOT, "packages/widgets/virtual-katex-entry.ts");
    const built = await Bun.build({
      entrypoints: [entry],
      files: { [entry]: 'import katex from "katex"; console.log(katex);' },
      format: "iife",
      target: "browser",
      metafile: true,
    });
    if (built.metafile === undefined) throw new Error("the bundle has no metafile");
    const inputs = chunkInputs(built.metafile, process.cwd());
    const katex = FONT_LICENCES[`katex@${KATEX_VERSION}`];
    expect(katex?.derived).toEqual(["dist/katex.mjs"]);
    expect(inputs.some((input) => input.endsWith("/katex/dist/katex.mjs"))).toBe(true);
    const files = await collectNotices("latex", inputs, ROOT);
    const notice = files.find((file) => file.notice.package === "katex");
    expect(notice?.notice).toEqual({
      package: "katex",
      version: KATEX_VERSION,
      licence: "MIT AND OFL-1.1",
      path: `licences/katex-${KATEX_VERSION}.txt`,
    });
    expect(notice?.font).toEqual({ key: `katex@${KATEX_VERSION}`, derived: true });
    expect(notice?.text).toContain("Khan Academy");
    expect(notice?.text).toContain("SIL OPEN FONT LICENSE");
    expect(notice?.text).toContain("with Reserved Font Names KaTeX_AMS");
  }, 60_000);
});

describe("the font licence table's checks (design decision 8)", () => {
  const chunk = (name: string, fonts: string[], derived = false, keys: string[] = []) => ({
    name,
    fonts,
    notices: keys.map((key) => ({
      notice: { package: key, version: "1", licence: "MIT", path: `licences/${key}.txt` },
      text: "",
      font: { key, derived },
    })),
  });
  const table: FontLicences = { "fonty@2.0.0": fontEntry() };

  test("an entry whose licence is OFL-1.1 or permissive passes, any other fails, naming the entry", () => {
    expect(fontEntryProblems(table)).toEqual([]);
    expect(fontEntryProblems({ "a@1.0.0": fontEntry({ licence: "ISC" }) })).toEqual([]);
    expect(fontEntryProblems({ "a@1.0.0": fontEntry({ licence: "MIT AND ISC" }) })).toEqual([]);
    for (const licence of ["GPL-3.0-only", "OFL-1.0", "MPL-2.0", "", "OFL-1.1 OR GPL-3.0-only"]) {
      const problems = fontEntryProblems({ "a@1.0.0": fontEntry({ licence }) });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('"a@1.0.0"');
      expect(problems[0]).toContain("tools/font-licences.json");
    }
  });

  test("inlined fonts of a package version with no entry fail, naming the chunk and the package version", () => {
    expect(missingFontLicences(table, [chunk("latex", ["fonty@2.0.0"])])).toEqual([]);
    const problems = missingFontLicences(table, [chunk("latex", ["fonty@3.0.0", "other@1.0.0"])]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('"latex"');
    expect(problems[0]).toContain("fonty@3.0.0");
    expect(problems[1]).toContain("other@1.0.0");
  });

  test("an entry no chunk inlines fonts for and no chunk bundles a derived file of is stale", () => {
    expect(staleFontLicences(table, [chunk("latex", ["fonty@2.0.0"])])).toEqual([]);
    const stale = staleFontLicences(table, [chunk("shell", []), chunk("latex", ["other@1.0.0"])]);
    expect(stale).toHaveLength(1);
    expect(stale[0]).toContain('"fonty@2.0.0"');
    expect(stale[0]).toContain("stale");
    expect(stale[0]).toContain("tools/font-licences.json");
  });

  test("an entry used only through a derived input is not stale; a notice taken without one does not use it", () => {
    expect(staleFontLicences(table, [chunk("latex", [], true, ["fonty@2.0.0"])])).toEqual([]);
    expect(staleFontLicences(table, [chunk("latex", [], false, ["fonty@2.0.0"])])).toHaveLength(1);
  });

  test("the real table is clean: its entry's licence stands in the rule", () => {
    expect(fontEntryProblems(FONT_LICENCES)).toEqual([]);
    expect(Object.keys(FONT_LICENCES)).toEqual([
      `katex@${KATEX_VERSION}`,
      "dompurify@3.4.17",
      "entities@8.1.0",
    ]);
  });
});

describe("the named licence exceptions in a build (atoms, design decision 9)", () => {
  const notice = (name: string, licence = "MIT") => ({
    notice: { package: name, version: "1.0.0", licence, path: licencePath(name, "1.0.0") },
    text: "",
  });
  const table = [
    {
      name: "argparse",
      licence: "PSF-2.0",
      reason: "r",
      source: "s",
      shippedIn: [] as string[],
    },
  ];

  test("a chunk whose notices name argparse fails the build, naming the chunk", () => {
    const problems = exceptedPackageProblems(table, [
      { name: "markdown", notices: [notice("markdown-it"), notice("argparse", "PSF-2.0")] },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"markdown"');
    expect(problems[0]).toContain("argparse");
  });

  test("chunks without an excepted package pass", () => {
    expect(exceptedPackageProblems(table, [{ name: "shell", notices: [notice("react")] }])).toEqual(
      [],
    );
  });

  test("the real table names argparse alone", () => {
    expect(LICENCE_EXCEPTIONS.map((entry) => entry.name)).toEqual(["argparse"]);
  });
});
