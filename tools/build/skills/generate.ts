// The skill generator (askboard-skills, design decisions 1, 2 and 6): `generateSkill` turns the
// contract's registry, asking rules and constants, the molecules and its templates into the files of
// `skills/askboard/`, and the examples they hold. Pure: it reads no file at run time (the templates
// are read when `templates.ts` loads) and writes none, and its output has no date, no absolute path
// and a stable order, so two runs give the same bytes.

import {
  ASKING_RULE_TEXTS,
  ASKING_RULES,
  ID_PATTERN,
  type MoleculeDefinition,
  SNAPSHOT_DATA_ELEMENT,
  SNAPSHOT_FOLDER,
  WIDGET_TYPES,
  type WidgetType,
} from "@askboard/contract";
import { lifecycleCollectResult } from "@askboard/contract/fixtures";
import { MOLECULE_SKILLS, type MoleculeSkill, READY_MOLECULES } from "@askboard/molecules";
import { type ExampleBody, exampleBlock } from "./blocks.ts";
import { CONTEXT_TEACHING } from "./context-examples.ts";
import { contractSchemaResolver, type Schema } from "./fields.ts";
import {
  contextTypes,
  renderContextReference,
  renderMoleculeReference,
  renderWidgetReference,
} from "./references.ts";
import { DISK_TEMPLATES, type Templates } from "./templates.ts";

/** The templates as they stand on disk. */
export const TEMPLATES: Templates = DISK_TEMPLATES;

/** One example of a generated file, with the file that holds it. */
export type SkillExample = ExampleBody & { readonly file: string };

/** What the generator reads; every field defaults to what the repository ships. */
export type SkillInputs = {
  readonly widgets: readonly WidgetType[];
  readonly molecules: readonly MoleculeDefinition[];
  readonly moleculeSkills: Readonly<Record<string, MoleculeSkill>>;
  readonly templates: Templates;
};

export type GeneratedSkill = {
  /** Each file by its path under `skills/askboard/`, in the order they are written. */
  readonly files: ReadonlyMap<string, string>;
  readonly examples: readonly SkillExample[];
};

const SLOT = /\{\{(\w+)\}\}/g;

// Fills every slot of each template. A slot no value fills, and a value no template uses, fail.
const fill = (
  templates: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
): Record<string, string> => {
  const used = new Set<string>();
  const filled = Object.fromEntries(
    Object.entries(templates).map(([name, text]) => [
      name,
      text.replace(SLOT, (_slot, key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`the ${name} template has the slot {{${key}}}, which no value fills`);
        }
        used.add(key);
        return value;
      }),
    ]),
  );
  const unused = Object.keys(values).filter((key) => !used.has(key));
  if (unused.length > 0) {
    throw new Error(`no template uses the value ${unused.map((key) => `"${key}"`).join(", ")}`);
  }
  return filled;
};

const askingRules = (): string =>
  ASKING_RULES.map((rule) => `- \`${rule}\`: ${ASKING_RULE_TEXTS[rule]}`).join("\n");

const link = (label: string, path: string): string => `[${label}](${path})`;

// One line for each item type a question's `items` may hold, with where to read about it.
const itemIndex = (
  widgets: readonly WidgetType[],
  molecules: readonly MoleculeDefinition[],
  skills: Readonly<Record<string, MoleculeSkill>>,
): string =>
  [
    ...contextTypes().map((type) => {
      const use = CONTEXT_TEACHING.find((entry) => entry.type === type)?.use;
      return `- \`${type}\`: ${use} → ${link("context", "references/context.md")}`;
    }),
    ...widgets.map(
      ({ type, noun, skill }) =>
        `- ${noun} (\`${type}\`): ${skill?.use} → ${link(type, `references/widgets/${type}.md`)}`,
    ),
    ...molecules.map(
      ({ molecule }) =>
        `- \`${molecule}\`: ${skills[molecule]?.use} → ${link(molecule, `references/molecules/${molecule}.md`)}`,
    ),
  ].join("\n");

// The collect result of the answers reference: the lifecycle fixture's first event, alone.
const collectExample = (): ExampleBody => {
  const [ask] = lifecycleCollectResult.asks;
  const [event] = ask?.events ?? [];
  if (ask === undefined || event === undefined) throw new Error("the collect fixture has no event");
  const { versions, epoch } = lifecycleCollectResult;
  const { askId, state } = ask;
  return {
    kind: "result",
    value: { versions, epoch, asks: [{ askId, state, cursor: event.cursor, events: [event] }] },
  };
};

const withNewline = (text: string): string => `${text.replace(/\n+$/, "")}\n`;

/** The files of `skills/askboard/` and their examples. Throws, naming it, on a gap in the teaching. */
export const generateSkill = (inputs: Partial<SkillInputs> = {}): GeneratedSkill => {
  const widgets = inputs.widgets ?? WIDGET_TYPES;
  const molecules = inputs.molecules ?? READY_MOLECULES;
  const skills = inputs.moleculeSkills ?? MOLECULE_SKILLS;
  const templates = inputs.templates ?? TEMPLATES;
  const resolve = contractSchemaResolver(molecules.map(({ parameters }) => parameters as Schema));
  const collect = collectExample();

  const rendered = new Map<string, { text: string; examples: readonly ExampleBody[] }>();
  rendered.set("references/context.md", renderContextReference(resolve));
  for (const entry of widgets) {
    rendered.set(`references/widgets/${entry.type}.md`, renderWidgetReference(entry, resolve));
  }
  for (const definition of molecules) {
    rendered.set(
      `references/molecules/${definition.molecule}.md`,
      renderMoleculeReference(definition, skills, resolve, molecules),
    );
  }

  const prose = fill(
    { skill: templates.skill, answers: templates.answers },
    {
      askingRules: askingRules(),
      itemIndex: itemIndex(widgets, molecules, skills),
      idPattern: ID_PATTERN.slice(1, -1),
      snapshotFolder: SNAPSHOT_FOLDER,
      snapshotElement: SNAPSHOT_DATA_ELEMENT,
      collectExample: exampleBlock(collect),
    },
  );

  const files = new Map<string, string>();
  const examples: SkillExample[] = [];
  const add = (path: string, text: string, own: readonly ExampleBody[]) => {
    files.set(path, withNewline(text));
    examples.push(...own.map((example) => ({ ...example, file: path })));
  };
  add("SKILL.md", prose.skill ?? "", []);
  add("references/answers.md", prose.answers ?? "", [collect]);
  for (const [path, { text, examples: own }] of rendered) add(path, text, own);
  return { files, examples };
};
