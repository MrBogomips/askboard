// Board tokens (AD-11, NFR-4): one per board, 16 random bytes in base64url, compared in constant
// time. A token stays known after its ask is discarded, so the board's link can say so (AD-21).

import { randomBytes, timingSafeEqual } from "node:crypto";
import { BOARD_TOKEN_BYTES } from "@askboard/contract";

/** A new random token: 128 bits as 22 base64url characters. */
export const newToken = (): string => randomBytes(BOARD_TOKEN_BYTES).toString("base64url");

/** Whether two tokens are equal, in time that does not depend on where they differ. */
export const sameToken = (presented: string, expected: string): boolean => {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
};

/** The token of each ask's board, by ask ID. */
export class BoardTokens {
  readonly #make: () => string;
  readonly #tokens = new Map<string, string>();

  constructor(make: () => string) {
    this.#make = make;
  }

  /** A new token for the ask's board, replacing any earlier one. */
  issue(askId: string): string {
    const token = this.#make();
    this.#tokens.set(askId, token);
    return token;
  }

  /** Whether `presented` is the token of this ask's board. */
  opens(askId: string, presented: string): boolean {
    const token = this.#tokens.get(askId);
    return token !== undefined && sameToken(presented, token);
  }

  /** Whether `presented` is the token of a board for which `live` holds. */
  opensAny(presented: string, live: (askId: string) => boolean): boolean {
    let found = false;
    for (const [askId, token] of this.#tokens) {
      // Every token is compared, so the time does not say which board matched.
      if (sameToken(presented, token) && live(askId)) found = true;
    }
    return found;
  }
}
