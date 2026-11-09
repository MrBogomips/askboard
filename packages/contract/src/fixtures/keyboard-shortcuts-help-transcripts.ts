// The settings messages that carry the user's key overrides, and a transcript of them
// (keyboard-shortcuts-help, task 8.5; design decision 19), built on the settings fixtures of
// settings-languages: the row from the user file, the row of overrides that did not apply, the
// project's keys ignored, and the exchange board-host's tests replay.

import {
  BOARD_PROTOCOL_VERSION,
  type SettingCommand,
  type SettingsMessage,
} from "../schemas/board-protocol/index.ts";
import { keyOverridesExample } from "./keyboard-shortcuts-help.ts";
import { LIFECYCLE } from "./lifecycle.ts";
import { lifecycleBoard, lifecycleWaiting } from "./lifecycle-messages.ts";
import { type SettingsTranscriptStep, settingsWithEveryKey } from "./settings.ts";

const version = BOARD_PROTOCOL_VERSION;

/** The settings with every key and the user's overrides from the user file. */
export const settingsWithKeys: SettingsMessage = {
  ...settingsWithEveryKey,
  version,
  keys: {
    ...settingsWithEveryKey.keys,
    keys: { value: keyOverridesExample, from: "user", writable: false },
  },
};

/** The user's overrides refused by the check: every key is the default, and the warning says why. */
export const settingsKeysNotApplied: SettingsMessage = {
  ...settingsWithEveryKey,
  version,
  keys: {
    ...settingsWithEveryKey.keys,
    keys: {
      from: "default",
      writable: false,
      warnings: [
        {
          code: "keys-not-applied",
          file: "user",
          key: "keys",
          rule: "conflict",
          action: "move.top",
          binding: "Alt+Shift+ArrowUp",
          with: "move.up",
        },
      ],
    },
  },
};

/** A project file that sets `keys`: ignored, with its warning among the message's. */
export const settingsKeysIgnored: SettingsMessage = {
  ...settingsWithEveryKey,
  version,
  keys: { ...settingsWithEveryKey.keys, keys: { from: "default", writable: false } },
  warnings: [{ code: "project-keys-ignored", file: "project", key: "keys" }],
};

/** The board writes the density: a presentation key, as the previous minor allowed. */
export const densitySetting: SettingCommand = {
  version,
  type: "setting",
  key: "density",
  value: "comfortable",
};

/** The settings after that write: the keys row unchanged, the write saved. */
export const settingsKeysSaved: SettingsMessage = {
  ...settingsWithKeys,
  keys: {
    ...settingsWithKeys.keys,
    density: { value: "comfortable", from: "user", writable: true },
  },
  write: { key: "density", outcome: "saved" },
};

/** Connect, the settings with the user's keys before the board, a write of the density, the settings saved. */
export const keyboardKeysTranscript: {
  readonly askId: string;
  readonly token: string;
  readonly steps: readonly SettingsTranscriptStep[];
} = {
  askId: LIFECYCLE.askId,
  token: LIFECYCLE.token,
  steps: [
    { socket: 1, from: "page", message: { version, type: "connect", token: LIFECYCLE.token } },
    { socket: 1, from: "host", message: settingsWithKeys },
    { socket: 1, from: "host", message: lifecycleBoard },
    { socket: 1, from: "host", message: lifecycleWaiting },
    { socket: 1, from: "page", message: densitySetting },
    { socket: 1, from: "host", message: settingsKeysSaved },
  ],
};
