import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { locate } from "../../src/excerpts/confine.ts";
import { readAtMost, withRegularFile } from "../../src/excerpts/open.ts";
import { isRefused } from "../../src/excerpts/refused.ts";
import { caseInsensitive, makeSandbox, type Sandbox, spyFs } from "./helpers.ts";

// Board-host spec, Pointers resolve only inside the root, "Case and Unicode forms on macOS"
// (excerpts, task 2.3; proposal B3): no case folding and no normalisation of AskBoard's own. On
// macOS's case-insensitive APFS, realpath(3) gives a name in the volume's own case and form, for
// the root and the candidate alike, so an in-root name in another case or form stays under the
// real root while no form of a path outside does. On a case-sensitive volume, as Linux's are, two
// names differing only by case are two files.

const probe = mkdtempSync(join(tmpdir(), "askboard-excerpts-case-"));
const INSENSITIVE = caseInsensitive(probe);
rmSync(probe, { recursive: true });
const MAC_INSENSITIVE = process.platform === "darwin" && INSENSITIVE;

let box: Sandbox;

beforeEach(() => {
  box = makeSandbox();
});

afterEach(() => {
  const untouched = box.sentinelUntouched();
  box.remove();
  expect(untouched).toBe(true);
});

const read = async (root: string, pointer: string) => {
  const { fs } = spyFs();
  const located = await locate(fs, root, pointer);
  if (isRefused(located)) return located;
  const bytes = await withRegularFile(fs, located.realPath, (file) => readAtMost(file, 1_024));
  return isRefused(bytes)
    ? bytes
    : { realPath: located.realPath, text: new TextDecoder().decode(bytes) };
};

describe("macOS, case-insensitive APFS", () => {
  test.skipIf(!MAC_INSENSITIVE)(
    "a name in another case resolves to that file inside the root (macOS case-insensitive volumes only)",
    async () => {
      box.write("docs/x.md", "# X\n");
      for (const pointer of ["DOCS/X.md#X", "Docs/x.MD#X", "docs/X.md#X"]) {
        expect(await read(box.root, pointer)).toEqual({
          realPath: join(box.realRoot, "docs/x.md"),
          text: "# X\n",
        });
      }
    },
  );

  test.skipIf(!MAC_INSENSITIVE)(
    "a root named in another case is made real and still holds its files (macOS case-insensitive volumes only)",
    async () => {
      box.write("docs/x.md", "# X\n");
      expect(await read(join(box.base, "PROJ"), "docs/x.md#X")).toEqual({
        realPath: join(box.realRoot, "docs/x.md"),
        text: "# X\n",
      });
    },
  );

  test.skipIf(!MAC_INSENSITIVE)(
    "a name in NFC resolves the file stored in NFD, and the other way round (macOS APFS only)",
    async () => {
      const nfd = "café.md";
      const nfc = "café.md";
      box.write(`docs/${nfd}`, "# D\n");
      box.write(`notes/${nfc}`, "# C\n");
      expect(await read(box.root, `docs/${nfc}#D`)).toMatchObject({ text: "# D\n" });
      expect(await read(box.root, `notes/${nfd}#C`)).toMatchObject({ text: "# C\n" });
      expect(await read(box.root, `DOCS/${nfc.toUpperCase()}#D`)).toMatchObject({ text: "# D\n" });
    },
  );

  test.skipIf(!MAC_INSENSITIVE)(
    "no case or form of a path to the sibling outside the root resolves (macOS case-insensitive volumes only)",
    async () => {
      for (const [index, target] of [
        join(box.base, "PROJ-OLD/x.md"),
        join(box.base, "Proj-Old/X.MD"),
        "../../proj-OLD/x.md",
        "../../PROJ-OLD/X.md",
      ].entries()) {
        box.link(`docs/s${index}.md`, target);
      }
      box.link("vendor", join(box.base, "PROJ-OLD"));
      for (const pointer of [
        "docs/s0.md#Secret",
        "DOCS/S1.md#Secret",
        "docs/s2.md#Secret",
        "Docs/s3.MD#Secret",
      ]) {
        expect(await read(box.root, pointer)).toEqual({ refused: "outside-root" });
      }
      expect(await read(box.root, "VENDOR/X.md#Secret")).toEqual({ refused: "outside-root" });
      expect(await read(join(box.base, "PROJ"), "vendor/x.md#Secret")).toEqual({
        refused: "outside-root",
      });
    },
  );
});

describe("a case-sensitive volume, as Linux's are", () => {
  test.skipIf(INSENSITIVE)(
    "two names differing only by case each resolve to their own file (case-sensitive volumes only)",
    async () => {
      box.write("docs/x.md", "# lower\n");
      box.write("docs/X.md", "# upper\n");
      expect(await read(box.root, "docs/x.md#lower")).toEqual({
        realPath: join(box.realRoot, "docs/x.md"),
        text: "# lower\n",
      });
      expect(await read(box.root, "docs/X.md#upper")).toEqual({
        realPath: join(box.realRoot, "docs/X.md"),
        text: "# upper\n",
      });
      expect(await read(box.root, "DOCS/x.md#lower")).toEqual({ refused: "not-found" });
    },
  );

  test.skipIf(INSENSITIVE)(
    "a root named in another case is no root of these files (case-sensitive volumes only)",
    async () => {
      box.write("docs/x.md", "# X\n");
      expect(await read(join(box.base, "PROJ"), "docs/x.md#X")).toEqual({ refused: "not-found" });
    },
  );
});
