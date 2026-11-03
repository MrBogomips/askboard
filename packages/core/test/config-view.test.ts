import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import { coreWith, type FakeConfigOptions, fakeConfig } from "./fakes.ts";

// settings-languages, design decisions 6 and 12: the settings view `board-host` sends a board as
// the body of its `settings` message, and the asking rule in effect, which the local API answers.

const v = "1.0";

const withConfig = (options: FakeConfigOptions) => {
  const fakes = fakeConfig(options);
  return { ...coreWith({ config: fakes.config, diagnose: fakes.diagnose }), ...fakes };
};

const asMessage = (view: object) => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "settings",
  ...view,
});

describe("the settings view a board receives", () => {
  test("every row with where it comes from, whether the board may write it, the other value and its warnings", async () => {
    const { core } = withConfig({
      user: { version: v, theme: "dark", askingRule: "none", editor: ["code", "{file}"] },
      project: { version: v, askingRule: "always", density: "comfortable", editor: ["evil"] },
    });
    const view = await core.boardSettingsView();
    expect(validateBoardMessage("toPage", asMessage(view)).ok).toBe(true);
    expect(view.keys.theme).toEqual({ value: "dark", from: "user", writable: true });
    expect(view.keys.density).toEqual({ value: "comfortable", from: "project", writable: false });
    expect(view.keys.contextPlacement).toEqual({
      value: "beside",
      from: "default",
      writable: true,
    });
    expect(view.keys.askingRule).toEqual({
      value: "always",
      from: "project",
      writable: false,
      other: { file: "user", value: "none" },
    });
    expect(view.keys.editor).toEqual({
      value: ["code", "{file}"],
      from: "user",
      writable: false,
      warnings: [{ code: "project-editor-ignored", file: "project", key: "editor" }],
    });
    expect(view.keys.defaultMinimumMargin).toEqual({ from: "default", writable: false });
    expect(view.write).toBeUndefined();
  });

  test("the files with the paths the panel shows, and the warnings no row holds", async () => {
    const { core } = withConfig({
      user: { version: v, fontSize: 14 },
      project: "{ not json",
    });
    const view = await core.boardSettingsView();
    expect(validateBoardMessage("toPage", asMessage(view)).ok).toBe(true);
    expect(view.files).toEqual({
      user: { path: "~/.config/askboard/config.json", status: "applied" },
      project: {
        path: ".askboard/config.json",
        status: "not-applied",
        problem: { code: "not-json" },
      },
    });
    expect(view.warnings).toEqual([{ code: "unknown-key", file: "user", key: "fontSize" }]);
  });

  test("without a user or project file, the files have no path", async () => {
    const { core } = withConfig({ paths: {} });
    const view = await core.boardSettingsView();
    expect(view.files).toEqual({ user: { status: "absent" }, project: { status: "absent" } });
    expect(validateBoardMessage("toPage", asMessage(view)).ok).toBe(true);
  });

  test("after a write, the view carries its outcome and the value as read now", async () => {
    const { core } = withConfig({ user: { version: v } });
    const write = await core.writeSetting({ key: "theme", value: "dark" });
    const view = await core.boardSettingsView(write);
    expect(view.write).toEqual({ key: "theme", outcome: "saved" });
    expect(view.keys.theme).toEqual({ value: "dark", from: "user", writable: true });
    expect(validateBoardMessage("toPage", asMessage(view)).ok).toBe(true);
  });

  test("a refused write's outcome names the file", async () => {
    const { core } = withConfig({ user: "{ not json" });
    const write = await core.writeSetting({ key: "density", value: "comfortable" });
    const view = await core.boardSettingsView(write);
    expect(view.write).toEqual({
      key: "density",
      outcome: "refused",
      reason: "file-not-applied",
      path: "~/.config/askboard/config.json",
    });
    expect(validateBoardMessage("toPage", asMessage(view)).ok).toBe(true);
  });
});

describe("the asking rule in effect", () => {
  const ruleOf = async (options: FakeConfigOptions) => {
    const { core } = withConfig(options);
    await core.settings();
    return core.askingRule();
  };

  test("none before the configuration is read", () => {
    const { core } = withConfig({ project: { version: v, askingRule: "always" } });
    expect(core.askingRule()).toBe("none");
  });

  test("the project's, else the user's, else none", async () => {
    expect(
      await ruleOf({
        user: { version: v, askingRule: "with-references" },
        project: { version: v, askingRule: "always" },
      }),
    ).toBe("always");
    expect(await ruleOf({ user: { version: v, askingRule: "with-references" } })).toBe(
      "with-references",
    );
    expect(await ruleOf({})).toBe("none");
  });

  test("none when the project file that sets it fails its check", async () => {
    expect(await ruleOf({ project: { version: v, askingRule: "always", theme: "sepia" } })).toBe(
      "none",
    );
    expect(
      await ruleOf({
        user: { version: v, askingRule: "with-references" },
        project: { version: v, askingRule: "sometimes" },
      }),
    ).toBe("with-references");
  });

  test("without the port, none", async () => {
    const { core } = coreWith();
    await core.settings();
    expect(core.askingRule()).toBe("none");
  });
});
