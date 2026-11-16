// What the board page tells the view of the presentation (settings-languages, design decision 10;
// answering-flow-guidance, design decision 9): the theme, density, context placement and
// after-answer setting in effect, and the keys the project fixes, which the board's controls show
// read-only. Read from the settings `board-host` sends, a checked message.

import { PRESENTATION_KEYS, type SettingsMessage } from "@askboard/contract";
import type { ViewPresentation } from "../view-protocol.ts";

/** The presentation a settings message gives: each key's value in effect, and the fixed ones. */
export const presentationOf = (message: SettingsMessage): ViewPresentation => {
  const { theme, density, contextPlacement, afterAnswer, palette } = message.keys;
  const locked = PRESENTATION_KEYS.filter((key) => message.keys[key]?.writable === false);
  return {
    theme: theme.value ?? "system",
    density: density.value ?? "compact",
    contextPlacement: contextPlacement.value ?? "beside",
    afterAnswer: afterAnswer?.value ?? "next",
    palette: palette?.value ?? "carta",
    locked,
  };
};
