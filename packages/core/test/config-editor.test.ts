import { describe, expect, test } from "bun:test";
import { coreWith, type FakeFile, fakeConfig } from "./fakes.ts";

// settings-languages, design decision 5 (core spec: The editor comes from the user file only): a
// project `editor`, and a user one from a file others can write, are dropped before the merge, each
// with a warning on the editor row (AD-8, B4).

const v = "1.0";
const CODE = ["code", "--goto", "{file}:{line}"];

const read = async (user: FakeFile, project: FakeFile, othersCanWrite = false) => {
  const fakes = fakeConfig({ user, project, othersCanWrite });
  const { core } = coreWith({ config: fakes.config, diagnose: fakes.diagnose });
  return { settings: await core.settings(), diagnosed: fakes.diagnosed };
};

describe("the editor comes from the user file only", () => {
  test("a project editor alone gives no editor and the warning project-editor-ignored", async () => {
    const { settings, diagnosed } = await read(undefined, {
      version: v,
      editor: ["sh", "-c", "curl evil"],
    });
    expect(settings.values.editor).toBeUndefined();
    expect(settings.rows.editor).toEqual({
      from: "default",
      writable: false,
      warnings: [{ code: "project-editor-ignored", file: "project", key: "editor" }],
    });
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).toContain(".askboard/config.json");
    expect(diagnosed[0]).toContain("editor");
    expect(diagnosed[0]).not.toContain("curl");
  });

  test("with a user editor too, the user's is in effect and the warning stays", async () => {
    const { settings } = await read(
      { version: v, editor: CODE },
      { version: v, editor: ["evil", "{file}"] },
    );
    expect(settings.values.editor).toEqual(CODE);
    expect(settings.rows.editor).toEqual({
      value: CODE,
      from: "user",
      writable: false,
      warnings: [{ code: "project-editor-ignored", file: "project", key: "editor" }],
    });
  });

  test("a user file others can write gives no editor, while its other keys apply", async () => {
    const { settings, diagnosed } = await read(
      { version: v, editor: CODE, theme: "dark" },
      undefined,
      true,
    );
    expect(settings.values.editor).toBeUndefined();
    expect(settings.values.theme).toBe("dark");
    expect(settings.rows.editor).toEqual({
      from: "default",
      writable: false,
      warnings: [{ code: "editor-file-writable-by-others", file: "user", key: "editor" }],
    });
    expect(diagnosed).toHaveLength(1);
    expect(diagnosed[0]).toContain("~/.config/askboard/config.json");
    expect(diagnosed[0]).not.toContain("--goto");
  });

  test("a user file others can write that sets no editor has no warning", async () => {
    const { settings, diagnosed } = await read({ version: v, theme: "dark" }, undefined, true);
    expect(settings.rows.editor).toEqual({ from: "default", writable: false });
    expect(diagnosed).toEqual([]);
  });
});
