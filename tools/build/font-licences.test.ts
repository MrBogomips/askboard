import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { KATEX_VERSION } from "./katex-version.ts";
import { FONT_LICENCES } from "./licences.ts";
import { resolveFromWidgets } from "./paths.ts";

// Each entry of `tools/font-licences.json` is checked against the fonts it speaks for: the `name`
// table of every .ttf in its font folder (the build drops them, the package ships them) says what
// licence they are under, who holds the copyright and which names are reserved (latex-kanban-
// timeline, design decision 8, group 3 review X-1).

const NAME_ID_LICENCE = 13;
const NAME_ID_LICENCE_URL = 14;

// The strings of a TrueType file's `name` table, by name ID: platform 3 and 0 are UTF-16BE, the
// others one byte per character.
const nameTable = (bytes: Uint8Array): Map<number, string[]> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let table = -1;
  for (let at = 0; at < view.getUint16(4); at += 1) {
    const record = 12 + at * 16;
    if (String.fromCharCode(...bytes.subarray(record, record + 4)) === "name") {
      table = view.getUint32(record + 8);
    }
  }
  if (table === -1) throw new Error("the font has no name table");
  const names = new Map<number, string[]>();
  const storage = table + view.getUint16(table + 4);
  for (let at = 0; at < view.getUint16(table + 2); at += 1) {
    const record = table + 6 + at * 12;
    const length = view.getUint16(record + 8);
    const start = storage + view.getUint16(record + 10);
    const raw = bytes.subarray(start, start + length);
    const wide = view.getUint16(record) !== 1;
    const text = new TextDecoder(wide ? "utf-16be" : "latin1").decode(raw);
    const id = view.getUint16(record + 6);
    names.set(id, [...(names.get(id) ?? []), text]);
  }
  return names;
};

const packageDirOf = (key: string): string => {
  const name = key.slice(0, key.lastIndexOf("@"));
  return dirname(resolveFromWidgets(`${name}/package.json`));
};

describe("tools/font-licences.json against the fonts it speaks for", () => {
  test("the table holds `katex` at the installed version, `dompurify@3.4.17` and `entities@8.1.0`, each with its source at a commit, its date and why", () => {
    expect(Object.keys(FONT_LICENCES)).toEqual([
      `katex@${KATEX_VERSION}`,
      "dompurify@3.4.17",
      "entities@8.1.0",
    ]);
    for (const entry of Object.values(FONT_LICENCES).filter(({ fonts }) => fonts !== undefined)) {
      expect(entry.licence).toBe("OFL-1.1");
      expect(entry.source).toMatch(
        /^https:\/\/github\.com\/spdx\/license-list-data\/blob\/[0-9a-f]{40}\/text\/OFL-1.1\.txt$/,
      );
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.reason).toContain("nameID 13");
    }
  });

  describe("dompurify@3.4.17, derived code with no fonts (atoms, task 5.1)", () => {
    const key = "dompurify@3.4.17";
    const entry = FONT_LICENCES[key];

    test("it is MIT, names no font folder, and sources babel-helpers' LICENSE at the blob task 4.1 recorded", () => {
      expect(entry?.licence).toBe("MIT");
      expect(entry?.fonts).toBeUndefined();
      expect(entry?.derived).toEqual(["dist/purify.es.mjs"]);
      expect(entry?.source).toBe(
        "https://github.com/babel/babel/blob/a0690e39ea63cdcc3d9282ece739e6677c83ad6e/packages/babel-helpers/LICENSE",
      );
      expect(entry?.reason).toContain("37b2c998c41e131cfdd18e93536c73cfaf919ed4");
    });

    test("the package on disk is that version, the derived file holds the Facebook comment, and the text names both", async () => {
      const dir = dirname(
        Bun.resolveSync("dompurify/package.json", join(import.meta.dir, "../../packages/view")),
      );
      const manifest = await Bun.file(join(dir, "package.json")).json();
      expect(`${manifest.name}@${manifest.version}`).toBe(key);
      const dist = await Bun.file(join(dir, "dist/purify.es.mjs")).text();
      expect(dist).toContain("Copyright (c) 2014-present, Facebook, Inc.");
      const first = (entry?.text ?? "").split("\n")[0] ?? "";
      expect(first).toContain("dompurify 3.4.17");
      expect(first).toContain("dist/purify.es.mjs");
    });

    test("the licence text is the pinned blob, word for word (git's blob hash of it)", () => {
      const body = (entry?.text ?? "").slice((entry?.text ?? "").indexOf("MIT License"));
      const blob = `blob ${Buffer.byteLength(body)}\0${body}`;
      expect(createHash("sha1").update(blob).digest("hex")).toBe(
        "37b2c998c41e131cfdd18e93536c73cfaf919ed4",
      );
    });
  });

  describe("entities@8.1.0, derived code with no fonts (atoms, task 5.1; review 4.4 U-1)", () => {
    const key = "entities@8.1.0";
    const entry = FONT_LICENCES[key];

    test("it is MIT, names no font folder, and sources he's LICENSE-MIT.txt at the commit entities' file cites", () => {
      expect(entry?.licence).toBe("MIT");
      expect(entry?.fonts).toBeUndefined();
      expect(entry?.derived).toEqual(["dist/decode-codepoint.js"]);
      expect(entry?.source).toBe(
        "https://github.com/mathiasbynens/he/blob/36afe179392226cf1b6ccdb16ebbb7a5a844d93a/LICENSE-MIT.txt",
      );
      expect(entry?.reason).toContain("a41e0a7ef970ecdd83d82cd99bda97b22077bc62");
    });

    test("the package on disk is that version, the derived file cites he, and the text names both", async () => {
      const dir = dirname(
        Bun.resolveSync(
          "entities/package.json",
          dirname(
            Bun.resolveSync(
              "markdown-it/package.json",
              join(import.meta.dir, "../../packages/view"),
            ),
          ),
        ),
      );
      const manifest = await Bun.file(join(dir, "package.json")).json();
      expect(`${manifest.name}@${manifest.version}`).toBe(key);
      const file = await Bun.file(join(dir, "dist/decode-codepoint.js")).text();
      expect(file).toContain(
        "Adapted from https://github.com/mathiasbynens/he/blob/36afe179392226cf1b6ccdb16ebbb7a5a844d93a/",
      );
      const first = (entry?.text ?? "").split("\n")[0] ?? "";
      expect(first).toContain("entities 8.1.0");
      expect(first).toContain("dist/decode-codepoint.js");
    });

    test("the licence text is the pinned blob, word for word (git's blob hash of it)", () => {
      const body = (entry?.text ?? "").slice(
        (entry?.text ?? "").indexOf("Copyright Mathias Bynens"),
      );
      const blob = `blob ${Buffer.byteLength(body)}\0${body}`;
      expect(createHash("sha1").update(blob).digest("hex")).toBe(
        "a41e0a7ef970ecdd83d82cd99bda97b22077bc62",
      );
    });
  });

  for (const [key, entry] of Object.entries(FONT_LICENCES).filter(
    ([, { fonts }]) => fonts !== undefined,
  )) {
    describe(key, () => {
      const folder = join(packageDirOf(key), entry.fonts ?? "");

      test("the package on disk is that version, and each derived file is in it", async () => {
        const manifest = await Bun.file(join(packageDirOf(key), "package.json")).json();
        expect(`${manifest.name}@${manifest.version}`).toBe(key);
        for (const file of entry.derived) {
          expect(await Bun.file(join(packageDirOf(key), file)).exists()).toBe(true);
        }
      });

      test("the text names the package version, the font folder and each derived file on its first line", () => {
        const first = entry.text.split("\n")[0] ?? "";
        expect(first).toContain(key.replace("@", " "));
        expect(first).toContain(`${entry.fonts}/`);
        for (const file of entry.derived) expect(first).toContain(file);
      });

      test("every font's name table says the licence, and every copyright line and Reserved Font Name it declares stands in the text", async () => {
        const fonts = (await readdir(folder)).filter((file) => file.endsWith(".ttf")).sort();
        expect(fonts.length).toBeGreaterThan(0);
        const reserved = new Set<string>();
        for (const font of fonts) {
          const names = nameTable(await Bun.file(join(folder, font)).bytes());
          const declared = (names.get(NAME_ID_LICENCE) ?? []).join("\n");
          expect(declared, font).toContain("SIL Open Font License, Version 1.1");
          expect(names.get(NAME_ID_LICENCE_URL)?.join(""), font).toContain("scripts.sil.org/OFL");
          const lines = declared.split("\n").map((line) => line.trim());
          const copyright = lines.filter((line) => line.startsWith("Copyright"));
          expect(copyright.length, font).toBeGreaterThan(0);
          for (const line of copyright) expect(entry.text, `${font}: ${line}`).toContain(line);
          for (const name of declared.matchAll(/Reserved Font Names? ([^\s,.]+)/g)) {
            reserved.add(name[1] as string);
          }
        }
        expect(reserved.size).toBeGreaterThan(0);
        for (const name of reserved) expect(entry.text, name).toContain(name);
      });

      test("the licence text is the pinned one, word for word", () => {
        // text/OFL-1.1.txt at the commit named in `source`, as the build ships it after the header.
        const body = entry.text.slice(entry.text.indexOf("SIL OPEN FONT LICENSE"));
        expect(createHash("sha256").update(body).digest("hex")).toBe(
          "8eea8287e5876b539670cadb82e99f9a7afddec6f6730811be1daf25d2e9bcfd",
        );
        expect(entry.reason).toContain(
          "8eea8287e5876b539670cadb82e99f9a7afddec6f6730811be1daf25d2e9bcfd",
        );
      });
    });
  }
});
