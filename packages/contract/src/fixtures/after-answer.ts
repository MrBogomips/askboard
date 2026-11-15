// The after-answer presentation key (answering-flow-guidance, task 1.1, design decision 9): a
// configuration file holding every key, a board's write of the key, and the settings in effect
// with its row.

import {
  BOARD_PROTOCOL_VERSION,
  type SettingCommand,
  type SettingsMessage,
} from "../schemas/board-protocol/index.ts";
import { CONFIGURATION_VERSION, type Configuration } from "../schemas/configuration/index.ts";
import { keyOverridesExample } from "./keyboard-shortcuts-help.ts";
import { settingsWithEveryKey } from "./settings.ts";

/** Every key of the configuration once, `afterAnswer` after `contextPlacement`. */
export const afterAnswerConfiguration: Configuration = {
  version: CONFIGURATION_VERSION,
  theme: "dark",
  density: "comfortable",
  contextPlacement: "inline",
  afterAnswer: "stay",
  defaultLanguage: "it-IT",
  askingRule: "with-references",
  snapshotFolder: "docs/snapshots",
  editor: ["code", "--goto", "{file}:{line}"],
  defaultMinimumMargin: 18.5,
  keys: keyOverridesExample,
};

/** The board picks Stay here. */
export const afterAnswerSetting: SettingCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "setting",
  key: "afterAnswer",
  value: "stay",
};

/** The settings in effect with the after-answer row, from the user file. */
export const settingsWithAfterAnswer: SettingsMessage = {
  ...settingsWithEveryKey,
  version: BOARD_PROTOCOL_VERSION,
  keys: {
    ...settingsWithEveryKey.keys,
    afterAnswer: { value: "stay", from: "user", writable: true },
  },
};

/** The settings after that write: the row from the user file, and the write saved. */
export const afterAnswerSaved: SettingsMessage = {
  ...settingsWithAfterAnswer,
  write: { key: "afterAnswer", outcome: "saved" },
};
