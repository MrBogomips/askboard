// The help skill generator (keyboard-shortcuts-help, design decisions 10 and 20; skills spec: the
// help skill, its references one level deep, the key configuration, the user file only).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIGURATION_VERSION,
  KEY_VOCABULARY,
  KEYS_OPEN_RESERVED_KEYS,
  keyBinding,
  keyExitActions,
  keyOverridesProblems,
  ownEntry,
  parseKeyCombination,
  SETTING_ROW_WARNINGS_MAX,
  TOOL_DEFINITIONS,
  WIDGET_TYPES,
} from "@askboard/contract";
import { PROBE_WIDGET } from "@askboard/contract/fixtures";
import { MOLECULE_SKILLS, READY_MOLECULES } from "@askboard/molecules";
import { budgetReport, HELP_SKILL, parseFrontmatter } from "./budgets.ts";
import { contractSchemaResolver } from "./fields.ts";
import { generateHelpSkill, SESSION_TOOL_PREFIX } from "./help.ts";
import { KEY_EXAMPLES, rowWarningsBound } from "./help-keys.ts";
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

  // The options' and fields' keys, one bullet each (review 5.6, S-32 and the verdicts).
  const bullet = (start: string): string => {
    const found = skill.split("\n").find((line) => line.startsWith(`- ${start}`));
    if (found === undefined) throw new Error(`no bullet for ${start}`);
    return found;
  };

  test("the single choice's line names Enter beside Space", () => {
    expect(bullet("A single choice")).toMatch(/Space or Enter chooses/);
  });

  test("the question's multiple choice names the arrows, Home and End moving the focus and Space or Enter ticking", () => {
    const line = bullet("A multiple choice");
    expect(line).toMatch(/Arrow keys, Home and End move the focus/);
    expect(line).toMatch(/Space or Enter ticks/);
  });

  test("the multiple pick field has one Tab stop per box and Space, and no line says arrows move among its boxes", () => {
    const line = bullet("A multiple pick field");
    expect(line).toContain("one Tab stop per box");
    expect(line).toContain("Space");
    expect(line).not.toMatch(/arrow/i);
    for (const other of skill.split("\n")) {
      if (/pick field/i.test(other)) expect(other).not.toMatch(/arrow keys move/i);
    }
  });

  test("the calendar names Shift with the arrows: a month sideways, a year up and down", () => {
    const line = bullet("The date field's calendar");
    expect(line).toContain("Shift with ← and → by a month");
    expect(line).toContain("Shift with ↑ and ↓ by a year");
  });

  test("the toggle takes Space and Enter, the check box Space only", () => {
    const line = bullet("A toggle");
    expect(line).toMatch(/toggle: Space or Enter/);
    expect(line).toMatch(/check box: Space only/);
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

// The prefix is Claude Code's name for a plugin's tool (probe, task 0.4): `mcp__plugin_<plugin>_<server>__`,
// so it is tied to the manifest the plugin ships (review 5.6, X-5): a rename of the plugin or its
// server fails here, instead of leaving `disallowed-tools` naming tools that do not exist.
describe("the session's tool prefix", () => {
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dir, "../../../.claude-plugin/plugin.json"), "utf8"),
  ) as { name: string; mcpServers: Record<string, unknown> };

  test("is mcp__plugin_<name>_<server>__ from the manifest's name and its one MCP server", () => {
    const servers = Object.keys(manifest.mcpServers);
    expect(servers).toHaveLength(1);
    expect(SESSION_TOOL_PREFIX).toBe(`mcp__plugin_${manifest.name}_${servers[0]}__`);
  });

  test("disallowed-tools holds the five tool names of TOOL_DEFINITIONS with that prefix and nothing else", () => {
    const [, , disallowed] = parseFrontmatter(skill) ?? [];
    const names = (disallowed?.[1] ?? "").split(" ");
    const servers = Object.keys(manifest.mcpServers);
    expect(names).toHaveLength(5);
    expect([...names].sort()).toEqual(
      TOOL_DEFINITIONS.map(
        ({ name }) => `mcp__plugin_${manifest.name}_${servers[0]}__${name}`,
      ).sort(),
    );
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

// The rules configure-keys.md states, read from the contract where it holds the list (review 5.6,
// S-35 and S-36; design decision 20).
describe("configure-keys.md's rules", () => {
  const text = file("references/configure-keys.md");
  const lineWith = (part: string, from = text): string => {
    const found = from.split("\n").find((line) => line.includes(part));
    if (found === undefined) throw new Error(`no line with ${part}`);
    return found;
  };
  const names = (line: string) => [...line.matchAll(/`([a-z]+\.[A-Za-z.]+)`/g)].map((m) => m[1]);
  const escapeProbe = {
    ...PROBE_WIDGET,
    skill: { use: "a pick among options" },
    help: { mouse: "Pick one.", answer: "The option." },
    keys: [
      ownEntry("probe.leave", "panel", [keyBinding("Escape")], "tool", {
        readOnly: false,
        label: "keys.action.undo",
      }),
    ],
  };

  test("the exits sentence lists exactly keyExitActions()", () => {
    expect(names(lineWith("cannot be left with no key")).sort()).toEqual([...keyExitActions()]);
  });

  test("an exit added to a probe type changes the sentence, with no edit to the generator", () => {
    const widgets = [...WIDGET_TYPES, escapeProbe as never];
    const probed = generateHelpSkill({ widgets }).files.get("references/configure-keys.md") ?? "";
    expect(names(lineWith("cannot be left with no key", probed)).sort()).toEqual([
      ...keyExitActions(widgets),
    ]);
    expect(probed).toContain("`probe.leave`");
  });

  test("the refusals hold Alt+Shift with a letter or Space, an editor's typing keys and keys.open's reserved keys", () => {
    expect(lineWith("`Alt+Shift` with a letter")).toContain("`Space`");
    const typing = lineWith("types a character");
    expect(typing).toMatch(/editor/);
    expect(typing).toMatch(/letter|`Space`/);
    const open = lineWith("`keys.open`");
    for (const key of KEYS_OPEN_RESERVED_KEYS) {
      expect(open).toContain(`\`${key === " " ? "Space" : key}\``);
    }
    expect(open).toMatch(/no modifier or Shift/);
    expect(lineWith("another action")).toMatch(/takes/);
  });

  test("lists the problems Settings shows, up to the row's bound read from the board protocol schema", () => {
    const schema = contractSchemaResolver()("urn:askboard:board-protocol:settings") as {
      $defs: { row: { properties: { warnings: { maxItems: number } } } };
    };
    const bound = schema.$defs.row.properties.warnings.maxItems;
    expect(rowWarningsBound()).toBe(bound);
    expect(bound).toBe(SETTING_ROW_WARNINGS_MAX);
    const line = lineWith("refuses the whole `keys`");
    expect(line).toContain(`up to ${bound}`);
    expect(line).not.toContain("each problem");
    const three = generateHelpSkill({ keyRowBound: 3 }).files.get("references/configure-keys.md");
    expect(three).toContain("up to 3");
    expect(() => rowWarningsBound(() => undefined)).toThrow(/settings/);
    expect(() => rowWarningsBound(() => ({ $defs: { row: {} } }))).toThrow(/maxItems/);
  });

  test("stderr lists the problems found at the session's first read, Settings those found when a board opens (S-45)", () => {
    const line = lineWith("refuses the whole `keys`");
    expect(line).toMatch(/stderr lists the problems found at its first read/);
    expect(line).toMatch(/Settings[^.]*when a board opens/);
    expect(line).toContain(`up to ${SETTING_ROW_WARNINGS_MAX}`);
    // No line says stderr lists them without naming the first read.
    const saying = text.split("\n").filter((each) => /stderr/.test(each));
    expect(saying.length).toBeGreaterThan(0);
    for (const each of saying) expect(each).toContain("first read");
    expect(text).not.toMatch(/and the session's stderr lists them/);
  });

  test("every example's title counts its combinations rightly, and none is another action's default", () => {
    const words = ["One", "Two", "Three", "Four"];
    const rows = actionRows(WIDGET_TYPES);
    for (const { title, overrides } of KEY_EXAMPLES) {
      const count = words.findIndex((word) => title.startsWith(`${word} combination`)) + 1;
      if (count > 0) {
        for (const combinations of Object.values(overrides))
          expect(combinations).toHaveLength(count);
      }
      for (const [action, combinations] of Object.entries(overrides)) {
        for (const combination of combinations) {
          const read = parseKeyCombination(combination);
          if (!read.ok) throw new Error(read.reason);
          for (const row of rows.filter((other) => other.action !== action)) {
            const same = row.keys.some(
              ({ key, hold }) => key === read.binding.key && hold === read.binding.hold,
            );
            expect(same, `${combination} is ${row.action}'s default`).toBe(false);
          }
        }
      }
    }
    const two = KEY_EXAMPLES.find(({ title }) => title.startsWith("Two combinations"));
    expect(Object.values(two?.overrides ?? {}).flat()).toHaveLength(2);
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
