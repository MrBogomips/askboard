// What the board page tells the view of the presentation (settings-languages, design decision 10):
// the theme, density and context placement in effect, and the keys the project fixes, which the
// board's toggles show read-only. Read from the settings `board-host` sends, a checked message.

import { PRESENTATION_KEYS, type PresentationKey, type SettingsMessage } from "@askboard/contract";
import type { ViewPresentation } from "../view-protocol.ts";

/** The presentation a settings message gives: each key's value in effect, and the fixed ones. */
export const presentationOf = (message: SettingsMessage): ViewPresentation => {
  const { theme, density, contextPlacement } = message.keys;
  const locked = PRESENTATION_KEYS.filter((key: PresentationKey) => !message.keys[key].writable);
  return {
    theme: theme.value ?? "system",
    density: density.value ?? "compact",
    contextPlacement: contextPlacement.value ?? "beside",
    locked,
  };
};
