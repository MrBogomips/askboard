import { describe, expect, test } from "bun:test";
import type { FolderResult } from "../src/index.ts";
import { askWith, coreWith, type FakeOptions, fakeConfig, plainChoiceAsk } from "./fakes.ts";

// settings-languages, design decision 13 (core spec: The project folders at the first ask): the
// first accepted ask creates `.askboard/` once; a failure is said on stderr and the ask stands.

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

const withFolders = (folders?: FolderResult, options: FakeOptions = {}) => {
  const fakes = fakeConfig(folders === undefined ? {} : { folders });
  const fixture = coreWith({ config: fakes.config, diagnose: fakes.diagnose, ...options });
  const folderCalls = () => fakes.calls.filter((call) => call === "folders");
  // E4's version gate says its own line at the first ask.
  const diagnosed = () => fakes.diagnosed.filter((line) => line.includes(".askboard"));
  return { ...fixture, folderCalls, diagnosed };
};

describe("the project folders at the first ask", () => {
  test("created once, at the first accepted ask, and not before", async () => {
    const { core, folderCalls } = withFolders();
    await core.settings();
    expect(folderCalls()).toEqual([]);
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(folderCalls()).toEqual(["folders"]);
    await core.ask(askWith({ askId: "second-ask-p4n2" }));
    await core.ask(plainChoiceAsk());
    expect(folderCalls()).toEqual(["folders"]);
  });

  test("never for a refused ask", async () => {
    const { core, folderCalls } = withFolders(undefined, {
      showing: { showable: false, reason: "ci", detail: "CI is set and BROWSER is not" },
    });
    expect((await core.ask({ askId: "x" })).kind).toBe("invalid");
    expect((await core.ask(plainChoiceAsk())).kind).toBe("unavailable");
    expect(folderCalls()).toEqual([]);
  });

  test("a failure is said on stderr, naming .askboard/ and the path, and the ask stands", async () => {
    const { core, diagnosed, reported } = withFolders({
      kind: "failed",
      path: "/work/app/.askboard",
      code: "EACCES",
    });
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    await settled();
    expect(diagnosed()).toEqual([
      'AskBoard: .askboard/ could not be created at "/work/app/.askboard" (EACCES); the ask goes on without it.',
    ]);
    expect(reported).toEqual([]);
  });

  test("a call that rejects is reported, and the ask stands", async () => {
    const fakes = fakeConfig();
    const failure = new Error("the adapter broke");
    const { core, reported } = coreWith({
      config: { ...fakes.config, ensureProjectFolders: () => Promise.reject(failure) },
    });
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    await settled();
    expect(reported).toEqual([failure]);
  });

  test("without a diagnose port, a failure is reported", async () => {
    const fakes = fakeConfig({
      folders: { kind: "failed", path: "/p/.askboard", code: "ENOTDIR" },
    });
    const { core, reported } = coreWith({ config: fakes.config });
    await core.ask(plainChoiceAsk());
    await settled();
    expect(reported).toHaveLength(1);
    expect(String(reported[0])).toContain(".askboard/ could not be created");
  });

  test("ready or no project says nothing", async () => {
    for (const folders of [
      { kind: "ready", created: [".askboard"] },
      { kind: "no-project" },
    ] as const) {
      const { core, diagnosed, reported } = withFolders(folders);
      await core.ask(plainChoiceAsk());
      await settled();
      expect([...diagnosed(), ...reported]).toEqual([]);
    }
  });
});
