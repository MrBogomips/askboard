// Which loads a `bun drive.ts <run>` makes: defaults by run name, then the flags.
// IronCalc's documents run under both board-page policies where the run asks for it: AD-8 as
// written (`as-written`) and with `'wasm-unsafe-eval'` in the board page's policy too (`wasm`),
// because the srcdoc inherits the board page's policy [F29].

export type LoadSpec = {
  label: string;
  doc: string;
  mode: string;
  board: string;
  snapshot: boolean;
  viewWasm?: boolean;
  csp?: boolean;
  repeats?: number;
  /** A negative control: what must fail, in words. */
  expectFailure?: string;
};

type Preset = { docs: string[]; mode: string; repeat: number; snapshot: boolean; ironcalcBoards: string[] };

export function presetFor(run: string): Preset {
  const base: Preset = { docs: ["own", "ironcalc"], mode: "smoke", repeat: 1, snapshot: false, ironcalcBoards: ["as-written", "wasm"] };
  if (run === "c1-snapshot") return { ...base, mode: "suite", snapshot: true };
  if (run.startsWith("c1")) return { ...base, mode: "suite" };
  if (run.startsWith("c3")) return { ...base, docs: ["none", "own", "ironcalc"], mode: "timing", repeat: 20, ironcalcBoards: ["wasm"] };
  if (run.startsWith("c4")) return { ...base, mode: "latency", ironcalcBoards: ["wasm"] };
  if (run.startsWith("c5")) return { ...base, mode: "suite", ironcalcBoards: ["wasm"] };
  return base;
}

type Options = { run: string; docs: string[]; mode: string; snapshot: boolean; board?: string; boardFlag?: boolean; viewWasm?: string; latencyRepeats: number };

function negativeControls(): LoadSpec[] {
  const noWasm = "the IronCalc module does not compile: the view's policy lacks 'wasm-unsafe-eval'";
  const asyncLoader = "init() with no bytes: the fetch of wasm_bg.wasm is blocked by connect-src 'none', nothing reaches the server";
  return [
    // The board page allows WebAssembly, so only the view's own policy can refuse it.
    { label: "ironcalc noViewWasm board-wasm", doc: "ironcalc", mode: "smoke", board: "wasm", snapshot: false, viewWasm: false, expectFailure: noWasm },
    // A Snapshot has only the view's policy.
    { label: "ironcalc noViewWasm snapshot", doc: "ironcalc", mode: "smoke", board: "-", snapshot: true, viewWasm: false, expectFailure: noWasm },
    { label: "ironcalc-async board-wasm", doc: "ironcalc-async", mode: "async-loader", board: "wasm", snapshot: false, expectFailure: asyncLoader },
    { label: "ironcalc-async snapshot", doc: "ironcalc-async", mode: "async-loader", board: "-", snapshot: true, expectFailure: asyncLoader },
    // The recorders' own control: with no policy, the same loader's request must be seen.
    { label: "ironcalc-async no-csp", doc: "ironcalc-async", mode: "async-loader", board: "-", snapshot: false, csp: false, expectFailure: "control of the recorders: the request is seen and reaches the server" },
  ];
}

export function loadSpecs(options: Options): LoadSpec[] {
  if (options.run.startsWith("c1-negative")) return negativeControls();
  const preset = presetFor(options.run);
  const specs: LoadSpec[] = [];
  const repeats = options.mode === "latency" ? options.latencyRepeats : undefined;
  const viewWasm = options.viewWasm === undefined ? undefined : options.viewWasm === "1";
  for (const doc of options.docs) {
    const boards = options.snapshot ? ["-"] : options.boardFlag ? [options.board ?? "as-written"] : doc.startsWith("ironcalc") ? preset.ironcalcBoards : ["as-written"];
    for (const board of boards) {
      const where = options.snapshot ? "snapshot" : `board-${board}`;
      specs.push({ label: `${doc} ${where}`, doc, mode: options.mode, board: board === "-" ? "as-written" : board, snapshot: options.snapshot, ...(viewWasm === undefined ? {} : { viewWasm }), ...(repeats === undefined ? {} : { repeats }) });
    }
  }
  return specs;
}
