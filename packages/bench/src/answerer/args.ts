// The answerers' entries take `--plan <file> --records <file>` and, for the board answerer, the
// link. They are started by browser.sh, the run's settings and its mcp.json, never by hand.

export type EntryArgs = {
  readonly plan: string | undefined;
  readonly records: string | undefined;
  readonly positional: readonly string[];
};

export const entryArgs = (argv: readonly string[]): EntryArgs => {
  const values = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    const value = argv[index + 1];
    if ((argument === "--plan" || argument === "--records") && value !== undefined) {
      values.set(argument, value);
      index += 1;
    } else {
      positional.push(argument);
    }
  }
  return { plan: values.get("--plan"), records: values.get("--records"), positional };
};
