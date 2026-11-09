// The skill generator (askboard-skills, design decisions 1, 2 and 6): `generateSkill` turns the
// contract's registry, asking rules and constants, the molecules and its templates into the files of
// `skills/askboard/`, and the examples they hold. Pure: it reads no file at run time (the templates
// are read when `templates.ts` loads) and writes none, and its output has no date, no absolute path
// and a stable order, so two runs give the same bytes.

import {
  ASKING_RULE_TEXTS,
  ASKING_RULES,
  ID_PATTERN,
  LAYOUT_TYPES,
  type MoleculeDefinition,
  SNAPSHOT_DATA_ELEMENT,
  SNAPSHOT_FOLDER,
  WIDGET_TYPES,
  type WidgetType,
} from "@askboard/contract";
import { lifecycleCollectResult } from "@askboard/contract/fixtures";
import { MOLECULE_SKILLS, type MoleculeSkill, READY_MOLECULES } from "@askboard/molecules";
import { type ExampleBody, exampleBlock } from "./blocks.ts";
import { catalogueText, itemIndex } from "./catalogue.ts";
import { contractSchemaResolver, type Schema } from "./fields.ts";
import {
  renderContextReference,
  renderMoleculeReference,
  renderWidgetReference,
} from "./references.ts";
import { DISK_TEMPLATES, type Templates } from "./templates.ts";
import { ACTION_GLOSSES, actionLines, UPDATE_EXAMPLES } from "./updates.ts";

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
  /** The input format's update schema, whose actions the updates reference lists. */
  readonly updateSchema: Schema;
  /** The gloss of each action of `updateSchema`, by its `action` value. */
  readonly actionGlosses: Readonly<Record<string, string>>;
  /** The input format's ask schema, whose `language` and `locale` the language section lists. */
  readonly askSchema: Schema;
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

// The sentence that a question's items may sit in layouts, when the registry holds any (layouts,
// design decision 3): empty before they are registered, so that the skill teaches nothing the
// contract refuses.
const layoutNote = (widgets: readonly WidgetType[]): string => {
  const held = LAYOUT_TYPES.filter((layout) => widgets.some(({ type }) => type === layout));
  if (held.length === 0) return "";
  const names = held.map((layout) => `\`${layout}\``).join(", ");
  return `\n\nA question's \`items\` may sit in layouts (${names}) that hold atoms, widgets and other layouts, four deep at most; context items and molecule references stay in the question's own \`items\`. Item IDs are unique at every depth.`;
};

// The sentence on building a form from fields (form-widget, design decision 7): empty until the
// PickField is registered, so that the skill teaches nothing the contract refuses.
const formNote = (widgets: readonly WidgetType[]): string =>
  widgets.some(({ type }) => type === "pick-field")
    ? "\n\nFor a form, put fields in the question, a Group per section; a `required` field must be filled."
    : "";

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

const isSchema = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The values of an ask field's `enum`, as a list in words: "`a` and `b`", "`a`, `b` and `c`". Fails,
// naming the field, when the input format has no such enum (agent-facing-gaps, decision 6).
const enumList = (ask: Schema, field: string): string => {
  const properties = isSchema(ask.properties) ? ask.properties : {};
  const property = properties[field];
  const values = isSchema(property) && Array.isArray(property.enum) ? property.enum : [];
  const quoted = values.filter((v): v is string => typeof v === "string").map((v) => `\`${v}\``);
  if (quoted.length === 0) {
    throw new Error(`the input format's ask has no enum for the field "${field}"`);
  }
  const last = quoted.at(-1) as string;
  return quoted.length === 1 ? last : `${quoted.slice(0, -1).join(", ")} and ${last}`;
};

const schemaNamed = (resolve: (id: string) => Schema | undefined, id: string): Schema => {
  const found = resolve(id);
  if (found === undefined) throw new Error(`the input format has no schema ${id}`);
  return found;
};

const withNewline = (text: string): string => `${text.replace(/\n+$/, "")}\n`;

/** The files of `skills/askboard/` and their examples. Throws, naming it, on a gap in the teaching. */
export const generateSkill = (inputs: Partial<SkillInputs> = {}): GeneratedSkill => {
  const widgets = inputs.widgets ?? WIDGET_TYPES;
  const molecules = inputs.molecules ?? READY_MOLECULES;
  const skills = inputs.moleculeSkills ?? MOLECULE_SKILLS;
  const templates = inputs.templates ?? TEMPLATES;
  const resolve = contractSchemaResolver(
    molecules.map(({ parameters }) => parameters as Schema),
    widgets,
  );
  const updateSchema = inputs.updateSchema ?? schemaNamed(resolve, "urn:askboard:input:update");
  const askSchema = inputs.askSchema ?? schemaNamed(resolve, "urn:askboard:input:ask");
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
    { skill: templates.skill, answers: templates.answers, updates: templates.updates },
    {
      askingRules: askingRules(),
      itemIndex: itemIndex(widgets, molecules),
      layoutNote: layoutNote(widgets),
      formNote: formNote(widgets),
      idPattern: ID_PATTERN.slice(1, -1),
      snapshotFolder: SNAPSHOT_FOLDER,
      snapshotElement: SNAPSHOT_DATA_ELEMENT,
      collectExample: exampleBlock(collect),
      languages: enumList(askSchema, "language"),
      locales: enumList(askSchema, "locale"),
      actions: actionLines(updateSchema, inputs.actionGlosses ?? ACTION_GLOSSES).join("\n"),
      askExample: exampleBlock(UPDATE_EXAMPLES.ask),
      changeExample: exampleBlock(UPDATE_EXAMPLES.change),
      replyExample: exampleBlock(UPDATE_EXAMPLES.reply),
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
  add("references/updates.md", prose.updates ?? "", [
    UPDATE_EXAMPLES.ask,
    UPDATE_EXAMPLES.change,
    UPDATE_EXAMPLES.reply,
  ]);
  add("references/items.md", catalogueText(widgets, molecules, skills), []);
  for (const [path, { text, examples: own }] of rendered) add(path, text, own);
  return { files, examples };
};
