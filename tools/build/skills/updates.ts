// The updates reference's data (agent-facing-gaps, design decision 3): one line for each action of
// the input format's update schema, read from it, with a short gloss kept here, and the three
// examples of the reference. An action the schema holds and the table does not fails the generator,
// naming it, so a new action cannot ship unexplained.

import type { ExampleBody } from "./blocks.ts";
import type { Schema } from "./fields.ts";

/** The gloss of each action of the update schema, by its `action` value. */
export const ACTION_GLOSSES: Readonly<Record<string, string>> = {
  add: "Adds a question, into an area by `parentId` and after the sibling `after` names, or an area at the top level.",
  change:
    "Changes an item's props by its ID; each key you send replaces its value whole. Refused on a question with an answer: `reopen` it first.",
  delete:
    "Removes a question or an area, and everything in it. Refused on a question with an answer: `reopen` it first.",
  reopen: "Reopens a question that has an answer: a new revision starts.",
  answer: "Records an answer the user gave you outside the board.",
  reply:
    "Replies to a follow-up: `itemId` is the question the follow-up event names, `followUp` that event's cursor, as you received it.",
  close: "Closes the ask.",
};

const isSchema = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The `$defs` entry a `$ref` of the form `#/$defs/<name>` names.
const definition = (schema: Schema, ref: unknown): Schema => {
  const name = typeof ref === "string" ? /^#\/\$defs\/([^/]+)$/.exec(ref)?.[1] : undefined;
  const defs = isSchema(schema.$defs) ? schema.$defs : {};
  const found = name === undefined ? undefined : defs[name];
  if (!isSchema(found))
    throw new Error(`the update schema's action ${String(ref)} does not resolve`);
  return found;
};

const names = (fields: readonly string[]): string => fields.map((name) => `\`${name}\``).join(", ");

/**
 * One line for each action of the update schema's `$defs/action`, in its order: the fields it
 * requires and those it may take, then the gloss. Throws, naming the action, on one the table
 * lacks, or whose schema holds no `action` constant.
 */
export const actionLines = (
  schema: Schema,
  glosses: Readonly<Record<string, string>> = ACTION_GLOSSES,
): string[] => {
  const root = definition(schema, "#/$defs/action");
  const branches = Array.isArray(root.oneOf) ? root.oneOf : [];
  return branches.map((branch) => {
    const ref = isSchema(branch) ? branch.$ref : undefined;
    const action = definition(schema, ref);
    const properties = isSchema(action.properties) ? action.properties : {};
    const tag = properties.action;
    const name = isSchema(tag) && typeof tag.const === "string" ? tag.const : undefined;
    if (name === undefined) {
      throw new Error(`the update schema's action ${String(ref)} has no "action" constant`);
    }
    const gloss = glosses[name];
    if (gloss === undefined) throw new Error(`the update action "${name}" has no gloss`);
    const required = (Array.isArray(action.required) ? action.required : []).filter(
      (field): field is string => typeof field === "string" && field !== "action",
    );
    const optional = Object.keys(properties).filter(
      (field) => field !== "action" && !required.includes(field),
    );
    const fields = [
      ...(required.length > 0 ? [`required: ${names(required)}`] : []),
      ...(optional.length > 0 ? [`optional: ${names(optional)}`] : []),
    ];
    return `- \`${name}\` (${fields.length === 0 ? "no fields" : fields.join("; ")}): ${gloss}`;
  });
};

const ASK_ID = "release-notes-k4m2";
const notify = { type: "toggle", id: "notify", props: { label: "Notify the team" } };

/** The three examples of the reference: an ask, a change of its question's items, a reply. */
export const UPDATE_EXAMPLES: Readonly<{
  ask: ExampleBody;
  change: ExampleBody;
  reply: ExampleBody;
}> = {
  ask: {
    kind: "ask",
    value: {
      askId: ASK_ID,
      items: [
        {
          type: "question",
          id: "release",
          props: { text: "Ship the release on Friday?", items: [notify] },
        },
      ],
    },
  },
  change: {
    kind: "update",
    value: {
      askId: ASK_ID,
      actions: [
        {
          action: "change",
          itemId: "release",
          props: {
            items: [notify, { type: "text-field", id: "reason", props: { label: "Reason" } }],
          },
        },
      ],
    },
  },
  reply: {
    kind: "update",
    value: {
      askId: ASK_ID,
      actions: [
        {
          action: "reply",
          itemId: "release",
          followUp: "k3x9w2q7.4",
          text: "Friday, once the freeze lifts.",
        },
      ],
    },
  },
};
