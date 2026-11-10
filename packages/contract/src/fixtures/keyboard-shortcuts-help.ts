// The user's key overrides, for the configuration and the settings tests (keyboard-shortcuts-help,
// tasks 8.4 and 8.5).

import type { KeyOverrides } from "../keys/notation.ts";

/** The PO's example (Issue #81): to the top and to the bottom on Mod+Alt, and select all with no key. */
export const keyOverridesExample: KeyOverrides = {
  "move.top": ["Mod+Alt+ArrowUp"],
  "move.bottom": ["Mod+Alt+ArrowDown"],
  "select.all": [],
};
