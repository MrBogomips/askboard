import { describe, expect, test } from "bun:test";
import { coreWith, type FakeConfigOptions, fakeConfig } from "./fakes.ts";

// The editor command in effect, as E5's `editorCommand` dependency of board-host reads it
// (settings-languages, task 5.3; design decision 5): the user file's argument vector, read without
// waiting once the settings are read; a project-level editor never, and none from a user file
// others can write. E5 wires it on its rebase, in place of `() => undefined`.

const v = "1.0";
const USER_EDITOR = ["code", "--goto", "{file}:{line}"];

const withConfig = (options: FakeConfigOptions) => {
  const fakes = fakeConfig(options);
  return coreWith({ config: fakes.config, diagnose: fakes.diagnose }).core;
};

describe("the editor command in effect", () => {
  test("is the user file's argument vector once the settings are read, and none before", async () => {
    const core = withConfig({ user: { version: v, editor: USER_EDITOR } });
    expect(core.editorCommand()).toBeUndefined();
    await core.settings();
    expect(core.editorCommand()).toEqual(USER_EDITOR);
  });

  test("a project-level editor is never the command, with or without the user's", async () => {
    const alone = withConfig({ project: { version: v, editor: ["evil", "{file}"] } });
    await alone.settings();
    expect(alone.editorCommand()).toBeUndefined();
    const both = withConfig({
      user: { version: v, editor: USER_EDITOR },
      project: { version: v, editor: ["evil", "{file}"] },
    });
    await both.settings();
    expect(both.editorCommand()).toEqual(USER_EDITOR);
  });

  test("a user file others can write gives no command", async () => {
    const core = withConfig({ user: { version: v, editor: USER_EDITOR }, othersCanWrite: true });
    await core.settings();
    expect(core.editorCommand()).toBeUndefined();
  });

  test("without the configuration's port there is no command", async () => {
    const { core } = coreWith({});
    await core.settings();
    expect(core.editorCommand()).toBeUndefined();
  });
});
