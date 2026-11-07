// The reference renderers of the generated skill (askboard-skills, design decisions 3 and 4): one
// Markdown file for a widget type, for a ready molecule and for the context items, each the
// teaching data, the fields of its schema and an example. They fail, naming it, on a type or a
// molecule with no teaching, so that registering one without it cannot ship.

import type { MoleculeDefinition } from "@askboard/contract";
import { NON_WIDGET_ITEM_TYPES, type WidgetType } from "@askboard/contract";
import type { MoleculeSkill } from "@askboard/molecules";
import { type ExampleBody, exampleBlock } from "./blocks.ts";
import {
  CONTEXT_TEACHING,
  type ItemExample,
  moleculeExampleId,
  moleculeExampleItem,
} from "./context-examples.ts";
import { fieldLines, type Resolve, type Schema, stripCitations } from "./fields.ts";

/** A rendered reference file and the examples its text holds, in order. */
export type Rendered = { readonly text: string; readonly examples: readonly ExampleBody[] };

const MOLECULE_TYPE = "molecule";
const NOT_CONTEXT = [MOLECULE_TYPE, "question", "area"];

/** The context item types of the contract's input format, in its order. */
export const contextTypes = (): readonly string[] =>
  NON_WIDGET_ITEM_TYPES.filter((type) => !NOT_CONTEXT.includes(type));

const sentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.:!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const widgetTitle = (entry: WidgetType): string => entry.noun.replace(/^an? /i, "");

// What the answer carries for a widget type: its edits, its result, its derived values.
const answerLines = (entry: WidgetType, resolve: Resolve): string[] => {
  const lines: string[] = [];
  if (entry.edits !== undefined) {
    lines.push(
      "- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.",
    );
  }
  if (entry.result !== undefined) {
    lines.push(
      "- Result: `results` holds, under the item's ID, an object with:",
      ...fieldLines(entry.result.schema as Schema, resolve).map((line) => `  ${line}`),
    );
  }
  if (entry.derived !== undefined) {
    lines.push(
      `- Derived: \`derived\` carries ${entry.derived.describe}, by address; never compute them.`,
    );
  }
  return lines.length > 0
    ? lines
    : ["- Nothing: this type's answer has no edits, result or derived values."];
};

/** The reference of one registered widget type. */
export const renderWidgetReference = (entry: WidgetType, resolve: Resolve): Rendered => {
  if (entry.skill === undefined) {
    throw new Error(`the widget type "${entry.type}" has no teaching text (its \`skill\`)`);
  }
  const item: unknown = (entry.example as { item?: unknown } | undefined)?.item;
  if (typeof item !== "object" || item === null) {
    throw new Error(`the widget type "${entry.type}" has no example item (its \`example.item\`)`);
  }
  const shape = entry.wording.expected[`${entry.type}.props`];
  const example: ExampleBody = { kind: "item", value: item };
  const fields = fieldLines(entry.props as Schema, resolve);
  // The sections, each after one blank line: a type whose props have no fields (the Approval's
  // `{}`) has no Fields section.
  const sections = [
    ...(fields.length === 0 ? [] : [["## Fields", "", ...fields]]),
    ...(entry.skill.notes === undefined
      ? []
      : [["## Notes", "", ...entry.skill.notes.map((note) => `- ${note}`)]]),
    ["## In the answer", "", ...answerLines(entry, resolve)],
    ["## Example", "", exampleBlock(example)],
  ];
  const text = [
    `# ${widgetTitle(entry)}`,
    "",
    `Use for ${sentence(entry.skill.use)}`,
    `Item type \`${entry.type}\`${shape === undefined ? "" : `: props are ${shape}`}.`,
    ...sections.flatMap((section) => ["", ...section]),
    "",
  ].join("\n");
  return { text, examples: [example] };
};

const referenceItem = (name: string, skill: MoleculeSkill): ItemExample =>
  moleculeExampleItem(name, skill);

const questionAround = (items: readonly ItemExample[], askId: string): unknown => ({
  askId,
  items: [{ type: "question", id: "q", props: { text: "Review the plan.", items } }],
});

/**
 * The reference of one ready molecule. A molecule whose teaching data names a `companion` (the
 * item of its question that its example refers to, and the molecule that supplies it) has an `ask`
 * example holding the companion's reference under `companion.id`, then its own. `ready` is the
 * list of ready molecules the companion must be in.
 */
export const renderMoleculeReference = (
  definition: MoleculeDefinition,
  skills: Readonly<Record<string, MoleculeSkill>>,
  resolve: Resolve,
  ready: readonly MoleculeDefinition[] = [definition],
): Rendered => {
  const name = definition.molecule;
  const skill = skills[name];
  if (skill === undefined) throw new Error(`the molecule "${name}" has no teaching data`);
  const parameters = definition.parameters as Schema;
  const companion = skill.companion;
  if (companion !== undefined) {
    if (!ready.some(({ molecule }) => molecule === companion.molecule)) {
      throw new Error(
        `the molecule "${name}" needs "${companion.molecule}" as its companion, which is not ready`,
      );
    }
    if (companion.id === moleculeExampleId(name)) {
      throw new Error(
        `the molecule "${name}" and its companion "${companion.molecule}" share the item ID "${companion.id}"`,
      );
    }
  }
  const companionSkill = companion === undefined ? undefined : skills[companion.molecule];
  if (companion !== undefined && companionSkill === undefined) {
    throw new Error(`the molecule "${companion.molecule}" has no teaching data`);
  }
  const item = referenceItem(name, skill);
  const example: ExampleBody =
    companion === undefined || companionSkill === undefined
      ? { kind: "item", value: item }
      : {
          kind: "ask",
          value: questionAround(
            [{ ...referenceItem(companion.molecule, companionSkill), id: companion.id }, item],
            "plan-x7k2",
          ),
        };
  const described = typeof parameters.description === "string" ? parameters.description : "";
  const text = [
    `# \`${name}\` molecule, version ${definition.version}`,
    "",
    `Use for ${sentence(skill.use)}`,
    capitalised(sentence(stripCitations(described))),
    "",
    `Send it in a question's \`items\` as \`{type: "molecule", id, props: {molecule: "${name}", data}}\`; answers and \`fetch\` use the reference's ID.`,
    ...(companion === undefined
      ? []
      : [
          `It needs the item of \`${companion.molecule}\` in the same question, as the example shows.`,
        ]),
    "",
    "## Data",
    "",
    ...fieldLines(parameters, resolve),
    "",
    "## Example",
    "",
    exampleBlock(example),
    "",
  ].join("\n");
  return { text, examples: [example] };
};

const teachingOf = (type: string) => {
  const teaching = CONTEXT_TEACHING.find((entry) => entry.type === type);
  if (teaching === undefined) throw new Error(`the context item type "${type}" has no teaching`);
  return teaching;
};

/** The reference of the context item types: each one's use, fields and example. */
export const renderContextReference = (
  resolve: Resolve,
  types: readonly string[] = contextTypes(),
): Rendered => {
  const examples: ExampleBody[] = [];
  const sections = types.flatMap((type) => {
    const teaching = teachingOf(type);
    const props = resolve(teaching.propsId);
    if (props === undefined) throw new Error(`the schema "${teaching.propsId}" does not resolve`);
    const blocks = teaching.examples.map((value): ExampleBody => ({ kind: "item", value }));
    examples.push(...blocks);
    return [
      `## ${type}`,
      "",
      `Use for ${sentence(teaching.use)}`,
      "",
      ...fieldLines(props, resolve, teaching.descriptions),
      "",
      ...blocks.flatMap((block) => [exampleBlock(block), ""]),
    ];
  });
  const text = [
    "# Context items",
    "",
    "Context sits beside a question, in its `items`. Point to project files instead of copying them: a pointer is `path#Heading` or `path#L10-L40`, relative to the project root. Save screenshots under `.askboard/media/` and point to them; image data and image URLs are refused.",
    "",
    ...sections,
  ].join("\n");
  return { text, examples };
};
