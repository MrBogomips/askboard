// Settings on the board protocol (settings-languages, design decision 6): the `settings` message a
// board receives, built from ask-core's settings view, and the text of a write this session cannot
// take.

import { BOARD_PROTOCOL_VERSION, type SettingsMessage } from "@askboard/contract";
import type { SettingsView } from "@askboard/core";

/** The refusal's detail when ask-core has no settings part to write through. */
export const NO_SETTINGS = "this session takes no settings";

/** The settings in effect for a board, with a write's outcome after one. */
export const settingsMessage = (view: SettingsView): SettingsMessage => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "settings",
  ...view,
});
