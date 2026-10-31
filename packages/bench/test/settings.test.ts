import { describe, expect, test } from "bun:test";
import { DEFAULTS, parseCommand, UsageError } from "../src/settings.ts";

describe("defaults", () => {
  test("are the pinned settings of the proposal's open question 10", () => {
    expect(DEFAULTS).toMatchObject({
      session: "e1",
      cases: ["S1", "S6"],
      arms: ["askboard", "auq", "baseline"],
      runs: 5,
      model: "claude-opus-5-5",
      effort: "medium",
      cacheTtl: "5m",
      toolSearch: "true",
      maxTurns: 12,
      timeoutSeconds: 300,
      claude: "claude",
      auqPermissionHost: true,
      out: ".askboard/bench",
      keepProjects: false,
    });
    expect(DEFAULTS.claudeVersion).toBeUndefined();
    expect(DEFAULTS.pluginDir).toBeUndefined();
  });
});

describe("parseCommand", () => {
  test("run with no option takes the defaults", () => {
    expect(parseCommand(["run"])).toEqual({ kind: "run", settings: DEFAULTS });
  });

  test("run takes every option, in both spellings", () => {
    const command = parseCommand([
      "run",
      "--session=stub",
      "--cases",
      "S1",
      "--arms=auq",
      "--runs",
      "2",
      "--model",
      "claude-sonnet-5-5",
      "--effort=xhigh",
      "--cache-ttl",
      "1h",
      "--tool-search",
      "auto:5",
      "--max-turns",
      "20",
      "--timeout",
      "90",
      "--claude",
      "/opt/claude",
      "--claude-version",
      "2.1.314",
      "--plugin-dir",
      "/tmp/plugin",
      "--auq-permission-host",
      "off",
      "--out",
      "/tmp/out",
      "--keep-projects",
    ]);
    expect(command).toEqual({
      kind: "run",
      settings: {
        session: "stub",
        cases: ["S1"],
        arms: ["auq"],
        runs: 2,
        model: "claude-sonnet-5-5",
        effort: "xhigh",
        cacheTtl: "1h",
        toolSearch: "auto:5",
        maxTurns: 20,
        timeoutSeconds: 90,
        claude: "/opt/claude",
        claudeVersion: "2.1.314",
        pluginDir: "/tmp/plugin",
        auqPermissionHost: false,
        out: "/tmp/out",
        keepProjects: true,
      },
    });
  });

  test("smoke takes the session and the plugin directory", () => {
    expect(parseCommand(["smoke"])).toEqual({ kind: "smoke", session: "e1" });
    expect(parseCommand(["smoke", "--session", "stub", "--plugin-dir", "/p"])).toEqual({
      kind: "smoke",
      session: "stub",
      pluginDir: "/p",
    });
  });

  test("report takes one run folder", () => {
    expect(parseCommand(["report", ".askboard/bench/x"])).toEqual({
      kind: "report",
      folder: ".askboard/bench/x",
    });
  });

  test("help, with no command or with --help", () => {
    expect(parseCommand([])).toEqual({ kind: "help" });
    expect(parseCommand(["--help"])).toEqual({ kind: "help" });
    expect(parseCommand(["run", "--help"])).toEqual({ kind: "help" });
  });

  test.each([
    [["bench"], 'unknown command "bench"'],
    [["run", "--colour", "red"], 'unknown option "--colour" for run'],
    [["run", "--runs"], "--runs needs a value"],
    [["run", "--runs", "0"], "--runs must be a whole number of at least 1"],
    [["run", "--runs", "2.5"], "--runs must be a whole number of at least 1"],
    [["run", "--max-turns", "x"], "--max-turns must be a whole number of at least 1"],
    [["run", "--timeout", "0"], "--timeout must be a whole number of at least 1"],
    [["run", "--session", "real"], "--session must be one of e1, stub"],
    [["run", "--cases", "S1,S9"], "--cases must name cases among S1, S6"],
    [["run", "--cases", "S1,"], "--cases must name cases among S1, S6"],
    [["run", "--cases", ""], "--cases needs a value"],
    [["run", "--arms", "html"], "--arms must name arms among askboard, auq, baseline"],
    [["run", "--effort", "huge"], "--effort must be one of low, medium, high, xhigh, max"],
    [["run", "--cache-ttl", "2h"], "--cache-ttl must be one of 5m, 1h"],
    [
      ["run", "--tool-search", "maybe"],
      "--tool-search must be true, false, auto or auto:<percent>",
    ],
    [["run", "--claude-version", "latest"], "--claude-version must be a version such as 2.1.314"],
    [["run", "--auq-permission-host", "yes"], "--auq-permission-host must be one of on, off"],
    [["run", "--model", ""], "--model needs a value"],
    [["run", "--keep-projects=no"], "--keep-projects takes no value"],
    [["run", "extra"], 'run takes no argument, got "extra"'],
    [["smoke", "--runs", "2"], 'unknown option "--runs" for smoke'],
    [["report"], "report needs one run folder"],
    [["report", "a", "b"], "report needs one run folder"],
    [
      ["run", "--cases", "S6", "--arms", "auq"],
      "no case runs in the arms chosen: S6 runs in askboard",
    ],
  ])("%p is refused: %s", (argv, message) => {
    expect(() => parseCommand(argv)).toThrow(new UsageError(message));
  });
});
