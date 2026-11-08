// The item catalogue and SKILL.md's item index (skill-index, design decisions 1 to 3): the use of
// each item type lives in `references/items.md`, one level from `SKILL.md`, and `SKILL.md` holds
// four lines of links, so a new type costs it one link. The catalogue links no file of the skill.

import type { MoleculeDefinition, WidgetType } from "@askboard/contract";
import type { MoleculeSkill } from "@askboard/molecules";
import { CONTEXT_TEACHING } from "./context-examples.ts";
import { contextTypes } from "./references.ts";

type Skills = Readonly<Record<string, MoleculeSkill>>;

const link = (label: string, path: string): string => `[${label}](${path})`;

/** `references/items.md`: what each item type is for, by heading, in the index's order. */
export const catalogueText = (
  widgets: readonly WidgetType[],
  molecules: readonly MoleculeDefinition[],
  skills: Skills,
): string =>
  [
    "# Item catalogue",
    "This is what each item type is for, to choose among them; `SKILL.md` links the reference of each type.",
    "## Context items",
    contextTypes()
      .map((type) => `- \`${type}\`: ${CONTEXT_TEACHING.find((entry) => entry.type === type)?.use}`)
      .join("\n"),
    "## Widgets",
    widgets.map(({ type, noun, skill }) => `- ${noun} (\`${type}\`): ${skill?.use}`).join("\n"),
    "## Molecules",
    molecules.map(({ molecule }) => `- \`${molecule}\`: ${skills[molecule]?.use}`).join("\n"),
  ].join("\n\n");

/** The four lines of `SKILL.md`'s `{{itemIndex}}` slot: the catalogue, then a link for each type. */
export const itemIndex = (
  widgets: readonly WidgetType[],
  molecules: readonly MoleculeDefinition[],
): string =>
  [
    `- What each type is for: ${link("items", "references/items.md")}`,
    `- Context items, in ${link("context", "references/context.md")}: ${contextTypes()
      .map((type) => `\`${type}\``)
      .join(", ")}`,
    `- Widgets: ${widgets
      .map(({ type }) => link(`\`${type}\``, `references/widgets/${type}.md`))
      .join(", ")}`,
    `- Molecules: ${molecules
      .map(({ molecule }) => link(`\`${molecule}\``, `references/molecules/${molecule}.md`))
      .join(", ")}`,
  ].join("\n");
