// The key vocabulary, the matcher, the table check and the ARIA form (keyboard-shortcuts-help).

export { ariaKeyShortcuts } from "./aria.ts";
export { keyTableProblems } from "./check.ts";
export { type KeyPress, keyActionOf, type Modifiers, type PressHold, pressHold } from "./match.ts";
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
  ownEntry,
  type VocabularyAction,
  type VocabularyKeys,
  vocabularyEntry,
  vocabularyLabel,
} from "./vocabulary.ts";
