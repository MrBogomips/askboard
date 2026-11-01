// A step of design decision 3 that stops: the pointer stays unresolved, for a reason.

import type { UnresolvedReason } from "@askboard/contract";

export type Refused = { readonly refused: UnresolvedReason };

export const isRefused = (value: unknown): value is Refused =>
  typeof value === "object" && value !== null && "refused" in value;

/** The `code` of a system error, such as `ENOENT`; undefined for any other error. */
export const systemCode = (error: unknown): string | undefined => {
  const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : undefined;
};

/**
 * A file system call that failed with a system error leaves the pointer unresolved, for `reason`.
 * Any other error is a fault of AskBoard's own and is thrown again, never taken for a file's state.
 */
export const refusedBy = (error: unknown, reason: UnresolvedReason): Refused => {
  if (systemCode(error) === undefined) throw error;
  return { refused: reason };
};

/** The call's result, or the pointer refused for `reason` when the call fails with a system error. */
export const unless = async <T>(
  call: () => Promise<T>,
  reason: UnresolvedReason,
): Promise<T | Refused> => {
  try {
    return await call();
  } catch (error) {
    return refusedBy(error, reason);
  }
};
