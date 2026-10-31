// The conformance runner's options (task 9.2): which runtime runs the session process, and AD-19's
// Node floor. The session process always serves the real view build, `dist/view/`.

export type RunOptions = { readonly runtime: "bun" | "node" };

const USAGE = "usage: run.ts --runtime bun|node";

/** The runner's options, or why they are refused. */
export const parseOptions = (args: readonly string[]): RunOptions | { readonly error: string } => {
  let runtime: string | undefined;
  for (let at = 0; at < args.length; at += 2) {
    const [name, value] = [args[at], args[at + 1]];
    if (name === "--runtime" && value !== undefined) runtime = value;
    else return { error: `${USAGE}: unexpected ${name ?? "end"}` };
  }
  if (runtime !== "bun" && runtime !== "node") return { error: `${USAGE}: name the runtime` };
  return { runtime };
};

const NODE_FLOOR = [24, 22, 1] as const;

/** Whether a Node version, as `node --version` prints it, is AD-19's floor or later. */
export const meetsNodeFloor = (version: string): boolean => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) return false;
  const parts = match.slice(1).map(Number);
  for (const [at, floor] of NODE_FLOOR.entries()) {
    const part = parts[at] ?? 0;
    if (part !== floor) return part > floor;
  }
  return true;
};
