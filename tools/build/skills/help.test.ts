// The help skill generator (keyboard-shortcuts-help, design decisions 10 and 20; skills spec: the
// help skill, its references one level deep, the key configuration, the user file only).

import { describe, expect, test } from "bun:test";
import {
  CONFIGURATION_VERSION,
  KEY_VOCABULARY,
  keyOverridesProblems,
  parseKeyCombination,
  TOOL_DEFINITIONS,
  WIDGET_TYPES,
} from "@askboard/contract";
import { PROBE_WIDGET } from "@askboard/contract/fixtures";
import { MOLECULE_SKILLS, READY_MOLECULES } from "@askboard/molecules";
import { budgetReport, HELP_SKILL, parseFrontmatter } from "./budgets.ts";
import { generateHelpSkill, SESSION_TOOL_PREFIX } from "./help.ts";
import { KEY_EXAMPLES } from "./help-keys.ts";
import { actionRows, PANEL_NOTE } from "./keys.ts";

const help = generateHelpSkill();
const file = (path: string): string => {
  const text = help.files.get(path);
  if (text === undefined) throw new Error(`no file ${path}`);
  return text;
};
const skill = file("SKILL.md");

describe("the files", () => {
  test("are SKILL.md, a reference per type and per ready molecule, and the two key references", () => {
    expect([...help.files.keys()].sort()).toEqual(
      [
        "SKILL.md",
        ...WIDGET_TYPES.map(({ type }) => `references/widgets/${type}.md`),
        ...READY_MOLECULES.map(({ molecule }) => `references/molecules/${molecule}.md`),
        "references/configure-keys.md",
        "references/key-actions.md",
      ].sort(),
    );
  });

  test("are generated the same twice", () => {
    expect([...generateHelpSkill().files]).toEqual([...help.files]);
  });

  test("each type's reference holds its mouse and answer help texts", () => {
    for (const { type, help: text } of WIDGET_TYPES) {
      const reference = file(`references/widgets/${type}.md`);
      expect(reference).toContain(text?.mouse ?? "unreachable");
      expect(reference).toContain(text?.answer ?? "unreachable");
    }
  });

  test("a type with a table holds its Keys section, one without says it has none of its own", () => {
    expect(file("references/widgets/ranking.md")).toContain(
      "| Keep this order | list | Enter (↩) |",
    );
    expect(file("references/widgets/ranking.md")).toContain(
      "shows no keys panel for the Ranking yet",
    );
    expect(file("references/widgets/approval.md")).not.toContain("## Keys");
    expect(file("references/widgets/approval.md")).toContain("no keys of its own");
  });

  test("the Gantt plan's reference holds the molecule's help and names its type, unlinked", () => {
    const reference = file("references/molecules/gantt-plan.md");
    expect(reference).toContain(MOLECULE_SKILLS["gantt-plan"]?.help ?? "unreachable");
    expect(reference).toContain("`gantt`");
    expect(reference).not.toContain("](");
  });

  test("a molecule's reference names every type its definition expands into", () => {
    expect(file("references/molecules/wbs-pert.md")).toContain("`tree`");
  });
});

describe("one level deep", () => {
  const LINK = /\]\(([^)]+)\)/g;
  const targets = (text: string) => [...text.matchAll(LINK)].map((match) => match[1] as string);

  test("SKILL.md links every other file, and only files of the skill", () => {
    const linked = [...new Set(targets(skill))].sort();
    expect(linked).toEqual([...help.files.keys()].filter((path) => path !== "SKILL.md").sort());
  });

  test("no other file links a file of the skill", () => {
    for (const [path, text] of help.files) {
      if (path !== "SKILL.md") expect(targets(text)).toEqual([]);
    }
  });
});

describe("SKILL.md", () => {
  test("has the frontmatter: name, a description within 400 characters, and the five tools disallowed", () => {
    const head = parseFrontmatter(skill) ?? [];
    expect(head.map(([key]) => key)).toEqual(["name", "description", "disallowed-tools"]);
    const value = (key: string) => head.find(([name]) => name === key)?.[1] ?? "";
    expect(value("name")).toBe("askboard-help");
    expect(value("description").length).toBeLessThanOrEqual(400);
    expect(value("disallowed-tools").split(" ")).toEqual(
      TOOL_DEFINITIONS.map(({ name }) => `${SESSION_TOOL_PREFIX}${name}`),
    );
    expect(value("disallowed-tools")).toContain("mcp__plugin_askboard_askboard__ask");
    expect(skill).not.toMatch(/^allowed-tools:/m);
  });

  test("tells the agent to answer in the user's language and the terminal, and never to use the tools", () => {
    expect(skill).toContain("user's language");
    expect(skill).toContain("in the terminal");
    for (const tool of ["ask", "update", "collect", "fetch", "snapshot"]) {
      expect(skill).toContain(`\`${tool}\``);
    }
    expect(skill).toContain("Never call AskBoard's tools");
    expect(skill).toContain("never open a board");
  });

  test("explains the concepts the spec names", () => {
    for (const concept of [
      "Answer",
      "Submit",
      "Postpone",
      "Decline",
      "Explain",
      "Follow-up",
      "Keep mine",
      "Reload",
      "Read-only",
      "Snapshot",
      "Language and live updates",
    ]) {
      expect(skill).toContain(concept);
    }
  });

  test("teaches the standard keys: the options' manual activation and the date field's calendar", () => {
    expect(skill).toContain("radio group");
    expect(skill).toContain("without choosing");
    expect(skill).toContain("react-day-picker");
    expect(skill).toContain("Page Up and Page Down");
    expect(skill).toContain("Home and End");
  });

  test("sends key changes to the user file, on the user's request, never to the project file", () => {
    expect(skill).toContain("user configuration file only when the user asks you to");
    expect(skill).toContain("keeping its `version` and every other key");
    expect(skill).toContain("Never write `keys` into the project file");
  });

  test("holds no leftover slot", () => {
    expect(skill).not.toContain("{{");
  });
});

describe("no example and no call", () => {
  test("no file holds a tagged block, an ask, an item or a tool call", () => {
    for (const text of help.files.values()) {
      expect(text).not.toMatch(/```json (ask|item|result|update)/);
      expect(text).not.toContain("askId");
      expect(text).not.toContain('"type": "question"');
    }
    // The frontmatter is the one place the tool names appear.
    for (const [path, text] of help.files) {
      expect(text.includes("mcp__plugin")).toBe(path === "SKILL.md");
    }
  });
});

describe("key-actions.md", () => {
  const text = file("references/key-actions.md");

  test("lists every vocabulary action and every own action a table binds, with both forms of its keys", () => {
    for (const row of actionRows(WIDGET_TYPES)) {
      const line = text
        .split("\n")
        .find((candidate) => candidate.startsWith(`- \`${row.action}\`:`));
      expect(line).toBeDefined();
      expect(line).toMatch(/\(.+\)/);
    }
    for (const action of Object.keys(KEY_VOCABULARY)) expect(text).toContain(`\`${action}\``);
    expect(text).toContain("`ranking.keep`: Keep this order, Enter (↩)");
    expect(text).toContain("`move.top`: To top, Alt+Shift+Home and Ctrl+Shift+↑ (⌥⇧Home and ⇧⌘↑)");
  });

  test("marks the actions that cannot be changed", () => {
    expect(text).toContain("`gantt.criticalPath`");
    expect(text).toMatch(/gantt\.criticalPath.*not changeable/);
  });
});

describe("the keys panel in the help skill", () => {
  const on = generateHelpSkill({ keyTablesOnBoard: ["ranking"] });
  const at = (skillFiles: typeof help, path: string) => skillFiles.files.get(path) ?? "";

  test("a listed type's reference holds the panel sentence, an unlisted one's says there is none yet", () => {
    expect(at(on, "references/widgets/ranking.md")).toContain(PANEL_NOTE);
    expect(at(on, "references/widgets/gantt.md")).toContain(
      "shows no keys panel for the Gantt yet",
    );
    expect(at(on, "references/widgets/gantt.md")).not.toContain("Keys button");
  });

  test("configure-keys.md names the listed types as the only ones the user's keys reach", () => {
    const text = at(on, "references/configure-keys.md");
    expect(text).toContain("only in the Ranking");
    expect(text).not.toContain("every widget that has the action");
    expect(text).toContain("the Keys button");
  });

  test("with an empty list, configure-keys.md says no widget takes the user's keys yet and claims no panel", () => {
    const text = file("references/configure-keys.md");
    expect(text).toContain("no widget takes them yet");
    expect(text).not.toContain("every widget that has the action");
    expect(text).not.toMatch(/Keys button|keys panel shows/);
  });

  test("several listed types are named in order", () => {
    const two = generateHelpSkill({ keyTablesOnBoard: ["ranking", "gantt"] });
    expect(at(two, "references/configure-keys.md")).toContain("only in the Ranking and the Gantt");
  });

  test("SKILL.md words the panel for a widget with a Keys button", () => {
    expect(skill).toContain("A widget with a Keys button");
    expect(skill).not.toContain(
      "A widget with keys of its own lists them in its reference below, and the board's keys panel",
    );
  });
});

describe("configure-keys.md", () => {
  const text = file("references/configure-keys.md");

  test("says where the user file is and keeps the project file out", () => {
    expect(text).toContain("~/.config/askboard/config.json");
    expect(text).toContain("$XDG_CONFIG_HOME/askboard/config.json");
    expect(text).toContain(CONFIGURATION_VERSION);
    expect(text).toContain("`.askboard/config.json` ignores `keys`");
    expect(text).toContain("Never put `keys` there");
    expect(text).toContain("only when the user asks you to");
  });

  test("states the notation, the rules, a refused file, and when a change applies", () => {
    for (const part of [
      "`Mod`",
      "`Space`",
      "Mod+Alt",
      "`Mod+Alt` takes only",
      "`Tab`",
      "share a key",
      "`edit.cancel`",
      "refuses the whole `keys`",
      "stderr",
      "next board opened",
    ])
      expect(text).toContain(part);
  });

  test("every example passes the notation and the overrides check", () => {
    expect(KEY_EXAMPLES.length).toBeGreaterThanOrEqual(2);
    for (const { overrides } of KEY_EXAMPLES) {
      expect(keyOverridesProblems(overrides)).toEqual([]);
      for (const combination of Object.values(overrides).flat()) {
        expect(parseKeyCombination(combination).ok).toBe(true);
      }
    }
    for (const { title } of KEY_EXAMPLES) expect(text).toContain(title);
    expect(text).toContain('"move.top": [');
    expect(text).toContain("Mod+Alt+ArrowUp");
  });

  test("an example the check refuses fails the generator, naming it and the problem", () => {
    const bad = [{ title: "Teleport", overrides: { "ranking.teleport": ["Mod+w"] } }];
    expect(() => generateHelpSkill({ keyExamples: bad })).toThrow(/"Teleport".*ranking\.teleport/);
    const clash = [{ title: "Clash", overrides: { "move.top": ["Mod+w"], undo: ["Ctrl+z"] } }];
    expect(() => generateHelpSkill({ keyExamples: clash })).toThrow(/"Clash"/);
    expect(() => generateHelpSkill({ keyExamples: clash })).toThrow(/Ctrl\+z/);
  });
});

describe("gaps in the teaching", () => {
  test("a type without help text fails, naming it", () => {
    const { help: _help, ...bare } = { ...PROBE_WIDGET, skill: { use: "a pick among options" } };
    expect(() => generateHelpSkill({ widgets: [...WIDGET_TYPES, bare] })).toThrow(/"probe".*help/);
  });

  test("a molecule without help text fails, naming it", () => {
    const { help: _help, ...bare } = MOLECULE_SKILLS["wbs-pert"] as never as { help: string };
    expect(() =>
      generateHelpSkill({ moleculeSkills: { ...MOLECULE_SKILLS, "wbs-pert": bare as never } }),
    ).toThrow(/"wbs-pert".*help/);
  });

  test("a template slot no value fills, and a value no template uses, fail", () => {
    const templates = { skill: "", answers: "", updates: "", help: "{{nothing}}" };
    expect(() => generateHelpSkill({ templates })).toThrow(/nothing/);
    expect(() => generateHelpSkill({ templates: { ...templates, help: "plain" } })).toThrow(
      /no template uses/,
    );
  });

  test("a molecule that expands into no registered widget says so", () => {
    const only = generateHelpSkill({ widgets: WIDGET_TYPES.filter(({ type }) => type === "tree") });
    expect(only.files.get("references/molecules/gantt-plan.md")).toContain("no widget of its own");
  });
});

describe("the shipped help skill", () => {
  test("passes the help budgets, each reference within 4,000 characters", () => {
    const report = budgetReport(help.files, undefined, "askboard-help", HELP_SKILL, false);
    expect(report.problems).toEqual([]);
    for (const [path, text] of help.files) {
      if (path !== "SKILL.md") expect(text.length).toBeLessThanOrEqual(4000);
    }
  });
});
