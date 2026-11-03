import { describe, expect, test } from "bun:test";
import { everyKeyConfiguration } from "../src/fixtures/index.ts";
import {
  CONFIGURATION_DEFAULTS,
  CONFIGURATION_KEYS,
  CONFIGURATION_VERSION,
  configurationSet,
  PRESENTATION_KEYS,
  SCHEMA_IDS,
  SCHEMA_SET_OWNERS,
  SCHEMA_SETS,
} from "../src/index.ts";
import {
  configurationProblem,
  type Problem,
  schemaSetProblems,
  validateConfiguration,
} from "../src/validate.ts";

// The configuration schema set (settings-languages design decision 2; contract spec, "The
// configuration schema set", "The editor key is an argument vector", "The presentation keys are a
// closed list"). One schema for both files; a file names its version, every known key is optional
// and closed, and an unknown key passes for the reader to warn on (B2).

const file = (fields: Record<string, unknown>) => ({ version: "1.0", ...fields });

const problemsOf = (value: unknown): readonly Problem[] => {
  const checked = validateConfiguration(value);
  return checked.ok ? [] : checked.problems;
};

describe("the configuration schema", () => {
  test("a file with every key validates", () => {
    expect(Object.keys(everyKeyConfiguration)).toEqual(["version", ...CONFIGURATION_KEYS]);
    expect(validateConfiguration(everyKeyConfiguration)).toEqual({
      ok: true,
      value: everyKeyConfiguration,
    });
  });

  test("a file with no key but its version validates", () => {
    expect(validateConfiguration(file({})).ok).toBe(true);
  });

  test.each([
    ["theme", "sepia"],
    ["theme", "Dark"],
    ["density", "cozy"],
    ["contextPlacement", "below"],
    ["defaultLanguage", "fr-FR"],
    ["defaultLanguage", "it"],
    ["askingRule", "sometimes"],
    ["snapshotFolder", 12],
    ["snapshotFolder", "s".repeat(1_025)],
    ["defaultMinimumMargin", 101],
    ["defaultMinimumMargin", -1],
    ["defaultMinimumMargin", "18"],
  ])("%s set to %p fails, naming the key", (key, value) => {
    const problems = problemsOf(file({ [key]: value }));
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) expect(problem.path).toBe(`/${key}`);
  });

  test("each key accepts every value of its set", () => {
    const values: Record<string, readonly unknown[]> = {
      theme: ["system", "light", "dark"],
      density: ["compact", "comfortable"],
      contextPlacement: ["beside", "inline"],
      defaultLanguage: ["en-US", "it-IT"],
      askingRule: ["none", "always", "with-references"],
      snapshotFolder: ["docs/snapshots", "", "s".repeat(1_024)],
      defaultMinimumMargin: [0, 18.5, 100],
    };
    for (const [key, accepted] of Object.entries(values)) {
      for (const value of accepted) {
        expect({ key, value, problems: problemsOf(file({ [key]: value })) }).toEqual({
          key,
          value,
          problems: [],
        });
      }
    }
  });

  test("a file without its version fails, naming version", () => {
    const checked = validateConfiguration({ theme: "dark" });
    expect(checked).toMatchObject({ ok: false, reason: "version" });
    expect(problemsOf({ theme: "dark" }).map((problem) => problem.path)).toEqual(["/version"]);
  });

  test("a file of another major fails as a version problem, and a newer minor of 1 passes", () => {
    expect(validateConfiguration(file({ version: "2.0" }))).toMatchObject({
      ok: false,
      reason: "version",
      problems: [{ path: "/version", message: expect.stringContaining("2.0") }],
    });
    expect(validateConfiguration(file({ version: "1.7", theme: "dark" })).ok).toBe(true);
  });

  test("a file that is not an object fails", () => {
    for (const value of [null, [], "1.0", 1]) expect(validateConfiguration(value).ok).toBe(false);
  });

  test("an unknown key passes the schema and is outside the configuration keys", () => {
    expect(validateConfiguration(file({ fontSize: 14, theme: "dark" })).ok).toBe(true);
    expect(CONFIGURATION_KEYS).not.toContain("fontSize" as never);
  });
});

describe("the editor key is an argument vector", () => {
  test("an argument vector with the two placeholders validates", () => {
    expect(problemsOf(file({ editor: ["code", "--goto", "{file}:{line}"] }))).toEqual([]);
  });

  test("32 strings of 1,024 characters validate", () => {
    expect(problemsOf(file({ editor: Array(32).fill("e".repeat(1_024)) }))).toEqual([]);
  });

  test.each([
    ["a command line as one string", "code --goto {file}:{line}"],
    ["an empty list", []],
    ["a list holding a number", ["code", 12]],
    ["a list holding an empty string", ["code", ""]],
    ["33 strings", Array(33).fill("code")],
    ["a string of 1,025 characters", ["code", "e".repeat(1_025)]],
    ["an object", { program: "code" }],
  ])("%s fails, naming editor", (_, editor) => {
    const problems = problemsOf(file({ editor }));
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) expect(problem.path).toStartWith("/editor");
  });
});

describe("the keys", () => {
  test("the presentation keys are exactly theme, density and contextPlacement", () => {
    expect(PRESENTATION_KEYS).toEqual(["theme", "density", "contextPlacement"]);
  });

  test("the configuration keys are AD-14's eight, the presentation keys first", () => {
    expect(CONFIGURATION_KEYS).toEqual([
      "theme",
      "density",
      "contextPlacement",
      "defaultLanguage",
      "askingRule",
      "snapshotFolder",
      "editor",
      "defaultMinimumMargin",
    ]);
  });

  test("the schema defines exactly version and the configuration keys", () => {
    const [schema] = configurationSet.schemas as [{ properties: object; required: string[] }];
    expect(Object.keys(schema.properties)).toEqual(["version", ...CONFIGURATION_KEYS]);
    expect(schema.required).toEqual(["version"]);
  });

  test("the defaults: system, compact, beside, en-US, none, the Snapshot folder, no editor", () => {
    expect(CONFIGURATION_DEFAULTS).toEqual({
      theme: "system",
      density: "compact",
      contextPlacement: "beside",
      defaultLanguage: "en-US",
      askingRule: "none",
      snapshotFolder: ".askboard/snapshots",
    });
    expect(problemsOf(file(CONFIGURATION_DEFAULTS))).toEqual([]);
  });
});

describe("the set", () => {
  test("is owned by ask-core, at 1.0, and passes the schema checks", () => {
    expect(configurationSet).toMatchObject({
      name: "configuration",
      owner: "ask-core",
      version: "1.0",
    });
    expect(CONFIGURATION_VERSION).toBe("1.0");
    expect(SCHEMA_SET_OWNERS[configurationSet.name]).toBe(configurationSet.owner);
    expect(schemaSetProblems([configurationSet])).toEqual([]);
  });

  test("joins the schema sets, with its ID by name", () => {
    expect(SCHEMA_SETS).toContain(configurationSet);
    expect(SCHEMA_IDS.configuration).toBe("urn:askboard:configuration:config");
    const [schema] = configurationSet.schemas as [{ $id: string }];
    expect(schema.$id).toBe(SCHEMA_IDS.configuration);
  });
});

// settings-languages task 3.2: why a file is not applied, for ask-core's diagnostic and the panel.
describe("configurationProblem", () => {
  test("a file that passes has none", () => {
    expect(configurationProblem({ version: "1.0", theme: "dark", fontSize: 14 })).toBeUndefined();
  });

  test("a major other than 1 names the version", () => {
    expect(configurationProblem({ version: "2.0", theme: "dark" })).toEqual({
      code: "version",
      pointer: "/version",
    });
  });

  test("a schema failure names its first JSON pointer and Ajv's keyword", () => {
    expect(configurationProblem({ version: "1.0", askingRule: "always", theme: "sepia" })).toEqual({
      code: "schema",
      pointer: "/theme",
      keyword: "enum",
    });
    expect(configurationProblem({ version: "1.0", editor: ["code", 7] })).toEqual({
      code: "schema",
      pointer: "/editor/1",
      keyword: "type",
    });
  });
});
