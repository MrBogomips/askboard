import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { link, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SNAPSHOT_NAME_PATTERN, SNAPSHOT_RANDOM } from "@askboard/contract";
import { type Randomness, SnapshotWriteError } from "@askboard/core";
import type { SnapshotFileSystem } from "../../src/snapshot/file-system.ts";
import { randomPart, snapshotNames } from "../../src/snapshot/name.ts";
import { type SnapshotFile, writeSnapshotFile } from "../../src/snapshot/write.ts";

// The name and the write (snapshot spec: The file's name, Never overwriting a file, Write
// failures; design decision 6, open questions A4 and B10), on real temporary folders, with the
// file system's calls replaced where a failure cannot be made otherwise.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-snapshot-write-")));
afterAll(() => {
  for (const name of readdirSync(root)) chmodSync(join(root, name), 0o700);
  rmSync(root, { recursive: true, force: true });
});

let count = 0;
const freshFolder = (): string => {
  count += 1;
  const folder = join(root, `snapshots-${count}`);
  mkdirSync(folder);
  return folder;
};

const ASK_ID = "offer-k3x9";
const TAKEN_AT = "2026-10-31T16:12:05Z";
const STEM = "offer-k3x9-20261031T161205Z";
const TOKEN = "pV3xK9qLmT2wR7nB4cYh8A";
const HTML = `<!doctype html><p>Agent text: which offer?</p><!-- ${TOKEN} -->\n`;

/** Randomness that draws these random parts, in order, then repeats the last. */
const drawing = (...parts: string[]): Randomness => {
  const queue = parts.flatMap((part) =>
    [...part].map((character) => SNAPSHOT_RANDOM.alphabet.indexOf(character)),
  );
  const last = queue.slice(-SNAPSHOT_RANDOM.length);
  return {
    bytes: (count) => {
      const taken = queue.splice(0, count);
      while (taken.length < count) taken.push(...last.slice(0, count - taken.length));
      return Uint8Array.from(taken);
    },
  };
};

type Written = { lines: string[]; file: SnapshotFile };

const writing = (folder: string, more: Partial<SnapshotFile> = {}): Written => ({
  lines: [],
  file: { folder, askId: ASK_ID, takenAt: TAKEN_AT, html: HTML, ...more },
});

const write = (
  { lines, file }: Written,
  randomness: Randomness = drawing("a1b2c3"),
  fs: Partial<SnapshotFileSystem> = {},
) => writeSnapshotFile(file, { randomness, report: (line) => lines.push(line), fs });

const failure = async (promise: Promise<unknown>): Promise<SnapshotWriteError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SnapshotWriteError) return error;
    throw error;
  }
  throw new Error("the write did not fail");
};

const coded = (code: string) => Object.assign(new Error(`${code}: refused`), { code });
const listing = (folder: string) => readdirSync(folder).sort();
const asRoot = process.getuid?.() === 0;

describe("the file's name", () => {
  test("is <ask-id>-<UTC basic time>-<6 random characters>.html (the spec's example)", async () => {
    const folder = freshFolder();
    const path = await write(writing(folder));
    expect(path).toBe(join(folder, `${STEM}-a1b2c3.html`));
    expect(listing(folder)).toEqual([`${STEM}-a1b2c3.html`]);
    expect(new RegExp(SNAPSHOT_NAME_PATTERN).test(`${STEM}-a1b2c3.html`)).toBe(true);
    expect(readFileSync(path, "utf8")).toBe(HTML);
  });

  test("drops a fraction of a second", async () => {
    const folder = freshFolder();
    const path = await write(writing(folder, { takenAt: "2026-10-31T16:12:05.987Z" }));
    expect(path).toBe(join(folder, `${STEM}-a1b2c3.html`));
  });

  test("every name drawn matches the contract's pattern, and five are drawn at most", () => {
    const names = snapshotNames(ASK_ID, TAKEN_AT, {
      bytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    });
    const drawn = [names.first, names.next(), names.next(), names.next(), names.next()];
    for (const name of drawn) expect(name).toMatch(new RegExp(SNAPSHOT_NAME_PATTERN));
    expect(names.next()).toBeUndefined();
  });

  test("the random part draws each character from a byte below 252, so none is likelier", () => {
    const bytes = [255, 0, 252, 35, 36, 251, 10, 11];
    const randomness: Randomness = { bytes: (n) => Uint8Array.from(bytes.splice(0, n)) };
    expect(randomPart(randomness)).toBe("0z0zab");
  });

  test.each([
    ["an ask ID with a slash", { askId: "../offer" }],
    ["an ask ID with a dot", { askId: "offer.k3x9" }],
    ["a local time", { takenAt: "2026-10-31T17:12:05+01:00" }],
    ["a time that is no time", { takenAt: "yesterday" }],
  ])("%s is refused before any file-system call", async (_, more) => {
    const calls: string[] = [];
    const spy: Partial<SnapshotFileSystem> = {
      open: async (path) => {
        calls.push(path);
        throw coded("EIO");
      },
    };
    const written = writing(freshFolder(), more);
    await expect(write(written, drawing("a1b2c3"), spy)).rejects.toBeInstanceOf(RangeError);
    expect(calls).toEqual([]);
    expect(written.lines).toEqual([]);
  });
});

describe("never overwriting a file", () => {
  test("an existing file under the chosen name keeps its bytes, and another name is used", async () => {
    const folder = freshFolder();
    writeFileSync(join(folder, `${STEM}-a1b2c3.html`), "mine");
    const path = await write(writing(folder), drawing("a1b2c3", "d4e5f6"));
    expect(path).toBe(join(folder, `${STEM}-d4e5f6.html`));
    expect(readFileSync(join(folder, `${STEM}-a1b2c3.html`), "utf8")).toBe("mine");
    expect(readFileSync(path, "utf8")).toBe(HTML);
    expect(listing(folder)).toEqual([`${STEM}-a1b2c3.html`, `${STEM}-d4e5f6.html`]);
  });

  test("a link planted under the final name is not followed", async () => {
    const folder = freshFolder();
    const victim = join(root, `victim-${count}.html`);
    symlinkSync(victim, join(folder, `${STEM}-a1b2c3.html`));
    const path = await write(writing(folder), drawing("a1b2c3", "d4e5f6"));
    expect(path).toBe(join(folder, `${STEM}-d4e5f6.html`));
    expect(existsSync(victim)).toBe(false);
  });

  test("a link planted under the partial name is not followed", async () => {
    const folder = freshFolder();
    const victim = join(root, `victim-${count}.txt`);
    writeFileSync(victim, "untouched");
    symlinkSync(victim, join(folder, `.${STEM}-a1b2c3.html.partial`));
    const path = await write(writing(folder), drawing("a1b2c3", "d4e5f6"));
    expect(path).toBe(join(folder, `${STEM}-d4e5f6.html`));
    expect(readFileSync(victim, "utf8")).toBe("untouched");
    // Only the planted link is left, which is not the writer's.
    expect(listing(folder)).toEqual([`.${STEM}-a1b2c3.html.partial`, `${STEM}-d4e5f6.html`]);
  });

  test("two Snapshots in the same second get two names, each complete", async () => {
    const folder = freshFolder();
    const randomness = drawing("a1b2c3", "a1b2c3", "d4e5f6");
    const [agent, user] = await Promise.all([
      write(writing(folder), randomness),
      write(writing(folder, { html: `${HTML}<!-- the user's -->` }), randomness),
    ]);
    expect(agent).not.toBe(user);
    expect(listing(folder)).toEqual([`${STEM}-a1b2c3.html`, `${STEM}-d4e5f6.html`]);
    expect(readFileSync(agent, "utf8")).toBe(HTML);
    expect(readFileSync(user, "utf8")).toBe(`${HTML}<!-- the user's -->`);
  });

  test("two Snapshots one after the other in the same second get two names", async () => {
    const folder = freshFolder();
    const randomness = drawing("a1b2c3", "a1b2c3", "d4e5f6");
    const first = await write(writing(folder), randomness);
    const second = await write(writing(folder), randomness);
    expect([first, second]).toEqual([
      join(folder, `${STEM}-a1b2c3.html`),
      join(folder, `${STEM}-d4e5f6.html`),
    ]);
  });

  test("five names in use fail with EEXIST, naming the folder, and change nothing", async () => {
    const folder = freshFolder();
    const parts = ["aaaaaa", "bbbbbb", "cccccc", "dddddd", "eeeeee"];
    for (const part of parts) writeFileSync(join(folder, `${STEM}-${part}.html`), part);
    const written = writing(folder);
    const error = await failure(write(written, drawing(...parts, "ffffff")));
    expect(error).toMatchObject({ code: "EEXIST", folder });
    expect(listing(folder)).toEqual(parts.map((part) => `${STEM}-${part}.html`));
    for (const part of parts) {
      expect(readFileSync(join(folder, `${STEM}-${part}.html`), "utf8")).toBe(part);
    }
    expect(written.lines).toHaveLength(1);
  });

  test("no final name appears before the file is complete", async () => {
    const folder = freshFolder();
    const seen: string[][] = [];
    const watching: Partial<SnapshotFileSystem> = {
      link: async (existing, path) => {
        seen.push(listing(folder));
        expect(readFileSync(existing, "utf8")).toBe(HTML);
        await link(existing, path);
      },
    };
    await write(writing(folder), drawing("a1b2c3"), watching);
    expect(seen).toEqual([[`.${STEM}-a1b2c3.html.partial`]]);
    expect(listing(folder)).toEqual([`${STEM}-a1b2c3.html`]);
  });
});

describe("where hard links are refused", () => {
  test.each(["EPERM", "ENOTSUP", "EXDEV"])(
    "%s from link falls back to an exclusive create of the final name",
    async (code) => {
      const folder = freshFolder();
      const refusing: Partial<SnapshotFileSystem> = {
        link: async () => {
          throw coded(code);
        },
      };
      const written = writing(folder);
      const path = await write(written, drawing("a1b2c3"), refusing);
      expect(path).toBe(join(folder, `${STEM}-a1b2c3.html`));
      expect(readFileSync(path, "utf8")).toBe(HTML);
      expect(listing(folder)).toEqual([`${STEM}-a1b2c3.html`]);
      expect(written.lines).toEqual([]);
    },
  );

  test("the fallback never overwrites either: a taken name draws another", async () => {
    const folder = freshFolder();
    writeFileSync(join(folder, `${STEM}-d4e5f6.html`), "mine");
    let links = 0;
    const refusing: Partial<SnapshotFileSystem> = {
      link: async () => {
        links += 1;
        throw coded(links === 1 ? "EEXIST" : "EXDEV");
      },
    };
    // The first name is taken; the link to the second is refused; the fallback finds the second
    // taken too, and writes under the third.
    const path = await write(writing(folder), drawing("a1b2c3", "d4e5f6", "g7h8i9"), refusing);
    expect(path).toBe(join(folder, `${STEM}-g7h8i9.html`));
    expect(readFileSync(join(folder, `${STEM}-d4e5f6.html`), "utf8")).toBe("mine");
    expect(readFileSync(path, "utf8")).toBe(HTML);
  });

  test("a failed write in place removes the file it created", async () => {
    const folder = freshFolder();
    const failing: Partial<SnapshotFileSystem> = {
      link: async () => {
        throw coded("ENOTSUP");
      },
      open: async (path, flags) => {
        const handle = await open(path, flags);
        if (path.endsWith(".partial")) return handle;
        return {
          writeFile: async () => {
            throw coded("ENOSPC");
          },
          sync: () => handle.sync(),
          close: () => handle.close(),
        };
      },
    };
    const written = writing(folder);
    const error = await failure(write(written, drawing("a1b2c3"), failing));
    expect(error).toMatchObject({ code: "ENOSPC", folder });
    expect(listing(folder)).toEqual([]);
    expect(written.lines).toHaveLength(1);
  });
});

describe("write failures", () => {
  test.skipIf(asRoot)(
    "a read-only folder fails naming the folder, and leaves no file",
    async () => {
      const folder = freshFolder();
      chmodSync(folder, 0o500);
      const written = writing(folder);
      const error = await failure(write(written));
      chmodSync(folder, 0o700);
      expect(error).toMatchObject({ name: "SnapshotWriteError", code: "EACCES", folder });
      expect(error.message).toBe(`no Snapshot written to ${folder}: EACCES`);
      expect(listing(folder)).toEqual([]);
    },
  );

  test.each([
    ["the write", "writeFile"],
    ["the sync", "sync"],
    ["the close", "close"],
  ] as const)("a failure at %s of the partial file removes it", async (_, step) => {
    const folder = freshFolder();
    const failing: Partial<SnapshotFileSystem> = {
      open: async (path, flags) => {
        const handle = await open(path, flags);
        const fail = async () => {
          throw coded("EIO");
        };
        return {
          writeFile:
            step === "writeFile" ? fail : (data, encoding) => handle.writeFile(data, encoding),
          sync: step === "sync" ? fail : () => handle.sync(),
          close: step === "close" ? () => handle.close().then(fail) : () => handle.close(),
        };
      },
    };
    const error = await failure(write(writing(folder), drawing("a1b2c3"), failing));
    expect(error).toMatchObject({ code: "EIO", folder });
    expect(listing(folder)).toEqual([]);
  });

  test("a link that fails otherwise removes the partial file and names no final file", async () => {
    const folder = freshFolder();
    const failing: Partial<SnapshotFileSystem> = {
      link: async () => {
        throw coded("EIO");
      },
    };
    const error = await failure(write(writing(folder), drawing("a1b2c3"), failing));
    expect(error).toMatchObject({ code: "EIO", folder });
    expect(listing(folder)).toEqual([]);
  });

  test("a removal that fails after a failed write leaves the first failure the one reported", async () => {
    const stuck = async () => {
      throw coded("EBUSY");
    };
    const afterLink: Partial<SnapshotFileSystem> = {
      link: async () => {
        throw coded("EIO");
      },
      unlink: stuck,
    };
    const afterWrite: Partial<SnapshotFileSystem> = {
      link: async () => {
        throw coded("EXDEV");
      },
      open: async (path, flags) => {
        const handle = await open(path, flags);
        if (path.endsWith(".partial")) return handle;
        const writeFile = async () => {
          throw coded("ENOSPC");
        };
        return { writeFile, sync: () => handle.sync(), close: () => handle.close() };
      },
      unlink: stuck,
    };
    for (const [fs, code] of [
      [afterLink, "EIO"],
      [afterWrite, "ENOSPC"],
    ] as const) {
      const folder = freshFolder();
      const written = writing(folder);
      const error = await failure(write(written, drawing("a1b2c3"), fs));
      expect(error.code).toBe(code);
      expect(written.lines).toEqual([`askboard: no Snapshot written to ${folder}: ${code}`]);
    }
  });

  test("an error without a code fails as EIO, and a code that is no file-system code too", async () => {
    for (const thrown of [new Error("no code"), coded("not a code\n<script>"), "a string"]) {
      const folder = freshFolder();
      const failing: Partial<SnapshotFileSystem> = {
        link: async () => {
          throw thrown;
        },
      };
      const written = writing(folder);
      const error = await failure(write(written, drawing("a1b2c3"), failing));
      expect(error.code).toBe("EIO");
      expect(written.lines).toEqual([`askboard: no Snapshot written to ${folder}: EIO`]);
    }
  });

  test("the one diagnostic names the folder and the code, and no ask ID, agent text or token", async () => {
    const folder = freshFolder();
    const failing: Partial<SnapshotFileSystem> = {
      link: async () => {
        throw coded("EIO");
      },
    };
    const written = writing(folder);
    await failure(write(written, drawing("a1b2c3"), failing));
    expect(written.lines).toEqual([`askboard: no Snapshot written to ${folder}: EIO`]);
    const [line] = written.lines;
    for (const secret of [ASK_ID, "Agent text", TOKEN, "a1b2c3"]) {
      expect(line).not.toContain(secret);
    }
  });

  test("a written Snapshot reports nothing", async () => {
    const written = writing(freshFolder());
    await write(written);
    expect(written.lines).toEqual([]);
  });

  test("a partial file that cannot be removed after the link is reported, and the Snapshot kept", async () => {
    const folder = freshFolder();
    const stuck: Partial<SnapshotFileSystem> = {
      unlink: async () => {
        throw coded("EBUSY");
      },
    };
    const written = writing(folder);
    const path = await write(written, drawing("a1b2c3"), stuck);
    expect(readFileSync(path, "utf8")).toBe(HTML);
    expect(written.lines).toEqual([
      `askboard: a Snapshot's partial file stayed in ${folder}: EBUSY`,
    ]);
  });
});
