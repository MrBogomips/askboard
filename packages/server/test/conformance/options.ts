// The conformance runner's options (task 9.2): which runtime runs the session process, AD-19's Node
// floor, and which of AD-1's configurations run (push delivery, task 9.5): all three unless one is
// named. The session process always serves the real view build, `dist/view/`.

/** AD-1's configurations, in the order the runner runs them. */
export const CONFIGURATIONS = ["mod-and-hooks", "mod-disabled", "hooks-disabled"] as const;
export type Configuration = (typeof CONFIGURATIONS)[number];

export type RunOptions = {
  readonly runtime: "bun" | "node";
  readonly configurations: readonly Configuration[];
};

const USAGE = `usage: run.ts --runtime bun|node [--configuration ${CONFIGURATIONS.join("|")}]`;

/** The configuration a name gives, if it names one. */
export const configurationNamed = (name: string | undefined): Configuration | undefined =>
  CONFIGURATIONS.find((configuration) => configuration === name);

/** The runner's options, or why they are refused. */
export const parseOptions = (args: readonly string[]): RunOptions | { readonly error: string } => {
  let runtime: string | undefined;
  let configuration: Configuration | undefined;
  for (let at = 0; at < args.length; at += 2) {
    const [name, value] = [args[at], args[at + 1]];
    if (name === "--runtime" && value !== undefined) runtime = value;
    else if (name === "--configuration" && configurationNamed(value) !== undefined) {
      configuration = configurationNamed(value);
    } else return { error: `${USAGE}: unexpected ${name ?? "end"}` };
  }
  if (runtime !== "bun" && runtime !== "node") return { error: `${USAGE}: name the runtime` };
  return {
    runtime,
    configurations: configuration === undefined ? CONFIGURATIONS : [configuration],
  };
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
