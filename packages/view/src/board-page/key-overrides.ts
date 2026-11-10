// The user's key overrides the board page passes on to the view (keyboard-shortcuts-help, design
// decision 19; review 8.6): the `value` of the settings' `keys` row, only when the row is from the
// user file and the contract's key-override check, the one `ask-core` ran, finds nothing in it, so
// the view applies all of the overrides or none (NFR-10; AD-14). Never the row's `other`: a project
// file's keys never apply, and the schema refuses them on the wire.

import { type KeyOverrides, keyOverridesProblems, type SettingsMessage } from "@askboard/contract";

/**
 * The overrides a settings message gives the view, the row's own value as it is (never copied key
 * by key), or undefined: no `keys` row, a row from the default or the project, a row with no value,
 * or a value the check refuses, which a message built past `ask-core` could carry.
 */
export const keysOf = (message: SettingsMessage): KeyOverrides | undefined => {
  const row = message.keys.keys;
  if (row === undefined || row.from !== "user" || row.value === undefined) return undefined;
  return keyOverridesProblems(row.value).length === 0 ? row.value : undefined;
};
