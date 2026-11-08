// The skill generator (askboard-skills, design decisions 1, 2 and 6; skills spec: the shipped
// skill, routing, asking-rule texts, cheap asks, delivery and follow-ups, when an ask cannot go on,
// answers and Snapshots).

import { describe, expect, test } from "bun:test";
import {
  ASKING_RULE_TEXTS,
  ASKING_RULES,
  ID_PATTERN,
  NON_WIDGET_ITEM_TYPES,
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
      "references/updates.md",
      "references/items.md",
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

  // The language section names the project's instructions files, CLAUDE.md and AGENTS.md (the
  // skills spec, "The ask's language taught"): a file name the agent reads, not an AI named as
  // author, so that one name is set aside before the check.
  test("name no AI tool or vendor", () => {
    for (const [name, text] of files)
      expect(text.replaceAll("CLAUDE.md", ""), name).not.toMatch(/claude|anthropic|co-authored/i);
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
      "keep working while the user answers",
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
  const start = skill.indexOf("## After you ask");
  const next = skill.indexOf("\n## ", start + 1);
  const after = skill.slice(start, next === -1 ? undefined : next);

  test("says what ownership means with the hooks, and that a later answer to a subagent's ask is lost", () => {
    expect(after).toContain("With AskBoard's hooks, an ask belongs to the agent that sent it");
    expect(after).toContain("only that agent can `collect`, `update`, `fetch` or `snapshot` it");
    expect(after).toContain("A subagent's ask closes when the subagent finishes");
    expect(after).toMatch(/answer given later.*is lost, and no one can collect or snapshot it/);
  });

  test("advises asking from the agent that needs the answers, never through a subagent", () => {
    expect(after).toContain("Ask from the agent that needs the answers");
    expect(after).toContain("Your own asks never block you");
    expect(after).toContain("keep working while the user answers");
    expect(after).toContain("Never hand your questions to a subagent to ask for you");
    expect(after).toContain("its ask closes when it finishes, and later answers are lost");
    expect(after).not.toContain("To talk with the user while you keep working");
  });

  test("no generated file offers a subagent that asks on another agent's behalf", () => {
    for (const [name, text] of files)
      for (const phrase of ["background subagent", "side dialogue", "asks, waits and returns"])
        expect(text.toLowerCase(), `${name}: ${phrase}`).not.toContain(phrase);
  });
});

describe("the shipped widget references (skills spec: The skill names the three)", () => {
  const typed = WIDGET_TYPES.filter((entry) => entry.result !== undefined);

  test("every type with a result lists the result's fields under the answer's `results`", () => {
    expect(typed.map(({ type }) => type)).toEqual(
      expect.arrayContaining(["approval", "scale", "ranking"]),
    );
    for (const entry of typed) {
      const text = files.get(`references/widgets/${entry.type}.md`) ?? "";
      const section = text.slice(text.indexOf("## In the answer"), text.indexOf("## Example"));
      expect(section, entry.type).toContain("`results`");
      const schema = entry.result?.schema as { properties?: Record<string, unknown> } | undefined;
      const properties = Object.keys(schema?.properties ?? {});
      // A result that is a bare value (the atoms': a text, a number, a date, a boolean) has no
      // fields: the section says what it is, and never promises "an object with:" and lists none.
      if (properties.length === 0) expect(section, entry.type).not.toContain("an object with");
      else expect(section, entry.type).toContain("an object with");
      for (const property of properties) expect(section, entry.type).toContain(`- \`${property}\``);
    }
  });

  test("a reference whose props have no fields of their own has no empty Fields section", () => {
    for (const entry of WIDGET_TYPES) {
      const text = files.get(`references/widgets/${entry.type}.md`) ?? "";
      expect(text, entry.type).not.toMatch(/## Fields\n\n\n/);
    }
    expect(files.get("references/widgets/approval.md")).not.toContain("## Fields");
    expect(files.get("references/widgets/scale.md")).toContain("## Fields");
  });

  test("the Scale's reference teaches that `step` is above 0", () => {
    expect(files.get("references/widgets/scale.md")).toContain("- `step` (number, above 0");
  });
});

describe("the item index", () => {
  const catalogue = files.get("references/items.md") ?? "";
  const index = skill.slice(skill.indexOf("## Items"));
  const linked = [...index.matchAll(/\]\((references\/[^)]+)\)/g)].map((match) => match[1] ?? "");

  test("the catalogue lists the context types, then the registry's types in order, then the molecules", () => {
    const positions = [
      ...contextTypes().map((type) => `\`${type}\``),
      ...WIDGET_TYPES.map(({ noun }) => noun),
      ...READY_MOLECULES.map(({ molecule }) => `\`${molecule}\``),
    ].map((label) => catalogue.indexOf(`- ${label}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("SKILL.md links each to a file the generator writes; the catalogue states each one's use", () => {
    expect(linked.length).toBeGreaterThan(0);
    for (const path of linked) expect(files.has(path), path).toBe(true);
    for (const { skill: teaching } of WIDGET_TYPES)
      expect(catalogue).toContain(teaching?.use ?? "unreachable");
    for (const { use } of Object.values(MOLECULE_SKILLS)) expect(catalogue).toContain(use);
  });

  test("names every item type of the contract in backticks, a test-made one included", () => {
    for (const type of [...NON_WIDGET_ITEM_TYPES, ...WIDGET_TYPES.map((entry) => entry.type)]) {
      expect(skill, type).toContain(`\`${type}\``);
    }
    const extra = { ...PROBE_WIDGET, skill: { use: "a pick among options" } };
    const more = generateSkill({ widgets: [...WIDGET_TYPES, extra] }).files.get("SKILL.md") ?? "";
    expect(more.slice(more.indexOf("## Items"))).toContain("[`probe`]");
  });

  test("teaches the area: its shape, top level only, holding questions, all or none", () => {
    const items = skill.slice(skill.indexOf("## Items"));
    expect(items).toContain('{type: "area", id, props: {title, items}}');
    expect(items).toContain("At the top level");
    expect(items).toContain("group of questions");
    expect(items).toContain("Once one top-level item is an area, every one is");
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

  test("says an answer marked tooLarge carries no changes, derived values or results, and to fetch", () => {
    expect(answers).toContain("`tooLarge`");
    expect(answers).toContain("`changes`, derived values or `results`");
    expect(answers).toContain("`fetch` the item");
  });

  test("says an answer whose rev is earlier than the question's current one carries no derived values", () => {
    expect(answers).toContain("An answer whose `rev` is earlier than the question's current one");
    expect(answers).toContain(
      "carries no derived values: the board computes them on the current revision only",
    );
  });

  test("says to ask again on the current revision for derived values, and that fetch has none either", () => {
    expect(answers).toContain(
      "to have them, ask again on your current revision; `fetch` has none either",
    );
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
    expect(more.files.get("references/items.md")).toContain(
      "a Probe (`probe`): a pick among options",
    );
    expect(more.files.get("SKILL.md")).toContain("[`probe`](references/widgets/probe.md)");
  });
});
