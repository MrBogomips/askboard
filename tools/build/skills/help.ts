// The help skill generator (keyboard-shortcuts-help, design decisions 10 and 20): `generateHelpSkill`
// turns the registry's help text and key tables, the molecules' help sentences and its template into
// the files of `skills/askboard-help/`. Like `generateSkill` it is pure and has no date, no absolute
// path and a stable order. The skill holds no ask example and calls no tool: it only teaches.

import {
  type MoleculeDefinition,
  TOOL_DEFINITIONS,
  WIDGET_TYPES,
  type WidgetType,
} from "@askboard/contract";
import { MOLECULE_SKILLS, type MoleculeSkill, READY_MOLECULES } from "@askboard/molecules";
import { fill } from "./fill.ts";
import { configureKeysText, KEY_EXAMPLES, type KeyExample, keyActionsText } from "./help-keys.ts";
import { keysSection } from "./keys.ts";
import { DISK_TEMPLATES, type Templates } from "./templates.ts";

/** The files of `skills/askboard-help/`, by path. The help skill holds no example. */
export type GeneratedHelp = { readonly files: ReadonlyMap<string, string> };

/** What the help generator reads; every field defaults to what the repository ships. */
export type HelpInputs = {
  readonly widgets: readonly WidgetType[];
  readonly molecules: readonly MoleculeDefinition[];
  readonly moleculeSkills: Readonly<Record<string, MoleculeSkill>>;
  readonly templates: Templates;
  readonly keyExamples: readonly KeyExample[];
  /** AskBoard's tool names as the session names them (`mcp__plugin_askboard_askboard__ask`). */
  readonly toolNames: readonly string[];
};

/** The names Claude Code gives the plugin's tools (probed in keyboard-shortcuts-help task 0.4). */
export const SESSION_TOOL_PREFIX = "mcp__plugin_askboard_askboard__";

const sentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.:!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const widgetTitle = (entry: WidgetType): string => entry.noun.replace(/^an? /i, "");

const widgetReference = (entry: WidgetType): string => {
  const { help, skill } = entry;
  if (help === undefined) {
    throw new Error(`the widget type "${entry.type}" has no help text (its \`help\`)`);
  }
  const keys = keysSection(entry);
  return [
    `# ${widgetTitle(entry)}`,
    "",
    `Item type \`${entry.type}\`. It is for ${sentence(skill?.use ?? "a question")}`,
    "",
    "## With the mouse",
    "",
    sentence(help.mouse),
    "",
    "## What the agent receives",
    "",
    sentence(help.answer),
    ...(keys === ""
      ? ["", "It has no keys of its own beyond the standard ones in `SKILL.md`."]
      : ["", keys]),
  ].join("\n");
};

// The registered widget types a molecule's item names, in order, found anywhere in its definition.
const typesOf = (definition: MoleculeDefinition, widgets: readonly WidgetType[]): string[] => {
  const known = new Set(widgets.map(({ type }) => type));
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === "object" && value !== null) {
      const { type } = value as { type?: unknown };
      if (typeof type === "string" && known.has(type) && !found.includes(type)) found.push(type);
      Object.values(value).forEach(walk);
    }
  };
  walk(definition.items);
  return found;
};

const moleculeReference = (
  definition: MoleculeDefinition,
  skills: Readonly<Record<string, MoleculeSkill>>,
  widgets: readonly WidgetType[],
): string => {
  const name = definition.molecule;
  const skill = skills[name];
  if (skill?.help === undefined) {
    throw new Error(`the molecule "${name}" has no help text (its \`help\`)`);
  }
  const types = typesOf(definition, widgets);
  return [
    `# \`${name}\` molecule`,
    "",
    sentence(skill.help),
    "",
    types.length === 0
      ? "It expands into no widget of its own."
      : `It expands into the widget ${types.length === 1 ? "type" : "types"} ${types.map((type) => `\`${type}\``).join(", ")}: the mouse and key help of ${types.length === 1 ? "that type" : "each"} applies.`,
  ].join("\n");
};

const index = (widgets: readonly WidgetType[], molecules: readonly MoleculeDefinition[]): string =>
  [
    `- Widgets: ${widgets.map(({ type }) => `[\`${type}\`](references/widgets/${type}.md)`).join(", ")}`,
    `- Molecules: ${molecules.map(({ molecule }) => `[\`${molecule}\`](references/molecules/${molecule}.md)`).join(", ")}`,
  ].join("\n");

const withNewline = (text: string): string => `${text.replace(/\n+$/, "")}\n`;

/** The files of `skills/askboard-help/`. Throws, naming it, on a type or molecule with no help text or an example the key check refuses. */
export const generateHelpSkill = (inputs: Partial<HelpInputs> = {}): GeneratedHelp => {
  const widgets = inputs.widgets ?? WIDGET_TYPES;
  const molecules = inputs.molecules ?? READY_MOLECULES;
  const skills = inputs.moleculeSkills ?? MOLECULE_SKILLS;
  const templates = inputs.templates ?? DISK_TEMPLATES;
  const toolNames =
    inputs.toolNames ?? TOOL_DEFINITIONS.map(({ name }) => `${SESSION_TOOL_PREFIX}${name}`);
  const { help } = fill(
    { help: templates.help },
    { disallowedTools: toolNames.join(" "), index: index(widgets, molecules) },
  );
  const files = new Map<string, string>();
  files.set("SKILL.md", withNewline(help ?? ""));
  for (const entry of widgets) {
    files.set(`references/widgets/${entry.type}.md`, withNewline(widgetReference(entry)));
  }
  for (const definition of molecules) {
    files.set(
      `references/molecules/${definition.molecule}.md`,
      withNewline(moleculeReference(definition, skills, widgets)),
    );
  }
  files.set(
    "references/configure-keys.md",
    withNewline(configureKeysText(widgets, inputs.keyExamples ?? KEY_EXAMPLES)),
  );
  files.set("references/key-actions.md", withNewline(keyActionsText(widgets)));
  return { files };
};
