// The settings messages of board protocol 1.3 (settings-languages, design decision 6), on the
// lifecycle ask: the settings in effect with every key, a board's write of the theme, and the
// exchange board-host's tests replay, with `settings` before the board (task 5.1).

import {
  BOARD_PROTOCOL_VERSION,
  type ConnectMessage,
  type LifecycleHostMessage,
  type SettingCommand,
  type SettingsMessage,
} from "../schemas/board-protocol/index.ts";
import { LIFECYCLE } from "./lifecycle.ts";
import { lifecycleBoard, lifecycleWaiting } from "./lifecycle-messages.ts";

const version = BOARD_PROTOCOL_VERSION;

/**
 * Every key with its row: values from the user file, the project file and the defaults, a value
 * both files set, a project editor ignored, a replaced Snapshot folder and an unknown key.
 */
export const settingsWithEveryKey: SettingsMessage = {
  version,
  type: "settings",
  keys: {
    theme: { value: "dark", from: "user", writable: true },
    density: { value: "compact", from: "default", writable: true },
    contextPlacement: {
      value: "inline",
      from: "project",
      writable: false,
      other: { file: "user", value: "beside" },
    },
    defaultLanguage: { value: "it-IT", from: "project", writable: false },
    askingRule: { value: "with-references", from: "project", writable: false },
    snapshotFolder: {
      value: ".askboard/snapshots",
      from: "default",
      writable: false,
      warnings: [
        { code: "snapshot-folder-replaced", file: "project", key: "snapshotFolder", value: "../x" },
      ],
    },
    editor: {
      value: ["code", "--goto", "{file}:{line}"],
      from: "user",
      writable: false,
      warnings: [{ code: "project-editor-ignored", file: "project", key: "editor" }],
    },
    defaultMinimumMargin: { from: "default", writable: false },
  },
  files: {
    user: { path: "~/.config/askboard/config.json", status: "applied" },
    project: { path: ".askboard/config.json", status: "applied" },
  },
  warnings: [{ code: "unknown-key", file: "user", key: "fontSize" }],
};

/** The board picks Light. */
export const themeSetting: SettingCommand = {
  version,
  type: "setting",
  key: "theme",
  value: "light",
};

/** The settings after that write: the theme from the user file, and the write saved. */
export const settingsSaved: SettingsMessage = {
  ...settingsWithEveryKey,
  keys: { ...settingsWithEveryKey.keys, theme: { value: "light", from: "user", writable: true } },
  write: { key: "theme", outcome: "saved" },
};

/** One valid message of each type protocol 1.3 adds, in each direction. */
export const settingsProtocolExamples: {
  readonly toHost: readonly SettingCommand[];
  readonly toPage: readonly SettingsMessage[];
} = { toHost: [themeSetting], toPage: [settingsWithEveryKey, settingsSaved] };

/** A step of the settings transcript: E1's kinds of step, with the settings messages. */
export type SettingsTranscriptStep =
  | { readonly socket: number; readonly from: "page"; readonly message: ConnectMessage }
  | { readonly socket: number; readonly from: "page"; readonly message: SettingCommand }
  | {
      readonly socket: number;
      readonly from: "host";
      readonly message: LifecycleHostMessage | SettingsMessage;
    };

/** Connect, the settings before the board and its state, a write of the theme, the settings saved. */
export const settingsTranscript: {
  readonly askId: string;
  readonly token: string;
  readonly steps: readonly SettingsTranscriptStep[];
} = {
  askId: LIFECYCLE.askId,
  token: LIFECYCLE.token,
  steps: [
    { socket: 1, from: "page", message: { version, type: "connect", token: LIFECYCLE.token } },
    { socket: 1, from: "host", message: settingsWithEveryKey },
    { socket: 1, from: "host", message: lifecycleBoard },
    { socket: 1, from: "host", message: lifecycleWaiting },
    { socket: 1, from: "page", message: themeSetting },
    { socket: 1, from: "host", message: settingsSaved },
  ],
};
