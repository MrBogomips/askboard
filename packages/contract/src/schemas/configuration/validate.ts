// Validates a configuration file (settings-languages design decision 2): an unsupported major first,
// then the schema. `src/validate.ts` re-exports this module, which imports from it: the cycle is
// safe because neither module makes a call at its top level.

import { schemaErrors } from "../../compiled.ts";
import { SCHEMA_IDS } from "../../sets.ts";
import { type Checked, validateVersioned } from "../../validate.ts";
import type { FileProblem } from "../board-protocol/index.ts";
import { type Configuration, configurationSet } from "./index.ts";

/** Validates a parsed configuration file; `reason` is `version` for a major other than 1. */
export const validateConfiguration = (value: unknown): Checked<Configuration> =>
  validateVersioned<Configuration>(configurationSet, SCHEMA_IDS.configuration, value);

/**
 * Why a parsed configuration file is not applied, for ask-core's diagnostic and the settings panel:
 * a major other than 1, else the first schema failure's JSON pointer and Ajv's keyword. Undefined
 * when the file applies. Neither names a value, so an `editor` never reaches a diagnostic. The
 * pointer may hold a name from the file (the property that failed, under `keys` or any other
 * object), so every sink shows it through `quoteFileText` or `escapeFileText`, never raw
 * (keyboard-shortcuts-help, review 8.6, X-1).
 */
export const configurationProblem = (value: unknown): FileProblem | undefined => {
  const checked = validateConfiguration(value);
  if (checked.ok) return undefined;
  const [first] = checked.problems;
  if (checked.reason === "version") return { code: "version", pointer: "/version" };
  const [error] = schemaErrors(SCHEMA_IDS.configuration, value);
  return { code: "schema", pointer: first?.path, keyword: error?.keyword };
};
