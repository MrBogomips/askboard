// The conformance runner's options (task 9.2): which runtime runs the session process and which
// view build it serves, and AD-19's Node floor.

export type RunOptions = { readonly runtime: "bun" | "node"; readonly view: "dist" | "fixture" };

const USAGE = "usage: run.ts --runtime bun|node [--view dist|fixture]";

/** The runner's options, or why they are refused. */
export const parseOptions = (args: readonly string[]): RunOptions | { readonly error: string } => {
  let runtime: string | undefined;
  let view = "dist";
  for (let at = 0; at < args.length; at += 2) {
    const [name, value] = [args[at], args[at + 1]];
    if (name === "--runtime" && value !== undefined) runtime = value;
    else if (name === "--view" && value !== undefined) view = value;
    else return { error: `${USAGE}: unexpected ${name ?? "end"}` };
  }
  if (runtime !== "bun" && runtime !== "node") return { error: `${USAGE}: name the runtime` };
  if (view !== "dist" && view !== "fixture") return { error: `${USAGE}: unknown view ${view}` };
  return { runtime, view };
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
