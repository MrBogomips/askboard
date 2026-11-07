// The skill generator (askboard-skills, design decisions 1, 2 and 6; skills spec: the shipped
// skill, routing, asking-rule texts, cheap asks, delivery and follow-ups, when an ask cannot go on,
// answers and Snapshots).

import { describe, expect, test } from "bun:test";
import {
  ASKING_RULE_TEXTS,
  ASKING_RULES,
  ID_PATTERN,
  SNAPSHOT_DATA_ELEMENT,
  SNAPSHOT_FOLDER,
  WIDGET_TYPES,
} from "@askboard/contract";
import { PROBE_WIDGET } from "@askboard/contract/fixtures";
import { MOLECULE_SKILLS, READY_MOLECULES } from "@askboard/molecules";
import { taggedBlocks } from "./blocks.ts";
import { generateSkill, TEMPLATES } from "./generate.ts";
import { contextTypes } from "./references.ts";

const { files, examples } = generateSkill();
const skill = files.get("SKILL.md") ?? "";
const answers = files.get("references/answers.md") ?? "";

const frontmatter = (text: string): Record<string, string> => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match === null) throw new Error("no frontmatter");
  return Object.fromEntries(
    (match[1] ?? "").split("\n").map((line) => {
      const at = line.indexOf(": ");
      return [line.slice(0, at), line.slice(at + 2)];
    }),
  );
};

describe("the generated files", () => {
  test("are SKILL.md, the answers, the context items, each widget and each molecule", () => {
    expect([...files.keys()]).toEqual([
      "SKILL.md",
      "references/answers.md",
      "references/context.md",
      ...WIDGET_TYPES.map(({ type }) => `references/widgets/${type}.md`),
      ...READY_MOLECULES.map(({ molecule }) => `references/molecules/${molecule}.md`),
    ]);
  });

  test("end in one newline, use LF, and carry no absolute path", () => {
    for (const [name, text] of files) {
      expect(text.endsWith("\n"), name).toBe(true);
      expect(text.endsWith("\n\n"), name).toBe(false);
      expect(text, name).not.toContain("\r");
      expect(text, name).not.toMatch(/\/Users\/|\/home\/|[A-Z]:\\/);
    }
  });

  test("two runs give the same bytes", () => {
    const again = generateSkill();
    expect([...again.files]).toEqual([...files]);
    expect(again.examples).toEqual(examples);
  });

  test("name no AI tool or vendor", () => {
    for (const [name, text] of files)
      expect(text, name).not.toMatch(/claude|anthropic|co-authored/i);
  });

  test("hold every tagged block as one of the examples, in order", () => {
    const parsed = [...files].flatMap(([file, text]) =>
      taggedBlocks(text).map(({ kind, value }) => ({ file, kind, value })),
    );
    expect(parsed).toEqual([...examples]);
    expect(examples.length).toBeGreaterThanOrEqual(WIDGET_TYPES.length + READY_MOLECULES.length);
  });
});

describe("SKILL.md frontmatter", () => {
  const head = frontmatter(skill);

  test("holds exactly the keys name and description", () => {
    expect(Object.keys(head)).toEqual(["name", "description"]);
    expect(head.name).toBe("askboard");
    expect((head.description ?? "").length).toBeGreaterThan(0);
  });

  test("grants no tool and names no widget", () => {
    expect(skill).not.toContain("allowed-tools");
    for (const { type } of WIDGET_TYPES)
      expect(head.description?.toLowerCase()).not.toContain(type);
  });
});

describe("SKILL.md routing", () => {
  test("sends references, widgets, more than four options and several questions to AskBoard", () => {
    expect(skill).toContain("## Which tool asks");
    expect(skill).toContain("references");
    expect(skill).toContain("a widget");
    expect(skill).toContain("more than four options");
    expect(skill).toContain("several questions");
  });

  test("sends a yes or no and a short choice without references to AskUserQuestion", () => {
    expect(skill).toContain("AskUserQuestion for a yes or no or a short choice without references");
  });

  test("makes a subagent ask every question through AskBoard, and an asking rule override", () => {
    expect(skill).toContain(
      "A subagent cannot use AskUserQuestion: it asks every question through AskBoard",
    );
    expect(skill).toContain("asking rule");
    expect(skill).toContain("overrides");
  });
});

describe("SKILL.md asking rules", () => {
  test("states every rule with the contract's text, in the contract's order", () => {
    let at = -1;
    for (const rule of ASKING_RULES) {
      const line = `- \`${rule}\`: ${ASKING_RULE_TEXTS[rule]}`;
      const found = skill.indexOf(line);
      expect(found, rule).toBeGreaterThan(at);
      at = found;
    }
  });

  test("says that without hooks the rules are advisory and the agent applies the rule itself", () => {
    expect(skill).toContain("Without AskBoard's hooks a rule is only advisory");
    expect(skill).toContain("follow the rule the user set or asked for yourself");
  });

  test("names no tool result as the place a rule is reported", () => {
    const paragraph = skill.split("\n").find((line) => line.startsWith("Without AskBoard's hooks"));
    expect(paragraph).toBeDefined();
    expect(paragraph?.toLowerCase()).not.toContain("result");
  });
});

describe("SKILL.md cheap asks", () => {
  test("teaches one ask for several questions, pointers, molecules, no computing", () => {
    expect(skill).toContain("one `ask`");
    expect(skill).toContain("Point to project files instead of copying them");
    expect(skill).toContain("molecule by name");
    expect(skill).toContain("Never compute totals, estimates, dates or margins");
  });

  test("teaches the ID rules, with the contract's pattern", () => {
    expect(skill).toContain("task slug plus a short random suffix");
    expect(skill).toContain(ID_PATTERN.slice(1, -1));
  });
});

describe("SKILL.md delivery, follow-ups and fallbacks", () => {
  test("teaches delivery and follow-ups", () => {
    for (const statement of [
      "Keep working",
      "Never open the board or answer it yourself",
      "`collect` with the latest cursor",
      "before you finish",
      "whose `seq`",
      "ignore it",
      "Reply to a follow-up at once with `update`",
      "record it with `update`",
    ]) {
      expect(skill, statement).toContain(statement);
    }
  });

  test("teaches both fallbacks, declined and discarded", () => {
    expect(skill).toContain("`unavailable`");
    expect(skill).toContain("main conversation: ask through AskUserQuestion");
    expect(skill).toContain(
      "subagent: end your turn and return the question to the agent that started you",
    );
    expect(skill).toContain("Do not ask a declined question again in this task");
    expect(skill).toContain("A `discarded` ask");
    expect(skill).toContain("under a new ID");
  });
});

describe("SKILL.md ownership of an ask", () => {
  const after = skill.slice(skill.indexOf("## After you ask"));

  test("says what ownership means with the hooks, and that a later answer to a subagent's ask is lost", () => {
    expect(after).toContain("With AskBoard's hooks, an ask belongs to the agent that sent it");
    expect(after).toContain("only that agent can `collect`, `update`, `fetch` or `snapshot` it");
    expect(after).toContain("A subagent's ask closes when the subagent finishes");
    expect(after).toMatch(/answer given later.*is lost, and no one can collect or snapshot it/);
  });

  test("advises asking yourself, a background subagent only for a side dialogue answered together", () => {
    expect(after).toContain("Your own asks never block you");
    expect(after).toContain("side dialogue whose answers you need together when it ends");
    expect(after).toContain("background subagent that asks, waits and returns them");
    expect(after).not.toContain("To talk with the user while you keep working");
  });
});

describe("SKILL.md item index", () => {
  const index = skill.slice(skill.indexOf("## Items"));
  const linked = [...index.matchAll(/\]\((references\/[^)]+)\)/g)].map((match) => match[1] ?? "");

  test("lists the context types, then the registry's types in order, then the molecules", () => {
    const positions = [
      ...contextTypes().map((type) => `\`${type}\``),
      ...WIDGET_TYPES.map(({ noun }) => noun),
      ...READY_MOLECULES.map(({ molecule }) => `\`${molecule}\``),
    ].map((label) => index.indexOf(`- ${label}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("links each to a file the generator writes, and states each one's use", () => {
    expect(linked.length).toBeGreaterThan(0);
    for (const path of linked) expect(files.has(path), path).toBe(true);
    for (const { skill: teaching } of WIDGET_TYPES)
      expect(index).toContain(teaching?.use ?? "unreachable");
    for (const { use } of Object.values(MOLECULE_SKILLS)) expect(index).toContain(use);
  });

  test("links the answers reference from the delivery section", () => {
    expect(skill).toContain("](references/answers.md)");
  });
});

describe("the answers reference", () => {
  test("names a reopening as the undoing of a postpone or a decline", () => {
    expect(answers).toContain("a reopening (the user undid a postpone or a decline)");
  });

  test("says answers carry only what changed and fetch returns a whole item", () => {
    expect(answers).toContain("only what changed");
    expect(answers).toContain("`fetch` returns a whole item");
  });

  test("names the Snapshot folder and data element from the contract", () => {
    expect(answers).toContain(SNAPSHOT_FOLDER);
    expect(answers).toContain(SNAPSHOT_DATA_ELEMENT);
  });

  test("holds one collect result example", () => {
    const results = taggedBlocks(answers).filter(({ kind }) => kind === "result");
    expect(results).toHaveLength(1);
    expect(results[0]?.value).toMatchObject({ asks: [{ events: [{ type: "answer" }] }] });
  });
});

describe("generateSkill's inputs", () => {
  test("fails, naming it, on a registered widget type with no teaching text", () => {
    expect(() => generateSkill({ widgets: [...WIDGET_TYPES, PROBE_WIDGET] })).toThrow(
      'the widget type "probe" has no teaching text',
    );
  });

  test("fails, naming it, on a ready molecule with no teaching data", () => {
    expect(() => generateSkill({ moleculeSkills: {} })).toThrow(
      'the molecule "gantt-plan" has no teaching data',
    );
  });

  test("fails on a slot no value fills, naming it", () => {
    const templates = { ...TEMPLATES, skill: `${TEMPLATES.skill}\n{{nothing}}` };
    expect(() => generateSkill({ templates })).toThrow("{{nothing}}");
  });

  test("fails on a value no template uses, naming it", () => {
    const templates = { ...TEMPLATES, skill: TEMPLATES.skill.replace("{{idPattern}}", "") };
    expect(() => generateSkill({ templates })).toThrow("idPattern");
  });

  test("a widget added to the registry adds its reference and an item index line", () => {
    const extra = { ...PROBE_WIDGET, skill: { use: "a pick among options" } };
    const more = generateSkill({ widgets: [...WIDGET_TYPES, extra] });
    expect(more.files.has("references/widgets/probe.md")).toBe(true);
    expect(more.files.get("SKILL.md")).toContain("a Probe: a pick among options");
  });
});
