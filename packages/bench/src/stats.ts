// Medians and spread across runs (FR-32: medians compared, the spread reported; early-benchmark
// design decision 10).

export type Spread = {
  readonly n: number;
  readonly median: number;
  readonly min: number;
  /** Nearest rank. */
  readonly p90: number;
  readonly max: number;
};

export const spreadOf = (values: readonly number[]): Spread | undefined => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const middle = Math.floor(n / 2);
  const at = (index: number) => sorted[index] ?? Number.NaN;
  const median = n % 2 === 1 ? at(middle) : (at(middle - 1) + at(middle)) / 2;
  return { n, median, min: at(0), p90: at(Math.ceil(0.9 * n) - 1), max: at(n - 1) };
};
