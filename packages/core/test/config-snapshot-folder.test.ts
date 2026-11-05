import { describe, expect, test } from "bun:test";
import { coreWith, type FakeFile, fakeConfig } from "./fakes.ts";

// settings-languages, design decision 5 (core spec: The Snapshot folder stays inside the project): a
// `snapshotFolder` that fails the syntactic check is dropped before the merge, with a warning on its
// row naming the value, so the folder in effect is the other file's or `.askboard/snapshots`.

const v = "1.0";

const read = async (user: FakeFile, project: FakeFile) => {
  const fakes = fakeConfig({ user, project });
  const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
  return { settings: await core.settings(), diagnosed: fakes.diagnosed };
};

describe("the Snapshot folder stays inside the project", () => {
  test.each([
    ["docs/snapshots", "docs/snapshots"],
    ["./out/../snaps", "snaps"],
    ["docs/snapshots/", "docs/snapshots"],
    ["a//b/./c", "a/b/c"],
  ])("%s is kept as %s", async (folder, kept) => {
    const { settings, diagnosed } = await read(undefined, { version: v, snapshotFolder: folder });
    expect(settings.values.snapshotFolder).toBe(kept);
    expect(settings.rows.snapshotFolder).toEqual({ value: kept, from: "project", writable: false });
    expect(diagnosed).toEqual([]);
  });

  test.each([
    "/tmp/snaps",
    "~/snaps",
    "..",
    "../shared",
    "a/../../b",
    "a\\b",
    "",
    ".",
    "a/..",
    "snaps\u0000x",
  ])("%j is replaced by .askboard/snapshots with a warning naming it", async (folder) => {
    const { settings, diagnosed } = await read({ version: v, snapshotFolder: folder }, undefined);
    expect(settings.values.snapshotFolder).toBe(".askboard/snapshots");
    expect(settings.rows.snapshotFolder).toEqual({
      value: ".askboard/snapshots",
      from: "default",
      writable: false,
      warnings: [
        { code: "snapshot-folder-replaced", file: "user", key: "snapshotFolder", value: folder },
      ],
    });
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).toContain(JSON.stringify(folder));
    expect(diagnosed[0]).toContain(".askboard/snapshots");
  });
});
