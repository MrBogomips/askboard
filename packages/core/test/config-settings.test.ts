import { describe, expect, test } from "bun:test";
import { CONFIGURATION_KEYS } from "@askboard/contract";
import { AskCore } from "../src/index.ts";
import { coreWith, type FakeFile, fakeConfig, fakePorts, plainChoiceAsk } from "./fakes.ts";

// settings-languages, design decisions 3 and 4 (core spec: Read once, on first use; Merged key by
// key, project keys winning): ask-core reads both files the first time it needs a setting, once,
// and takes each key from the project file, else the user file, else its default.

const v = "1.0";

describe("reading the configuration once, on first use", () => {
  test("nothing is read before the first call that needs a setting", async () => {
    const { config, calls } = fakeConfig({ user: { version: v, theme: "dark" } });
    const { core } = coreWith({ config });
    expect(calls).toEqual([]);
    await core.settings();
    expect(calls.sort()).toEqual(["project", "user"]);
  });

  test("an ask needs one: its language (task 3.6)", async () => {
    const { config, calls } = fakeConfig({ user: { version: v, theme: "dark" } });
    const { core } = coreWith({ config });
    await core.ask(plainChoiceAsk());
    expect(calls.sort()).toEqual(["folders", "project", "user"]);
  });

  test("both files are read once, however many calls and asks follow", async () => {
    const { config, calls } = fakeConfig({ user: { version: v, theme: "dark" } });
    const { core } = coreWith({ config });
    const all = await Promise.all([core.settings(), core.settings(), core.settings()]);
    await core.ask(plainChoiceAsk());
    await core.ask({ ...plainChoiceAsk(), askId: "second-ask" });
    expect(await core.settings()).toBe(all[0]);
    expect(new Set(all).size).toBe(1);
    expect(calls.sort()).toEqual(["folders", "project", "user"]);
  });
});

describe("merging key by key", () => {
  const merged = async (user: FakeFile, project: FakeFile) => {
    const { config } = fakeConfig({ user, project });
    return coreWith({ config }).core.settings();
  };

  test("the project's asking rule wins over the user's, which is kept as the other value", async () => {
    const settings = await merged(
      { version: v, askingRule: "none" },
      { version: v, askingRule: "always" },
    );
    expect(settings.values.askingRule).toBe("always");
    expect(settings.rows.askingRule).toEqual({
      value: "always",
      from: "project",
      writable: false,
      other: { file: "user", value: "none" },
    });
  });

  test("keys from both files combine, and every other key takes its default", async () => {
    const settings = await merged(
      { version: v, theme: "dark" },
      { version: v, density: "comfortable" },
    );
    expect(settings.values).toEqual({
      theme: "dark",
      density: "comfortable",
      contextPlacement: "beside",
      defaultLanguage: "en-US",
      askingRule: "none",
      snapshotFolder: ".askboard/snapshots",
    });
    expect(settings.rows.theme).toEqual({ value: "dark", from: "user", writable: true });
    expect(settings.rows.density).toEqual({
      value: "comfortable",
      from: "project",
      writable: false,
    });
    expect(settings.rows.contextPlacement).toEqual({
      value: "beside",
      from: "default",
      writable: true,
    });
    expect(settings.rows.editor).toEqual({ from: "default", writable: false });
    expect(settings.rows.defaultMinimumMargin).toEqual({ from: "default", writable: false });
    expect(Object.keys(settings.rows)).toEqual([...CONFIGURATION_KEYS]);
  });

  test("a key the user file alone sets has no other value", async () => {
    const settings = await merged(
      { version: v, defaultLanguage: "it-IT", defaultMinimumMargin: 12 },
      undefined,
    );
    expect(settings.rows.defaultLanguage).toEqual({
      value: "it-IT",
      from: "user",
      writable: false,
    });
    expect(settings.values.defaultMinimumMargin).toBe(12);
  });

  test("both files applied are recorded with the paths the panel shows", async () => {
    const settings = await merged({ version: v }, { version: v });
    expect(settings.files).toEqual({
      user: { path: "~/.config/askboard/config.json", status: "applied" },
      project: { path: ".askboard/config.json", status: "applied" },
    });
    expect(settings.warnings).toEqual([]);
  });

  test("absent files are recorded as absent, a path the adapter has none for left out", async () => {
    const { config } = fakeConfig({ paths: { user: "~/.config/askboard/config.json" } });
    const settings = await coreWith({ config }).core.settings();
    expect(settings.files).toEqual({
      user: { path: "~/.config/askboard/config.json", status: "absent" },
      project: { status: "absent" },
    });
  });
});

describe("without the Config port", () => {
  test("every key takes its default and both files are absent", async () => {
    const core = new AskCore(fakePorts().ports);
    const settings = await core.settings();
    expect(settings.values).toEqual({
      theme: "system",
      density: "compact",
      contextPlacement: "beside",
      defaultLanguage: "en-US",
      askingRule: "none",
      snapshotFolder: ".askboard/snapshots",
    });
    for (const key of CONFIGURATION_KEYS) expect(settings.rows[key]?.from).toBe("default");
    expect(settings.files).toEqual({ user: { status: "absent" }, project: { status: "absent" } });
  });
});
