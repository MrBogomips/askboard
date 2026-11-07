// The folder the session process shows for its project when the host gave none (plugin-release,
// design decision 1; packaging spec, "The start script runs outside the project"; AD-12).

import { isAbsolute } from "node:path";

const printable = (text: string): boolean =>
  [...text].every((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
  });

/**
 * The folder shown for the project when `CLAUDE_PROJECT_DIR` is unset: the directory the start
 * script was called from, which it names in `ASKBOARD_CALLER_CWD` because it runs Node in the plugin
 * root. Display only; the session project root never comes from it (AD-12). A value that is not an
 * absolute single-line path is ignored, and the working folder stands in.
 */
export const callerFolder = (
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): string => {
  const named = env.ASKBOARD_CALLER_CWD;
  return named !== undefined && isAbsolute(named) && printable(named) ? named : cwd;
};
