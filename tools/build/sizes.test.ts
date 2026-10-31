import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatSizes, readSizes, SIZE_MARGIN, sizeNotes, sizeProblems } from "./sizes.ts";

describe("chunk growth (Consistency Conventions, Tests)", () => {
  test("the margin is 10%", () => {
    expect(SIZE_MARGIN).toBe(0.1);
  });

  test("a chunk past the margin fails, naming the chunk and both sizes", () => {
    const problems = sizeProblems({ shell: 1000, react: 5000 }, { shell: 1101, react: 5000 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"shell"');
    expect(problems[0]).toContain("1,101 bytes");
    expect(problems[0]).toContain("1,000 bytes");
    expect(problems[0]).toContain("--record-sizes");
  });

  test("a chunk that doubles fails", () => {
    expect(sizeProblems({ choice: 2000 }, { choice: 4000 })[0]).toContain("4,000 bytes");
  });

  test("growth up to the margin passes, and so does a smaller chunk", () => {
    expect(sizeProblems({ shell: 1000, radix: 900 }, { shell: 1100, radix: 10 })).toEqual([]);
  });

  test("a chunk with no recorded size fails, and so does a recorded chunk the build lost", () => {
    const problems = sizeProblems({ shell: 1000, old: 10 }, { shell: 1000, fresh: 10 });
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toContain('"fresh" has no recorded size');
    expect(problems.join("\n")).toContain('"old" is recorded');
  });

  test("a recorded name such as constructor is no recorded size", () => {
    expect(sizeProblems({}, { constructor: 10 })[0]).toContain("no recorded size");
  });

  test("a chunk that shrank past the margin gets a note, not a failure", () => {
    const notes = sizeNotes({ shell: 1000, react: 5000 }, { shell: 800, react: 5000 });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('"shell"');
    expect(notes[0]).toContain("800 bytes");
  });
});

describe("the recorded sizes file", () => {
  const dirs: string[] = [];
  const scratch = async () => {
    const dir = await mkdtemp(join(tmpdir(), "askboard-sizes-"));
    dirs.push(dir);
    return dir;
  };
  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });

  test("is written with its names sorted, one per line, and read back", async () => {
    const text = formatSizes({ shell: 2, "board-page": 1 });
    expect(text).toBe('{\n  "board-page": 1,\n  "shell": 2\n}\n');
    const file = join(await scratch(), "chunk-sizes.json");
    await Bun.write(file, text);
    expect(await readSizes(file)).toEqual({ "board-page": 1, shell: 2 });
  });

  test("a missing file reads as no recorded size", async () => {
    expect(await readSizes(join(await scratch(), "absent.json"))).toEqual({});
  });

  test("a file that is not a map of byte counts fails, naming the file", async () => {
    const file = join(await scratch(), "chunk-sizes.json");
    await Bun.write(file, '{"shell": "big"}');
    await expect(readSizes(file)).rejects.toThrow("chunk-sizes.json");
    await Bun.write(file, "[1]");
    await expect(readSizes(file)).rejects.toThrow("chunk-sizes.json");
  });
});
