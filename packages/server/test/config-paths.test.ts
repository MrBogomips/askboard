import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { displayPaths, resolveConfigPaths, userConfigPath } from "../src/config-files.ts";

// The configuration files' paths (settings-languages design decision 4; core spec, "Two
// configuration files"), on real temporary folders. Every test passes its own environment, with
// HOME and XDG_CONFIG_HOME inside a temporary folder, so the developer's own are never read.

const root = realpathSync(mkdtempSync(join(tmpdir(), "askboard-config-paths-")));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const home = join(root, "home");
const xdg = join(root, "xdg");
const project = join(root, "project");
const linked = join(root, "linked-project");
mkdirSync(home);
mkdirSync(xdg);
mkdirSync(join(project, ".askboard"), { recursive: true });
symlinkSync(project, linked);

describe("the user file", () => {
  test.each([
    [
      "an absolute XDG_CONFIG_HOME",
      { XDG_CONFIG_HOME: xdg, HOME: home },
      join(xdg, "askboard/config.json"),
    ],
    ["XDG_CONFIG_HOME without HOME", { XDG_CONFIG_HOME: xdg }, join(xdg, "askboard/config.json")],
    [
      "a relative XDG_CONFIG_HOME",
      { XDG_CONFIG_HOME: "conf", HOME: home },
      join(home, ".config/askboard/config.json"),
    ],
    [
      "an empty XDG_CONFIG_HOME",
      { XDG_CONFIG_HOME: "", HOME: home },
      join(home, ".config/askboard/config.json"),
    ],
    ["no XDG_CONFIG_HOME", { HOME: home }, join(home, ".config/askboard/config.json")],
    ["a relative HOME", { HOME: "home" }, undefined],
    ["a relative HOME and XDG_CONFIG_HOME", { HOME: "home", XDG_CONFIG_HOME: "conf" }, undefined],
    ["no HOME and no XDG_CONFIG_HOME", {}, undefined],
    ["an empty HOME", { HOME: "" }, undefined],
  ])("with %s", (_, env, expected) => {
    expect(userConfigPath(env)).toBe(expected);
  });

  test("a trailing slash or a dot segment in the variable is normalised", () => {
    expect(userConfigPath({ XDG_CONFIG_HOME: `${xdg}/./` })).toBe(
      join(xdg, "askboard/config.json"),
    );
  });
});

describe("the project file", () => {
  test("is under the real path of CLAUDE_PROJECT_DIR", async () => {
    const paths = await resolveConfigPaths({ CLAUDE_PROJECT_DIR: linked, HOME: home });
    expect(paths.projectRoot).toBe(project);
    expect(paths.project).toBe(join(project, ".askboard/config.json"));
    expect(paths.user).toBe(join(home, ".config/askboard/config.json"));
  });

  test("is none without CLAUDE_PROJECT_DIR, or with it empty", async () => {
    for (const env of [{ HOME: home }, { HOME: home, CLAUDE_PROJECT_DIR: "" }]) {
      const paths = await resolveConfigPaths(env);
      expect(paths).toEqual({ user: join(home, ".config/askboard/config.json") });
    }
  });

  test("a project folder that does not exist keeps its absolute path, to be found absent", async () => {
    const missing = join(root, "missing");
    const paths = await resolveConfigPaths({ CLAUDE_PROJECT_DIR: missing });
    expect(paths).toEqual({
      projectRoot: missing,
      project: join(missing, ".askboard/config.json"),
    });
  });

  test("is never the working folder's, even when it holds .askboard/config.json", () => {
    writeFileSync(join(project, ".askboard/config.json"), '{"version": "1.0"}');
    const script = `
      const { resolveConfigPaths } = await import(${JSON.stringify(join(import.meta.dir, "../src/config-files.ts"))});
      console.log(JSON.stringify(await resolveConfigPaths(process.env)));
    `;
    const run = Bun.spawnSync([process.execPath, "-e", script], {
      cwd: project,
      env: { PATH: process.env.PATH ?? "", HOME: home },
    });
    expect(run.stderr.toString()).toBe("");
    expect(JSON.parse(run.stdout.toString())).toEqual({
      user: join(home, ".config/askboard/config.json"),
    });
  });
});

describe("the paths as the panel shows them", () => {
  test("the user file under HOME starts with ~, and the project file is relative", () => {
    expect(displayPaths({ HOME: home, CLAUDE_PROJECT_DIR: project })).toEqual({
      user: "~/.config/askboard/config.json",
      project: ".askboard/config.json",
    });
  });

  test("an XDG_CONFIG_HOME under HOME starts with ~ too", () => {
    const inside = join(home, "dotfiles");
    expect(displayPaths({ HOME: home, XDG_CONFIG_HOME: inside }).user).toBe(
      "~/dotfiles/askboard/config.json",
    );
  });

  test("a user file outside HOME shows whole, and a folder that only starts like HOME too", () => {
    expect(displayPaths({ HOME: home, XDG_CONFIG_HOME: xdg }).user).toBe(
      join(xdg, "askboard/config.json"),
    );
    expect(displayPaths({ HOME: home, XDG_CONFIG_HOME: `${home}2` }).user).toBe(
      `${home}2/askboard/config.json`,
    );
  });

  test("no file, no path", () => {
    expect(displayPaths({})).toEqual({});
  });
});
