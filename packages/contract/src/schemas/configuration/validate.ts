// Validates a configuration file (settings-languages design decision 2): an unsupported major first,
// then the schema. `src/validate.ts` re-exports this module, which imports from it: the cycle is
// safe because neither module makes a call at its top level.

import { SCHEMA_IDS } from "../../sets.ts";
import { type Checked, validateVersioned } from "../../validate.ts";
import { type Configuration, configurationSet } from "./index.ts";

/** Validates a parsed configuration file; `reason` is `version` for a major other than 1. */
export const validateConfiguration = (value: unknown): Checked<Configuration> =>
  validateVersioned<Configuration>(configurationSet, SCHEMA_IDS.configuration, value);
