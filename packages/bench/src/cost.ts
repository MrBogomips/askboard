// The cost of 100 questions, with the addendum's cost model ("Cost model for 100 questions";
// research §6.2) at list prices (early-benchmark design decision 10).

import type { CacheTtl } from "./settings.ts";

/** USD per million tokens. */
export type Prices = {
  readonly output: number;
  readonly write5m: number;
  readonly write1h: number;
  readonly read: number;
};

/** The Claude API list prices of research §6.1, checked on this date. */
export const PRICES_CHECKED = "2026-10-25";

export const PRICES: Readonly<Record<string, Prices>> = {
  "claude-opus-5-5": { output: 20, write5m: 5, write1h: 8, read: 0.2 },
  "claude-sonnet-5-5": { output: 10, write5m: 2.5, write1h: 4, read: 0.1 },
  "claude-haiku-5-5": { output: 0.5, write5m: 0.125, write1h: 0.2, read: 0.01 },
  "claude-fable-5-1": { output: 50, write5m: 12.5, write1h: 20, read: 0.25 },
};

export const pricesFor = (model: string): Prices | undefined =>
  Object.hasOwn(PRICES, model) ? PRICES[model] : undefined;

/** The addendum's defaults. */
export const COST_DEFAULTS = {
  sessions: 10,
  questionsPerSession: 10,
  requestsPerSession: 150,
  reReads: 50,
  writesOfT: 1,
  contextAtExpiry: 60_000,
} as const;

/** Per question K1, K2, X and A; per session T; in tokens. */
export type CostInputs = {
  readonly k1: number;
  readonly k2: number;
  readonly x: number;
  readonly a: number;
  readonly t: number;
};

/** USD for 100 questions; `afterTtl` is the sensitivity of answers after the cache expired. */
export type Cost = {
  readonly generation: number;
  readonly cacheWrite: number;
  readonly reReads: number;
  readonly toolOverhead: number;
  readonly total: number;
  readonly afterTtl: number;
};

const PER_TOKEN = 1e-6;

export const costOf100 = (inputs: CostInputs, prices: Prices, ttl: CacheTtl): Cost => {
  const { sessions, questionsPerSession, requestsPerSession, reReads, writesOfT, contextAtExpiry } =
    COST_DEFAULTS;
  const questions = sessions * questionsPerSession;
  const out = prices.output * PER_TOKEN;
  const write = (ttl === "1h" ? prices.write1h : prices.write5m) * PER_TOKEN;
  const read = prices.read * PER_TOKEN;
  // K2′, the thinking kept in context, equals K2 on keep-all models such as Opus 5.5.
  const kept = inputs.k1 + inputs.k2 + inputs.x + inputs.a;
  const generation = questions * out * (inputs.k1 + inputs.k2 + inputs.x);
  const cacheWrite = questions * write * kept;
  const reReadCost = questions * read * reReads * kept;
  const toolOverhead = sessions * inputs.t * (requestsPerSession * read + writesOfT * write);
  return {
    generation,
    cacheWrite,
    reReads: reReadCost,
    toolOverhead,
    total: generation + cacheWrite + reReadCost + toolOverhead,
    afterTtl: questions * contextAtExpiry * (write - read),
  };
};

/** Per question, a 10-question session is one cold ask and nine warm asks. */
export const mixQuestion = (
  cold: number | undefined,
  warm: number | undefined,
): number | undefined =>
  cold === undefined || warm === undefined ? undefined : (cold + 9 * warm) / 10;

/** Rounds half up to cents, past floating-point error. */
export const usd = (value: number): number => Math.round(value * 100 + 1e-9) / 100;
