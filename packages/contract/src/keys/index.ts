// The key vocabulary, the matcher, the table check and the ARIA form (keyboard-shortcuts-help).

export { ariaKeyShortcuts } from "./aria.ts";
export { KEY_TABLES_ON_BOARD } from "./board.ts";
export { type KeyTableProblem, keyTableProblems } from "./check.ts";
export { changedKeyActions, effectiveKeys, sameBindings } from "./effective.ts";
export { type KeyPress, keyActionOf, type Modifiers, type PressHold, pressHold } from "./match.ts";
export {
  KEY_ACTION_MAX_CHARS,
  KEY_COMBINATION_MAX_CHARS,
  KEY_OVERRIDE_MAX_COMBINATIONS,
  KEY_OVERRIDES_MAX_ACTIONS,
  type KeyCombinationRead,
  type KeyOverrides,
  keyCombinationText,
  parseKeyCombination,
} from "./notation.ts";
export {
  KEYS_OPEN_RESERVED_KEYS,
  type KeyOverrideProblem,
  type KeyOverrideRule,
  keyExitActions,
  keyOverridesProblems,
} from "./overrides.ts";
export {
  type KeyTypes,
  REGISTERED_KEY_TABLES,
  type RegisteredKeyTable,
} from "./tables.ts";
export {
  isVocabularyAction,
  KEY_HOLDS,
  KEY_SHOWS,
  KEY_VOCABULARY,
  type KeyBinding,
  type KeyEntry,
  type KeyHold,
  type KeyShows,
  type KeyTable,
  keyBinding,
  MOD_ALT_KEYS,
  ownEntry,
  type VocabularyAction,
  type VocabularyKeys,
  vocabularyEntry,
  vocabularyLabel,
} from "./vocabulary.ts";
