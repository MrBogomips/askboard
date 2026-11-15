// The perf pass's measuring (design decision 6; view-and-widgets spec: Timed bounds judged in the
// perf pass). A perf file takes `PERF_RUNS` measurements of each form in fresh pages, asserts the
// functional outcomes on every run, and judges each gate once, on the median of its samples. The
// median is robust to one slow run of three; the gate and its strictness stay what the spec says.
//
// `perfRuns` runs a body in turn, `PERF_RUNS` times, each time with its own run number (the body
// opens fresh pages, or picks the run's own frame) and a `gate` to record each sample against its
// limit. `expectMedianWithin` and `judgeMedians` judge samples a file collected itself, such as a
// gate whose limit is itself a median. Every judgement prints a line,
// `perf <label> [a, b, c] median m gate g`, with the engine in the label, for the task's note.

import { expect } from "bun:test";

/** Runs of each form, each in a fresh page. */
export const PERF_RUNS = 3;

/** The median of the samples: the middle one, or the mean of the two middle ones. */
export const median = (samples: readonly number[]): number => {
  if (samples.length === 0) throw new Error("the median of no samples");
  if (samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error(`a sample is not a finite number: ${samples.join(", ")}`);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const high = sorted[middle] as number;
  return sorted.length % 2 === 1 ? high : ((sorted[middle - 1] as number) + high) / 2;
};

const figure = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** The line a judgement prints. */
export const perfLine = (label: string, samples: readonly number[], gate: number): string =>
  `perf ${label} [${samples.map(figure).join(", ")}] median ${figure(median(samples))} gate ${figure(gate)}`;

/**
 * Prints the line, then asserts the median is at most `gate`, or under it when `below` is set, so
 * a gate written with `toBeLessThan` keeps its strictness.
 */
export const expectMedianWithin = (
  label: string,
  samples: readonly number[],
  gate: number,
  below = false,
): void => {
  const line = perfLine(label, samples, gate);
  process.stdout.write(`${line}\n`);
  const middle = median(samples);
  const message = `${label}: the median of [${samples.join(", ")}] is ${middle}, ${below ? "not under" : "over"} the gate ${gate}`;
  if (below) expect(middle, message).toBeLessThan(gate);
  else expect(middle, message).toBeLessThanOrEqual(gate);
};

export type PerfCheck = {
  readonly label: string;
  readonly samples: readonly number[];
  readonly gate: number;
  readonly below?: boolean;
};

/** Judges every check, printing a line for each, and fails once naming each that did not hold. */
export const judgeMedians = (checks: readonly PerfCheck[]): void => {
  const failures: string[] = [];
  for (const { label, samples, gate, below } of checks) {
    try {
      expectMedianWithin(label, samples, gate, below ?? false);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
};

/** Records one sample of a gate. A gate is named by its label and keeps its limit across the runs. */
export type Gate = (label: string, sample: number, gate: number, below?: boolean) => void;

type Gathered = { samples: number[]; gate: number; below: boolean };

/**
 * Runs `body` once for each of `PERF_RUNS` runs, in turn, and judges each gate it recorded once, on
 * the median of its runs. A run that throws fails the scenario at once and judges nothing: the
 * functional outcomes hold on every run, whatever the times. `name` leads each gate's label.
 */
export const perfRuns = async (
  name: string,
  body: (run: number, gate: Gate) => Promise<void>,
): Promise<void> => {
  const gathered = new Map<string, Gathered>();
  for (let run = 0; run < PERF_RUNS; run += 1) {
    const gate: Gate = (label, sample, limit, below = false) => {
      const known = gathered.get(label);
      if (known === undefined) {
        gathered.set(label, { samples: [sample], gate: limit, below });
      } else if (known.gate !== limit || known.below !== below) {
        throw new Error(
          `${name} ${label}: the limit changed between runs (${known.gate}, ${limit})`,
        );
      } else known.samples.push(sample);
    };
    await body(run, gate);
  }
  for (const [label, { samples }] of gathered) {
    if (samples.length !== PERF_RUNS) {
      throw new Error(`${name} ${label}: recorded in ${samples.length} of ${PERF_RUNS} runs`);
    }
  }
  judgeMedians(
    [...gathered].map(([label, { samples, gate, below }]) => ({
      label: `${name} ${label}`,
      samples,
      gate,
      below,
    })),
  );
};
