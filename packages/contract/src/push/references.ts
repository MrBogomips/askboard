// What counts as a reference for the asking rule `with-references` (AD-16, FR-30; settings-languages
// design decision 12, open question A5). The hook's predicate and the skills' wording both read it
// from here, so the skills describe the rule the hook applies. E4's `asking-rules.ts` joins this
// folder on its merge.

// A path character, which a pointer may not start right after: a pointer is a whole relative path.
const NOT_INSIDE_A_PATH = String.raw`(?<![\w./~:@-])`;
const FOLDERS = String.raw`(?:[\w.-]+/)+`;
// A file name ends in an extension that starts with a letter, so a version or 1.5 is none.
const FILE_NAME = String.raw`[\w.-]*\.[A-Za-z][A-Za-z0-9]*`;
const ANCHOR_OR_LINE = String.raw`(?:#[\w-]+|:[0-9]+)`;

/** The two kinds of reference, neither global nor sticky, so a test keeps no state. */
export const REFERENCE_PATTERNS = {
  /** An `http:` or `https:` URL with a host. */
  url: /\bhttps?:\/\/[^\s/?#<>"'`]+/i,
  /**
   * A relative path ending in a file extension that holds a `/` (`src/retry.ts`), or is followed by
   * `#` and an anchor (`README.md#Install`) or by `:` and a line (`app.py:12`).
   */
  pointer: new RegExp(
    `${NOT_INSIDE_A_PATH}(?:${FOLDERS}${FILE_NAME}|${FILE_NAME}${ANCHOR_OR_LINE})`,
  ),
} as const;

/** Whether a text holds a URL or a project-file pointer. */
export const hasReference = (text: string): boolean =>
  REFERENCE_PATTERNS.url.test(text) || REFERENCE_PATTERNS.pointer.test(text);

/** The rule in one line, for the skills that describe it to agents. */
export const WITH_REFERENCES_DESCRIPTION =
  "An AskUserQuestion call goes to AskBoard when a question, header, option label, description or preview holds an http: or https: URL, or a project-file pointer: a relative path ending in a file extension that holds a / (src/retry.ts) or is followed by # and an anchor (README.md#Install) or by : and a line (app.py:12).";
