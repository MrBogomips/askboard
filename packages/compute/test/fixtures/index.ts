// The compute fixtures, adapted from the formula spike's probe (design decision 11): imported as
// JSON or generated, so no test needs a file system to read them.

import type { GraphItem } from "../../src/source.ts";
import type { Address } from "../../src/types.ts";
import errors from "./errors.json" with { type: "json" };
import { hostileFixtures } from "./hostile.ts";

/** A value as a fixture expects it: a scalar, or an error compared by kind only. */
export type Expected = number | string | boolean | null | { readonly error: string };

export type ExpectedWarning = { readonly error: string; readonly address: Address };

export type ErrorFixture = {
  readonly id: string;
  readonly note?: string;
  /** Why the expectation differs from the probe's, when it does. */
  readonly changed?: string;
  readonly items: readonly GraphItem[];
  readonly expected: Readonly<Record<Address, Expected>>;
  readonly warnings: readonly ExpectedWarning[];
};

export const ERROR_FIXTURES: readonly ErrorFixture[] = [
  ...(errors.cases as unknown as ErrorFixture[]),
  ...hostileFixtures(),
];
