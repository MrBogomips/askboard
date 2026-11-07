// The widget-type registry (widget-registry, design decisions 1 to 3; contract spec, "The
// widget-type registry"): one entry per type a question's `items` may hold beside the context
// items and the molecule reference, in order, Tree then Gantt, later types appended. An entry
// holds everything the contract says of its type: its props schema and checks, its element shape
// and changes schema when the user edits the agent's content, its result schema and checks when it
// gives one, its derived declarations, its agent-facing wording, an example item and, since askboard-skills, its teaching text. Every check,
// wording, element lookup and diff shape of a widget item reads its entry, so that registering a
// type is enough for the contract to accept, check, word and diff its items.
//
// Import rule: an entry module imports JSON schemas, pure checks, constants and types, never a
// runtime value of `validate.ts`, `sets.ts` or a schema set module. The sets import this module to
// compose their schemas, and an import the other way would read `WIDGET_TYPES` before it is
// initialised for some import orders. Choice and the molecule reference stay outside the registry.

import type { AnySchemaObject, ErrorObject } from "ajv/dist/2020";
import { ID_PATTERN } from "../constants.ts";
import type { Segments } from "../problems.ts";
import boardDocumentBase from "../schemas/board-document/board-document.json" with { type: "json" };
import questionPropsBase from "../schemas/input/question-props.json" with { type: "json" };
import fetchResultBase from "../schemas/tool-envelopes/fetch-result.json" with { type: "json" };
import type { Problem } from "../validate.ts";
import { APPROVAL_WIDGET } from "./approval/widget.ts";
import type { ElementShape } from "./element-diff.ts";
import { GANTT_WIDGET } from "./gantt/widget.ts";
import { LATEX_WIDGET } from "./latex/widget.ts";
import { RANKING_WIDGET } from "./ranking/widget.ts";
import { SCALE_WIDGET } from "./scale/widget.ts";
import { TREE_WIDGET } from "./tree/widget.ts";

/** Whether a widget's value is the agent's or the user's edit. */
export type WidgetOrigin = "agent" | "edited";

/**
 * What the answer a result travels in says to the result's own checks (approval-scale-ranking,
 * design decision 2): the answer's note and whether its changes name any element.
 */
export type WidgetAnswer = {
  readonly note: string | undefined;
  readonly changed: boolean;
};

/** One widget type's contract (design decision 1). */
export type WidgetType = {
  /** The item type, the component's name and its chunk's name. */
  readonly type: string;
  /** How the agent-facing wording names one, as `a Tree`. */
  readonly noun: string;
  /** The props schema, `urn:askboard:input:<type>-props`. */
  readonly props: AnySchemaObject;
  /** What the schema cannot say of the props, after the schema. */
  readonly propsProblems: (props: unknown, origin: WidgetOrigin) => readonly Problem[];
  /**
   * Set when `propsProblems` reads any value, and so also runs, its problems added to the schema's
   * and each problem once, when the schema refused the props; otherwise it runs after the schema
   * passed (the Gantt reads its own plan form, the Tree reads only what its schema let through).
   */
  readonly checksInvalidProps?: true;
  /** What the item's own question adds to its checks (a Gantt plan's link). */
  readonly itemProblems?: (item: unknown, question: unknown) => readonly Problem[];
  /** For a widget whose content the user edits: its changes schema and its element shape. */
  readonly edits?: {
    /** `urn:askboard:output:<type>-changes`. */
    readonly changes: AnySchemaObject;
    readonly shape: (props: unknown) => ElementShape;
  };
  /** For a widget that gives a result: its schema, `urn:askboard:output:<type>-result`, and checks. */
  readonly result?: {
    readonly schema: AnySchemaObject;
    /**
     * The schema's own rule in plain ECMAScript, with no Ajv: whether `result` has the shape the
     * schema takes. The board page checks it, with `problems`, before it holds or seeds a result
     * (`widgetResultFits`); a type with a result and no shape fits no result there, never any
     * (approval-scale-ranking, pre-PR reviews, security X-1).
     */
    readonly shape?: (result: unknown) => boolean;
    readonly problems?: (result: unknown, props: unknown) => readonly Problem[];
    /**
     * What the answer the result travels in must hold or leave out, after the result's own checks
     * (approval-scale-ranking, design decision 2): each message states what is wrong, and
     * `widgetAnswerProblems` names the item.
     */
    readonly answerProblems?: (result: unknown, answer: WidgetAnswer) => readonly string[];
  };
  /** The derived values the answer carries: what is declared and the check of one address. */
  readonly derived?: {
    readonly describe: string;
    /** Why an address below the item (`rest`) is no field the type declares; undefined when it is. */
    readonly problem: (rest: readonly string[], props: unknown) => string | undefined;
  };
  readonly wording: {
    /** The expected shapes, keyed `<type>.props…`. */
    readonly expected: Readonly<Record<string, string>>;
    /** What each of the type's objects holds, keyed `<type>.props…`. */
    readonly fields: Readonly<Record<string, string>>;
    /** The path from the item as its wording key reads it. */
    readonly rest?: (rest: Segments) => Segments;
    /** The element a path from the item is in, worded `node "ux"`. */
    readonly element?: (item: unknown, rest: Segments) => string | undefined;
    /** The request's schema errors with those the type words itself cleared. */
    readonly schemaErrors?: (
      errors: readonly ErrorObject[],
      value: unknown,
    ) => readonly ErrorObject[];
  };
  readonly example: {
    readonly item: { readonly type: string; readonly id: string; readonly props: unknown };
  };
  /**
   * The teaching text of the generated skill (askboard-skills, design decision 3): when to use the
   * widget, 1 to 200 characters, and notes, each 1 to 300. Optional here so a test-only type still
   * type-checks; every shipped type carries it.
   */
  readonly skill?: {
    readonly use: string;
    readonly notes?: readonly string[];
  };
};

/** The widget types a question's items may hold, in order. */
export const WIDGET_TYPES: readonly WidgetType[] = [
  TREE_WIDGET,
  GANTT_WIDGET,
  APPROVAL_WIDGET,
  SCALE_WIDGET,
  RANKING_WIDGET,
  LATEX_WIDGET,
];

/** The entry of an item type, when the registry holds it. */
export const widgetTypeOf = (
  type: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): WidgetType | undefined => types.find((entry) => entry.type === type);

/** The context item types of a question's `items` (excerpts, design decision 2). */
export const CONTEXT_ONLY_ITEM_TYPES: readonly string[] = ["excerpt", "reference", "image"];

/** The item types that are context, a reference, a question or an area, never a widget's. */
export const NON_WIDGET_ITEM_TYPES: readonly string[] = [
  ...CONTEXT_ONLY_ITEM_TYPES,
  "molecule",
  "question",
  "area",
];

/** What a registry's check found, naming the entry and the rule it breaks. */
export type RegistryProblem = {
  /** The entry's type, or `entry <position>` when it has none. */
  readonly type: string;
  readonly rule:
    | "duplicate"
    | "reserved"
    | "type"
    | "noun"
    | "props-id"
    | "changes-id"
    | "result-id"
    | "result-empty"
    | "wording"
    | "example"
    | "skill";
  readonly message: string;
};

const ID = new RegExp(ID_PATTERN);

// The `$defs` keys of the three base files a type's item is added beside: a type of that name
// would replace the definition. Read from the files, so the list stays in step with them.
const BASE_DEFINITIONS: ReadonlySet<string> = new Set(
  [questionPropsBase, boardDocumentBase, fetchResultBase].flatMap((base) =>
    Object.keys((base as { $defs: object }).$defs),
  ),
);

// A type that is a definition of a base schema, or a name every object inherits (`__proto__`,
// `constructor`), which the composers could not hold as an own key of `$defs`.
const takesName = (type: string): boolean => BASE_DEFINITIONS.has(type) || type in Object.prototype;

const idProblem = (
  entry: WidgetType,
  schema: AnySchemaObject | undefined,
  rule: "props-id" | "changes-id" | "result-id",
  wanted: string,
): RegistryProblem[] =>
  schema === undefined || schema.$id === wanted
    ? []
    : [
        {
          type: entry.type,
          rule,
          message: `the ${rule.slice(0, -3)} schema of "${entry.type}" has the $id ${JSON.stringify(schema.$id)}, not ${wanted}`,
        },
      ];

const wordingProblems = (entry: WidgetType): RegistryProblem[] => {
  const prefix = `${entry.type}.props`;
  const stray = [
    ...Object.keys(entry.wording.expected),
    ...Object.keys(entry.wording.fields),
  ].filter(
    (key) => key !== prefix && !key.startsWith(`${prefix}.`) && !key.startsWith(`${prefix}[`),
  );
  return stray.length === 0
    ? []
    : [
        {
          type: entry.type,
          rule: "wording",
          message: `the wording of "${entry.type}" has keys outside ${prefix}: ${stray.join(", ")}`,
        },
      ];
};

const SKILL_USE_MAX = 200;
const SKILL_NOTE_MAX = 300;

// The teaching text's bounds (askboard-skills): a use of 1 to 200 characters, each note 1 to 300.
const skillProblems = (entry: WidgetType): RegistryProblem[] => {
  const { skill } = entry;
  if (skill === undefined) return [];
  const problems: RegistryProblem[] = [];
  const at = (message: string) => problems.push({ type: entry.type, rule: "skill", message });
  if (typeof skill !== "object" || skill === null) {
    at(`the teaching text of "${entry.type}" is no object with a use and notes`);
    return problems;
  }
  if (skill.notes !== undefined && skill.notes !== null && !Array.isArray(skill.notes)) {
    at(`the teaching notes of "${entry.type}" are no list`);
  }
  const use = typeof skill.use === "string" ? skill.use.length : 0;
  if (use < 1 || use > SKILL_USE_MAX) {
    at(
      `the teaching use of "${entry.type}" has ${use} characters, and a use has 1 to ${SKILL_USE_MAX}`,
    );
  }
  (Array.isArray(skill.notes) ? skill.notes : []).forEach((note, index) => {
    const length = typeof note === "string" ? note.length : 0;
    if (length < 1 || length > SKILL_NOTE_MAX) {
      at(
        `teaching note ${index + 1} of "${entry.type}" has ${length} characters, and a note has 1 to ${SKILL_NOTE_MAX}`,
      );
    }
  });
  return problems;
};

const entryProblems = (entry: WidgetType, index: number, seen: Set<string>): RegistryProblem[] => {
  const type = typeof entry.type === "string" ? entry.type : `entry ${index}`;
  const problems: RegistryProblem[] = [];
  const at = (rule: RegistryProblem["rule"], message: string) =>
    problems.push({ type, rule, message });
  if (typeof entry.type !== "string" || !ID.test(entry.type)) {
    at("type", `${type} is no type: a type matches ${ID_PATTERN}`);
  }
  if (seen.has(type)) at("duplicate", `the type "${type}" is held twice`);
  seen.add(type);
  if (NON_WIDGET_ITEM_TYPES.includes(type)) {
    at("reserved", `"${type}" is a context, molecule, question or area type, no widget`);
  } else if (takesName(type)) {
    at("reserved", `"${type}" is a definition of the composed schemas or a name every object has`);
  }
  if (entry.noun === "") at("noun", `"${type}" has no noun for the wording`);
  problems.push(
    ...idProblem(entry, entry.props, "props-id", `urn:askboard:input:${type}-props`),
    ...idProblem(entry, entry.edits?.changes, "changes-id", `urn:askboard:output:${type}-changes`),
    ...idProblem(entry, entry.result?.schema, "result-id", `urn:askboard:output:${type}-result`),
    ...wordingProblems(entry),
    ...skillProblems(entry),
  );
  if (entry.example.item.type !== type) {
    at("example", `the example of "${type}" is an item of the type "${entry.example.item.type}"`);
  }
  return problems;
};

/**
 * What is wrong with a registry as a whole, apart from what its result schemas accept (`registry-
 * check.ts` adds that, which needs a validator this module may not import): a duplicate type, a
 * type that is a context, molecule, question or area type, a definition of a composed schema, an
 * inherited object name or outside the ID pattern, a schema whose `$id` is not its pattern, wording
 * keys outside the type, an example of another type, a teaching text outside its bounds
 * (askboard-skills). Empty when it holds together.
 */
export const registryShapeProblems = (types: readonly WidgetType[]): readonly RegistryProblem[] => {
  const seen = new Set<string>();
  return types.flatMap((entry, index) => entryProblems(entry, index, seen));
};
