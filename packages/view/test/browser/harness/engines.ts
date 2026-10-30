// The engines the browser tests run in (design decision 11). `ASKBOARD_E2E_ENGINES` narrows a run
// to some of them, as the runner does to run each engine in its own process.

export const ENGINES = ["chromium", "firefox", "webkit"] as const;

export type Engine = (typeof ENGINES)[number];

const isEngine = (name: string): name is Engine => (ENGINES as readonly string[]).includes(name);

/** The engines a comma-separated list names, in the harness's order; all of them when it is empty. */
export const enginesFrom = (value: string | undefined): Engine[] => {
  const names = (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  if (names.length === 0) return [...ENGINES];
  for (const name of names) {
    if (!isEngine(name)) {
      throw new Error(`unknown engine "${name}" in ASKBOARD_E2E_ENGINES: ${ENGINES.join(", ")}`);
    }
  }
  return ENGINES.filter((engine) => names.includes(engine));
};
