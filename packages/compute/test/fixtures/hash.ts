// One SHA-256 over every fixture's results, keys sorted, errors by kind only: two runs agree only
// when every derived value agrees.

import type { Tally } from "./suite.ts";

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonical(record[key])]),
  );
};

export const resultsHash = (tally: Tally): string =>
  new Bun.CryptoHasher("sha256").update(JSON.stringify(canonical(tally.results))).digest("hex");
