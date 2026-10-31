// Reading a Content-Security-Policy as the browser tests compare it. The rule that computes the
// board page's policy is the contract's `boardPagePolicy`, which `board-host` and the test server
// both send.

/** A policy's directives in order, each with its sources. */
export const parsePolicy = (policy: string): Map<string, string[]> =>
  new Map(
    policy
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name !== undefined && name !== "")
      .map(([name = "", ...values]) => [name, values]),
  );

/**
 * A policy's directives by name, each with its sources sorted: two policies that say the same
 * compare equal, whatever order `board-host` writes them in.
 */
export const policyDirectives = (policy: string): Record<string, string[]> =>
  Object.fromEntries(
    [...parsePolicy(policy)]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([name, sources]) => [name, [...sources].sort()]),
  );

// What the engines log when a policy blocks something. WebKit reports some blocks only in the
// console, among them a refused WebAssembly compile, so the console counts (renderer row 17).
const CSP_LINE = /Content Security Policy|Content-Security-Policy|Refused to/i;

/** Whether a console line reports something a CSP blocked. */
export const isCspConsoleLine = (text: string): boolean => CSP_LINE.test(text);
