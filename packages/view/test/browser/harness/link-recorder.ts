// How the session-process target sees the board open (board-host spec, "Opening a board in the
// browser"): `BROWSER` names `fixtures/record-link.sh`, which appends each call's arguments to the
// file `ASKBOARD_E2E_LINKS` names. The target checks that the opener ran once per ask with the
// ask result's link as its one argument, as the conformance suite does (design decision 11).

import { join } from "node:path";

/** The recorder script `BROWSER` names. */
export const LINK_RECORDER = join(import.meta.dir, "..", "fixtures", "record-link.sh");

/** The variable naming the file the recorder appends to. */
export const LINKS_VARIABLE = "ASKBOARD_E2E_LINKS";

/** One start of the opener: how many arguments it was given, and those arguments. */
export type OpenedLink = { readonly args: number; readonly link: string };

/** The recorder's lines, one call each. */
export const parseOpened = (text: string): OpenedLink[] =>
  text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const tab = line.indexOf("\t");
      return { args: Number(line.slice(0, tab)), link: line.slice(tab + 1) };
    });

/** Every call recorded in the file so far; none before the first. */
export const readOpened = async (file: string): Promise<OpenedLink[]> => {
  const recorded = Bun.file(file);
  return (await recorded.exists()) ? parseOpened(await recorded.text()) : [];
};

/**
 * The calls once there are at least `count`. The session process opens the board after it has
 * returned the ask's result (SOLUTION-DESIGN §5.1), so the call may come a moment later.
 */
export const waitForOpened = async (
  file: string,
  count: number,
  timeoutMs: number,
): Promise<OpenedLink[]> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const opened = await readOpened(file);
    if (opened.length >= count) return opened;
    if (Date.now() > deadline) {
      throw new Error(
        `the session process opened ${opened.length} board(s) through BROWSER within ${timeoutMs / 1000} s, not ${count}`,
      );
    }
    await Bun.sleep(20);
  }
};
