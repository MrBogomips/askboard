// The palette key (palettes, task 1.1, design decision D1): a configuration file holding every key,
// a board's write of the key, and the settings in effect with its row.

import {
  BOARD_PROTOCOL_VERSION,
  type SettingCommand,
  type SettingsMessage,
} from "../schemas/board-protocol/index.ts";
import { CONFIGURATION_VERSION, type Configuration } from "../schemas/configuration/index.ts";
import { keyOverridesExample } from "./keyboard-shortcuts-help.ts";
import { settingsWithEveryKey } from "./settings.ts";

/** Every key of the configuration once, `palette` after `afterAnswer`. */
export const palettesConfiguration: Configuration = {
  version: CONFIGURATION_VERSION,
  theme: "dark",
  density: "comfortable",
  contextPlacement: "inline",
  afterAnswer: "stay",
  palette: "grafite",
  defaultLanguage: "it-IT",
  askingRule: "with-references",
  snapshotFolder: "docs/snapshots",
  editor: ["code", "--goto", "{file}:{line}"],
  defaultMinimumMargin: 18.5,
  keys: keyOverridesExample,
};

/** The board picks Nordico here. */
export const palettesSetting: SettingCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "setting",
  key: "palette",
  value: "nordico",
};

/** The settings in effect with the palette row, from the user file. */
export const settingsWithPalette: SettingsMessage = {
  ...settingsWithEveryKey,
  version: BOARD_PROTOCOL_VERSION,
  keys: {
    ...settingsWithEveryKey.keys,
    palette: { value: "nordico", from: "user", writable: true },
  },
};

/** The settings after that write: the row from the user file, and the write saved. */
export const palettesSaved: SettingsMessage = {
  ...settingsWithPalette,
  write: { key: "palette", outcome: "saved" },
};
