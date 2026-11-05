// Visible markers for the controls that could change what the user reads (excerpts, design
// decision 6; view spec, "Bidirectional controls are visible"; DESIGN.md, Agent-written labels):
// the bidirectional controls of the board header's rule, and NUL, each shown as its `\uXXXX`
// escape, as the source view shows them (`server/src/board-host/source-view.ts`). Every other
// character, a tab included, stays as written. Plain ECMAScript.

const MARKED: ReadonlySet<number> = new Set([
  0x0000, 0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
  0x2069,
]);

/** A run of text: as written, or one marked control as its escape. */
export type TextRun = { readonly text: string; readonly mark: boolean };

const escapeOf = (code: number): string => `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;

/** The text as runs, each marked control a run of its own, the plain text between joined. */
export const markedRuns = (text: string): TextRun[] => {
  const runs: TextRun[] = [];
  let plain = "";
  for (const point of text) {
    const code = point.codePointAt(0) ?? 0;
    if (!MARKED.has(code)) {
      plain += point;
      continue;
    }
    if (plain !== "") runs.push({ text: plain, mark: false });
    plain = "";
    runs.push({ text: escapeOf(code), mark: true });
  }
  if (plain !== "") runs.push({ text: plain, mark: false });
  return runs;
};

/** The text as one string, each marked control as its escape: for a tooltip or a title. */
export const markedString = (text: string): string =>
  markedRuns(text)
    .map((run) => run.text)
    .join("");
