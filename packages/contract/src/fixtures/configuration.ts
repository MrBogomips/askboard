// A configuration file holding every key once, each with a valid value (settings-languages task
// 1.1), in the schema's order.

import { CONFIGURATION_VERSION, type Configuration } from "../schemas/configuration/index.ts";

export const everyKeyConfiguration: Configuration = {
  version: CONFIGURATION_VERSION,
  theme: "dark",
  density: "comfortable",
  contextPlacement: "inline",
  defaultLanguage: "it-IT",
  askingRule: "with-references",
  snapshotFolder: "docs/snapshots",
  editor: ["code", "--goto", "{file}:{line}"],
  defaultMinimumMargin: 18.5,
};
