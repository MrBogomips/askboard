// The configuration (owner `ask-core`, AD-14; settings-languages design decision 2): one schema for
// the user file and the project file. `ask-core` is the one reader: it validates each file, merges
// them key by key and applies the rules a schema cannot say.

import type { SchemaSet } from "../../versions.ts";
import config from "./config.json" with { type: "json" };

export const CONFIGURATION_VERSION = "1.0";

export const configurationSet: SchemaSet = {
  name: "configuration",
  title: "configuration",
  owner: "ask-core",
  version: CONFIGURATION_VERSION,
  schemas: [config],
};

/** The keys a board may write into the user file; every other key is read-only on a board. */
export const PRESENTATION_KEYS = ["theme", "density", "contextPlacement"] as const;

/** AD-14's keys, in the schema's order: the presentation keys, then the behaviour keys. */
export const CONFIGURATION_KEYS = [
  ...PRESENTATION_KEYS,
  "defaultLanguage",
  "askingRule",
  "snapshotFolder",
  "editor",
  "defaultMinimumMargin",
] as const;

export type PresentationKey = (typeof PRESENTATION_KEYS)[number];
export type ConfigurationKey = (typeof CONFIGURATION_KEYS)[number];

export type ThemePreference = "system" | "light" | "dark";
export type Density = "compact" | "comfortable";
export type ContextPlacement = "beside" | "inline";

/** Each known key's value. */
export type ConfigurationValues = {
  readonly theme: ThemePreference;
  readonly density: Density;
  readonly contextPlacement: ContextPlacement;
  readonly defaultLanguage: "en-US" | "it-IT";
  /** E4's asking rules (AD-16). */
  readonly askingRule: "none" | "always" | "with-references";
  /** Relative to the session project root; `ask-core` checks that it stays inside. */
  readonly snapshotFolder: string;
  /** The program, then its arguments; only `{file}` and `{line}` are replaced (AD-8). */
  readonly editor: readonly string[];
  /** A percentage, read by the sales molecule's epic (open question B14). */
  readonly defaultMinimumMargin: number;
};

/**
 * A configuration file that passed its schema: its version and any known key. A key this minor does
 * not define passes too, and the reader warns on it (B2).
 */
export type Configuration = { readonly version: string } & Partial<ConfigurationValues> & {
    readonly [key: string]: unknown;
  };

/** Each key's value when neither file sets it; no editor and no minimum margin by default. */
export const CONFIGURATION_DEFAULTS = {
  theme: "system",
  density: "compact",
  contextPlacement: "beside",
  defaultLanguage: "en-US",
  askingRule: "none",
  snapshotFolder: ".askboard/snapshots",
} as const satisfies Omit<ConfigurationValues, "editor" | "defaultMinimumMargin">;
