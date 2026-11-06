// What the generated skill says of the context items and of the molecules that need a companion
// (askboard-skills, design decision 3): the context items are few and stable, so their use lines
// and examples live here; their fields come from their props schemas.

import type { MoleculeSkill } from "@askboard/molecules";

export type ItemExample = {
  readonly type: string;
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
};

/** A context item type's teaching: its props schema, when to use it and its examples. */
export type ContextItemTeaching = {
  readonly type: string;
  readonly propsId: string;
  readonly use: string;
  /** Descriptions that replace a schema's for a field, by path: the pointer's is a contract note. */
  readonly descriptions?: Readonly<Record<string, string>>;
  readonly examples: readonly ItemExample[];
};

// What the pointer schema says is the contract's own note on its grammar; an agent needs this.
const POINTER =
  "A project file, relative to the project root, with an optional anchor: `#Heading` or `#L10-L40`. A pointer AskBoard cannot read is a warning, not an error.";

/** The context item types, in the order the skill lists them. */
export const CONTEXT_TEACHING: readonly ContextItemTeaching[] = [
  {
    type: "excerpt",
    propsId: "urn:askboard:input:excerpt-props",
    use: "a passage of a project file beside the question: a pointer, which AskBoard resolves when the ask is sent, or text you wrote, never both",
    descriptions: { pointer: POINTER },
    examples: [
      {
        type: "excerpt",
        id: "scope-excerpt",
        props: { pointer: "docs/prd.md#Scope", title: "Scope in the PRD" },
      },
    ],
  },
  {
    type: "reference",
    propsId: "urn:askboard:input:reference-props",
    use: "a file or a web page the user opens in one click: a pointer or an http or https URL, never both",
    descriptions: { pointer: POINTER },
    examples: [
      {
        type: "reference",
        id: "install-notes",
        props: { pointer: "README.md#Install", title: "Install notes" },
      },
    ],
  },
  {
    type: "image",
    propsId: "urn:askboard:input:image-props",
    use: "a screenshot or picture saved as a project file, with the text that describes it",
    descriptions: { pointer: POINTER },
    examples: [
      {
        type: "image",
        id: "checkout-screen",
        props: { pointer: ".askboard/media/checkout.png", alt: "The checkout page with the error" },
      },
    ],
  },
];

const FIRST_PART = (name: string): string => name.split("-")[0] ?? name;

/** The item ID an example gives a molecule's reference: the first part of its name. */
export const moleculeExampleId = (name: string): string => FIRST_PART(name);

/** A molecule reference as an item, with the example data of its teaching. */
export const moleculeExampleItem = (name: string, skill: MoleculeSkill): ItemExample => ({
  type: "molecule",
  id: moleculeExampleId(name),
  props: { molecule: name, data: skill.example as Record<string, unknown> },
});
