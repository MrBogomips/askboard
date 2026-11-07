// Design decision 7's rules for the four LaTeX bounds, over the rows the depth probe measured
// (latex-kanban-timeline, tasks 4.15 and 4.16). Pure: rows in, bounds out, so the rules have a unit
// test.
//
//   1. `LATEX_TREE_MAX_NODES`: the largest node count at which every flat fixture renders in under
//      500 ms in both engines.
//   2. `LATEX_TREE_MAX_FRACTIONS`: the largest count of nested fractions at which every fixture with
//      that many or fewer, within the node bound, renders in under 500 ms in both engines.
//   3. `LATEX_TREE_MAX_DEPTH`: the largest tree depth at which every fixture within it and the two
//      bounds above renders in under 500 ms in both engines, with no crash, and no deeper than the
//      deepest such fixture measured.
//   4. `LATEX_NESTING_MAX_DEPTH`: the largest scan depth at which every fixture of that scan depth
//      or less has an output within the three bounds; under 8, stop.
//   5. A realistic set must pass the scan and the three bounds; else stop.

/** A render is fast when it is under this, with no failure. */
export const FAST_MS = 500;

/** The work before the bound acts may not pass this for a fixture within the bounds. */
export const BEFORE_LIMIT_MS = 100;

/** What the rules read of one fixture in one engine. */
export type Sample = {
  readonly engine: string;
  /** The fixture's family (or the flat kind), and with its shape and depth (or size) its label. */
  readonly family: string;
  readonly label: string;
  /** The scan's depth (Bun). */
  readonly scanDepth: number;
  /** The output tree's depth and node count (Bun). */
  readonly treeDepth: number;
  readonly nodes: number;
  /** The most MathML fractions nested on one path of the tree (Bun). */
  readonly fractions: number;
  /** The render's time, or `undefined` when it failed (a crash, a timeout, the parent not answering). */
  readonly ms: number | undefined;
  /** The scan, KaTeX's tree and its size, in the engine. */
  readonly beforeMs: number | undefined;
};

export const isSlow = (sample: Sample): boolean => sample.ms === undefined || sample.ms >= FAST_MS;

/** A flat series of one kind in one engine: its samples from the smallest to the largest. */
export type FlatSeries = {
  readonly engine: string;
  readonly kind: string;
  readonly samples: readonly Sample[];
  /** The series ended where KaTeX stopped building a tree (its expansion limit), not on time. */
  readonly capped: boolean;
};

/**
 * Rule 1: for each series the node count of the last sample before its first slow one (a series
 * KaTeX itself stops with no slow sample is left out); the bound is the least of them. `limitedBy`
 * names the series. With no slow series the bound is the largest node count tried, `unbounded`.
 */
export const nodeBound = (
  series: readonly FlatSeries[],
): { readonly nodes: number; readonly limitedBy: string; readonly unbounded: boolean } => {
  let nodes = Number.POSITIVE_INFINITY;
  let limitedBy = "";
  let unbounded = true;
  let largest = 0;
  for (const { engine, kind, samples, capped } of series) {
    const slow = samples.findIndex(isSlow);
    largest = Math.max(largest, samples.at(-1)?.nodes ?? 0);
    // A series KaTeX itself stops, with no slow sample, says nothing of time.
    if (capped && slow === -1) continue;
    const fast = slow === -1 ? samples : samples.slice(0, slow);
    const last = fast.at(-1);
    if (last === undefined) continue;
    if (slow !== -1) unbounded = false;
    if (last.nodes < nodes) {
      nodes = last.nodes;
      limitedBy = `${kind} in ${engine}`;
    }
  }
  return unbounded
    ? { nodes: largest, limitedBy: "no slow flat fixture", unbounded }
    : { nodes, limitedBy, unbounded };
};

/**
 * Rule 2: one less than the least nested-fraction count among the slow samples within the node bound;
 * the most fractions seen when none is slow. `limitedBy` names the slow sample.
 */
export const fractionBound = (
  samples: readonly Sample[],
  maxNodes: number,
): { readonly fractions: number; readonly limitedBy: string } => {
  let least: Sample | undefined;
  let most = 0;
  for (const sample of samples) {
    if (sample.nodes > maxNodes) continue;
    most = Math.max(most, sample.fractions);
    if (isSlow(sample) && (least === undefined || sample.fractions < least.fractions))
      least = sample;
  }
  return least === undefined
    ? { fractions: most, limitedBy: "no slow fixture" }
    : {
        fractions: Math.max(0, least.fractions - 1),
        limitedBy: `${least.label} in ${least.engine}`,
      };
};

/**
 * Rule 3: among the samples within the node and fraction bounds, the deepest fast tree below the
 * least depth of a slow one (all fast trees when none is slow): the largest depth at which every
 * such fixture is fast, and no deeper than the deepest measured. `limitedBy` names the slow sample.
 */
export const depthBound = (
  samples: readonly Sample[],
  maxNodes: number,
  maxFractions: number,
): { readonly depth: number; readonly limitedBy: string } => {
  const inside = samples.filter(
    (sample) => sample.nodes <= maxNodes && sample.fractions <= maxFractions,
  );
  let least: Sample | undefined;
  for (const sample of inside) {
    if (isSlow(sample) && (least === undefined || sample.treeDepth < least.treeDepth))
      least = sample;
  }
  const below = least?.treeDepth ?? Number.POSITIVE_INFINITY;
  let deepest = 0;
  for (const sample of inside) {
    if (!isSlow(sample) && sample.treeDepth < below) deepest = Math.max(deepest, sample.treeDepth);
  }
  return least === undefined
    ? { depth: deepest, limitedBy: "no slow fixture" }
    : { depth: deepest, limitedBy: `${least.label} in ${least.engine}` };
};

/** The three bounds of an output tree. */
export type TreeBounds = {
  readonly nodes: number;
  readonly fractions: number;
  readonly depth: number;
};

/**
 * Rule 4: one less than the least scan depth among the samples whose tree is past a bound; the
 * deepest scan seen when none is. `limitedBy` names that sample.
 */
export const nestingBound = (
  samples: readonly Sample[],
  bounds: TreeBounds,
): { readonly depth: number; readonly limitedBy: string } => {
  let least: Sample | undefined;
  let deepest = 0;
  for (const sample of samples) {
    deepest = Math.max(deepest, sample.scanDepth);
    const past =
      sample.treeDepth > bounds.depth ||
      sample.nodes > bounds.nodes ||
      sample.fractions > bounds.fractions;
    if (past && (least === undefined || sample.scanDepth < least.scanDepth)) least = sample;
  }
  return least === undefined
    ? { depth: deepest, limitedBy: "no fixture past the bounds" }
    : {
        depth: least.scanDepth - 1,
        limitedBy: `${least.label} (tree depth ${least.treeDepth}, ${least.nodes} nodes, ${least.fractions} fractions)`,
      };
};

/**
 * The two families of the combined form (design decision 7, Measuring): the slowest within the bounds
 * at the most nested fractions, and, among those with none, the deepest tree within the depth bound.
 * Either is `undefined` when no sample qualifies.
 */
export const combinedFamilies = (
  samples: readonly Sample[],
  bounds: Bounds,
): { readonly fraction: string | undefined; readonly plain: string | undefined } => {
  const tree = samples.filter(
    (sample) =>
      sample.nodes <= bounds.nodes &&
      sample.fractions <= bounds.fractions &&
      sample.treeDepth <= bounds.depth,
  );
  const most = Math.max(0, ...tree.map((sample) => sample.fractions));
  const time = (sample: Sample) => sample.ms ?? Number.POSITIVE_INFINITY;
  const slowestOf = (own: readonly Sample[]) =>
    own.reduce<Sample | undefined>(
      (held, sample) => (held === undefined || time(sample) > time(held) ? sample : held),
      undefined,
    );
  const deepestOf = (own: readonly Sample[]) =>
    own.reduce<Sample | undefined>(
      (held, sample) => (held === undefined || sample.treeDepth > held.treeDepth ? sample : held),
      undefined,
    );
  return {
    fraction: most === 0 ? undefined : slowestOf(tree.filter((s) => s.fractions === most))?.family,
    plain: deepestOf(tree.filter((s) => s.fractions === 0))?.family,
  };
};

/** The bounds a sample is within. */
export type Bounds = TreeBounds & { readonly nesting: number };

export const within = (sample: Sample, bounds: Bounds): boolean =>
  sample.nodes <= bounds.nodes &&
  sample.fractions <= bounds.fractions &&
  sample.treeDepth <= bounds.depth &&
  sample.scanDepth <= bounds.nesting;

/** The scan's limit under which design decision 7 stops for `/opsx:update`. */
export const MIN_NESTING = 8;

/**
 * Rule 4's floor and rule 5: why the measurement stops for `/opsx:update`, one line each: a nesting
 * bound under 8, and each realistic fixture past the scan or a bound, or slow, or failing.
 */
export const stopReasons = (bounds: Bounds, realistic: readonly Sample[]): string[] => {
  const reasons: string[] = [];
  if (bounds.nesting < MIN_NESTING)
    reasons.push(`the nesting bound is ${bounds.nesting}, under ${MIN_NESTING}`);
  for (const sample of realistic) {
    const past = [
      sample.scanDepth > bounds.nesting ? `scan ${sample.scanDepth} past ${bounds.nesting}` : "",
      sample.nodes > bounds.nodes ? `${sample.nodes} nodes past ${bounds.nodes}` : "",
      sample.fractions > bounds.fractions
        ? `${sample.fractions} fractions past ${bounds.fractions}`
        : "",
      sample.treeDepth > bounds.depth ? `tree depth ${sample.treeDepth} past ${bounds.depth}` : "",
      isSlow(sample) ? `${sample.ms === undefined ? "failed" : `${Math.round(sample.ms)} ms`}` : "",
    ].filter((text) => text !== "");
    if (past.length > 0)
      reasons.push(`the realistic fixture "${sample.label}": ${past.join(", ")}`);
  }
  return reasons;
};

/** The samples within the bounds that are slow, or whose work before the bound passed its limit. */
export const violations = (samples: readonly Sample[], bounds: Bounds): Sample[] =>
  samples.filter(
    (sample) =>
      within(sample, bounds) &&
      (isSlow(sample) || (sample.beforeMs !== undefined && sample.beforeMs > BEFORE_LIMIT_MS)),
  );

/** The slowest samples within the bounds, slowest first. */
export const slowest = (samples: readonly Sample[], bounds: Bounds, count: number): Sample[] =>
  samples
    .filter((sample) => within(sample, bounds) && sample.ms !== undefined)
    .sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0))
    .slice(0, count);
