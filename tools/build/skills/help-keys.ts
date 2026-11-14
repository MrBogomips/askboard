// The two key-configuration references of `askboard-help` (keyboard-shortcuts-help, design decision
// 20): `configure-keys.md`, where the user's overrides go and the rules they meet, and
// `key-actions.md`, every action an override may name with its default keys. Each example of
// `configure-keys.md` is checked with the overrides check, so the skill never teaches a file the
// board would refuse.

import {
  CONFIGURATION_VERSION,
  KEY_COMBINATION_MAX_CHARS,
  KEY_TABLES_ON_BOARD,
  KEYS_OPEN_RESERVED_KEYS,
  type KeyOverrides,
  keyCombinationText,
  keyExitActions,
  keyOverridesProblems,
  MOD_ALT_KEYS,
  parseKeyCombination,
  type WidgetType,
} from "@askboard/contract";
import { contractSchemaResolver, type Resolve } from "./fields.ts";
import { actionLine, actionRows, typeName } from "./keys.ts";

/** An example of the `keys` member, with what it shows. */
export type KeyExample = { readonly title: string; readonly overrides: KeyOverrides };

/** The examples `configure-keys.md` shows; the PO's own is the first. */
export const KEY_EXAMPLES: readonly KeyExample[] = [
  {
    title: "Move to the top and bottom with Ctrl+Alt (Cmd+Option on macOS), and free Select all",
    overrides: {
      "move.top": ["Mod+Alt+ArrowUp"],
      "move.bottom": ["Mod+Alt+ArrowDown"],
      "select.all": [],
    },
  },
  {
    title: "Two combinations for one action",
    overrides: { "edit.start": ["F2", "Mod+Alt+Enter"] },
  },
];

const FENCE = "```";

const SETTINGS_SCHEMA = "urn:askboard:board-protocol:settings";

/**
 * How many warnings one settings row of the board protocol holds: the most problems of a refused
 * `keys` that Settings can list (`$defs.row.properties.warnings.maxItems`). Throws when the schema
 * has no such bound.
 */
export const rowWarningsBound = (resolve: Resolve = contractSchemaResolver()): number => {
  const settings = resolve(SETTINGS_SCHEMA) as
    | { $defs?: { row?: { properties?: { warnings?: { maxItems?: unknown } } } } }
    | undefined;
  if (settings === undefined)
    throw new Error(`the board protocol has no schema ${SETTINGS_SCHEMA}`);
  const bound = settings.$defs?.row?.properties?.warnings?.maxItems;
  if (typeof bound !== "number") {
    throw new Error("the settings row's warnings have no maxItems in the board protocol schema");
  }
  return bound;
};

// Fails, naming the example and its problems, on an example the overrides check refuses or whose
// combinations do not read.
const checked = (examples: readonly KeyExample[], widgets: readonly WidgetType[]): void => {
  for (const { title, overrides } of examples) {
    const problems = keyOverridesProblems(overrides, widgets).map(
      ({ rule, action, binding }) =>
        `${rule} on ${action}${binding === undefined ? "" : ` (${binding})`}`,
    );
    for (const combination of Object.values(overrides).flat()) {
      const read = parseKeyCombination(combination);
      if (!read.ok) problems.push(`notation ${combination}: ${read.reason}`);
    }
    if (problems.length > 0) {
      throw new Error(
        `the key example "${title}" is refused by the key-override check: ${problems.join("; ")}`,
      );
    }
  }
};

// The `keys` member, one action to a line.
const keysMember = (overrides: KeyOverrides): string => {
  const lines = Object.entries(overrides).map(
    ([action, combinations]) =>
      `  ${JSON.stringify(action)}: [${combinations.map((text) => JSON.stringify(text)).join(", ")}]`,
  );
  return `"keys": {\n${lines.join(",\n")}\n}`;
};

const exampleBlock = ({ title, overrides }: KeyExample): string =>
  [`${title}:`, "", `${FENCE}json`, keysMember(overrides), FENCE].join("\n");

// `Mod+Alt` keys, written as the notation writes them.
const modAltKeys = (): string =>
  MOD_ALT_KEYS.map((key) => `\`${keyCombinationText({ key, hold: "mod+alt" })}\``).join(", ");

// The listed types by their English names, as "the Ranking", "the Ranking and the Gantt".
const reached = (widgets: readonly WidgetType[], onBoard: readonly string[]): string => {
  const names = onBoard.map((type) => {
    const entry = widgets.find((candidate) => candidate.type === type);
    return `the ${entry === undefined ? type : typeName(entry)}`;
  });
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

// What the reference says of where the user's keys reach, from the types the board gives a panel
// (review 5.6, S-31): the paragraph under "Format" and the line of "When it applies".
const reach = (widgets: readonly WidgetType[], onBoard: readonly string[]) =>
  onBoard.length === 0
    ? {
        scope:
          "The board applies them in no widget yet: no widget takes them yet, so a change has no effect on it for now.",
        applies:
          "- A change applies to boards opened afterwards; an open board may take it when it reconnects or after a change in its settings panel. No widget takes the user's keys yet, so nothing changes on the board until one does.",
      }
    : {
        scope: `A change holds only in ${reached(widgets, onBoard)}, ${onBoard.length === 1 ? "the widget" : "the widgets"} the board gives a Keys button, and in no other.`,
        applies: `- A change applies to boards opened afterwards; an open board may take it when it reconnects or after a change in its settings panel. It holds only in ${reached(widgets, onBoard)}; the keys panel (the Keys button) shows the keys in effect, with a changed action marked.`,
      };

// The sentence of `SKILL.md`'s "Read-only." line on the keys that still act on an item that takes no
// edits, from the key tables (review 7.3, S-68): the keys that move around (`cursor.*`, `toolbar.*`),
// those of a type's own that change only the view, and those that open the keys panel.
const READ_ONLY_FAMILY = (action: string): "movement" | "panel" | "view" =>
  /^(cursor|toolbar)\./.test(action) ? "movement" : action === "keys.open" ? "panel" : "view";

/** The sentence on the keys that act on a read-only item; names the types whose own keys change only the view. */
export const readOnlyKeysText = (widgets: readonly WidgetType[]): string => {
  const acting = widgets.flatMap((entry) =>
    (entry.keys ?? [])
      .filter(({ readOnly, keys }) => readOnly && keys.length > 0)
      .map(({ action }) => ({ type: entry.type, family: READ_ONLY_FAMILY(action) })),
  );
  const has = (family: string): boolean => acting.some((found) => found.family === family);
  const viewTypes = [
    ...new Set(acting.filter(({ family }) => family === "view").map(({ type }) => type)),
  ];
  const parts = [
    ...(has("movement") ? ["move around"] : []),
    ...(has("view") ? [`change only the view of ${reached(widgets, viewTypes)}`] : []),
    ...(has("panel") ? ["open a widget's keys panel"] : []),
  ];
  if (parts.length === 0) return "No key acts there.";
  const list = parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} or ${parts.at(-1)}`;
  return `Only the keys that ${list} still act there.`;
};

// The keys `keys.open` may not take with no modifier or Shift, as the notation writes them.
const openReserved = (): string =>
  [...KEYS_OPEN_RESERVED_KEYS]
    .map((key) => `\`${keyCombinationText({ key, hold: "none" })}\``)
    .join(", ");

// The exits an override may not leave with no key, from the contract.
const exitsText = (widgets: readonly WidgetType[]): string =>
  keyExitActions(widgets)
    .map((action) => `\`${action}\``)
    .join(", ");

/** `references/configure-keys.md`. Throws, naming the example, on one the check refuses. */
export const configureKeysText = (
  widgets: readonly WidgetType[],
  examples: readonly KeyExample[] = KEY_EXAMPLES,
  onBoard: readonly string[] = KEY_TABLES_ON_BOARD,
  rowBound: number = rowWarningsBound(),
): string => {
  checked(examples, widgets);
  const where = reach(widgets, onBoard);
  return [
    "# Changing the keys",
    "",
    `The user can replace or remove the keys of an action, in the user configuration file only. The board has no control for it. ${where.scope}`,
    "",
    "## Where",
    "",
    `- The file is \`$XDG_CONFIG_HOME/askboard/config.json\`, by default \`~/.config/askboard/config.json\`. The \`keys\` member sits beside \`version\` (\`"${CONFIGURATION_VERSION}"\` in a new file) and the file's other keys, which stay as they are.`,
    "- The project file `.askboard/config.json` ignores `keys`, with a warning: an agent can write that file, and an agent never chooses what a key does. Never put `keys` there.",
    "- Write the file only when the user asks you to; otherwise give them the `keys` JSON to paste. Keep `version` and every other key.",
    "",
    "## Format",
    "",
    "`keys` maps an action to the list of combinations that replace its keys, at most four. An empty list removes the keys: the tool, menu or click of the action stays. The action names are in the key-actions reference.",
    "",
    ...examples.flatMap((example) => [exampleBlock(example), ""]),
    "## Writing a combination",
    "",
    `- Modifiers, each at most once and in any order: \`Mod\` (Ctrl on Linux, Cmd on macOS), \`Alt\` (Option on macOS) and \`Shift\`, then \`+\` and the key. At most ${KEY_COMBINATION_MAX_CHARS} characters.`,
    "- The key is a key name (`ArrowUp`, `Home`, `End`, `Enter`, `Escape`, `Delete`, `Backspace`, `PageUp`, `PageDown`, `F2`), a letter, `Space`, or `?` or `%` alone. `Ctrl`, `Cmd`, `Meta` and `Option` are not modifiers here.",
    `- \`Mod+Alt\` takes only ${modAltKeys()}.`,
    "- Refused, because the browser or the system needs them: `Tab`, `F1`, `F3` to `F12`, `Mod` with any key but Z and A, `Mod+Shift` with any key but the arrows up and down and Enter, `Alt` alone (no hold has it), and a modifier on `?` or `%`.",
    "- Refused, because the system needs them: `Alt+Shift` with a letter or `Space` (macOS composes a character from it and some Linux desktops switch the keyboard layout on it).",
    "- An action an editor takes (a text field's actions) refuses a key that types a character: a letter or `Space` with no modifier or `Shift`, and a printed character.",
    `- \`keys.open\` also refuses, with no modifier or Shift, the keys a control inside a question takes: ${openReserved()}; and any key that another action of a widget takes, since it acts across the whole question.`,
    "- Two actions of one part of a widget cannot share a key once the changes apply, and an exit cannot be left with no key (" +
      exitsText(widgets) +
      ").",
    "- An action whose keys a control takes by itself (marked in the list) cannot be changed.",
    "",
    "## When it applies",
    "",
    `- Any problem refuses the whole \`keys\`: every widget keeps its default keys. The session's stderr lists the problems found at its first read of the file, and Settings those found when a board opens (up to ${rowBound}). Fix the file; there is no partial change.`,
    where.applies,
  ].join("\n");
};

/** `references/key-actions.md`: every action an override may name, with its default keys. */
export const keyActionsText = (widgets: readonly WidgetType[]): string =>
  [
    "# Actions and their default keys",
    "",
    "Each action an override may name, with its default keys on Linux and, in brackets, on macOS. Where it acts depends on the widget: a widget lists the actions it binds in its own reference.",
    "",
    ...actionRows(widgets).map(actionLine),
  ].join("\n");
