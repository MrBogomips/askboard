// The two key-configuration references of `askboard-help` (keyboard-shortcuts-help, design decision
// 20): `configure-keys.md`, where the user's overrides go and the rules they meet, and
// `key-actions.md`, every action an override may name with its default keys. Each example of
// `configure-keys.md` is checked with the overrides check, so the skill never teaches a file the
// board would refuse.

import {
  CONFIGURATION_VERSION,
  KEY_COMBINATION_MAX_CHARS,
  type KeyOverrides,
  keyCombinationText,
  keyOverridesProblems,
  MOD_ALT_KEYS,
  parseKeyCombination,
  type WidgetType,
} from "@askboard/contract";
import { actionLine, actionRows } from "./keys.ts";

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
    overrides: { "edit.start": ["Enter", "F2", "Mod+Shift+Enter"] },
  },
];

const FENCE = "```";

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

/** `references/configure-keys.md`. Throws, naming the example, on one the check refuses. */
export const configureKeysText = (
  widgets: readonly WidgetType[],
  examples: readonly KeyExample[] = KEY_EXAMPLES,
): string => {
  checked(examples, widgets);
  return [
    "# Changing the keys",
    "",
    "The user can replace or remove the keys of an action, in the user configuration file only. A change holds in every widget that has the action. The board has no control for it.",
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
    "- Two actions of one part of a widget cannot share a key once the changes apply, and an exit cannot be left with no key (`edit.cancel`, and the Tree's `tree.cancelDelete` and `tree.cancelGroup`).",
    "- An action whose keys a control takes by itself (marked in the list) cannot be changed.",
    "",
    "## When it applies",
    "",
    "- Any problem refuses the whole `keys`: every widget keeps its default keys, Settings shows each problem and the session's stderr lists it. Fix the file; there is no partial change.",
    "- A change applies to the next board opened, not to one already open, and in the widgets with a Keys button; the keys panel shows the keys in effect, with a changed action marked.",
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
