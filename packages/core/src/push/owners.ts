// The owners of asks (design decision 4, AD-5): the binding of each ask's creating call, set once
// when the ask is created and never changed. An ask created without a binding is unchecked.

import { frozenCopy } from "../ask.ts";
import type { Binding, OwnerRefusal } from "./ports.ts";

export class Owners {
  readonly #byAsk = new Map<string, Binding>();

  /** Gives a new ask its owner, once; without a binding the ask stays unchecked for good. */
  own(askId: string, binding: Binding | undefined): void {
    if (binding === undefined || this.#byAsk.has(askId)) return;
    this.#byAsk.set(askId, frozenCopy(binding));
  }

  /** The ask's owner and origin, or undefined for an unchecked ask or one this epoch lacks. */
  of(askId: string): Binding | undefined {
    return this.#byAsk.get(askId);
  }

  /**
   * Why a call bound to `caller` (undefined when it carries no record) may not act on the ask, or
   * undefined when it may. An unchecked ask takes any caller.
   */
  refusal(askId: string, caller: Binding | undefined): OwnerRefusal | undefined {
    const owner = this.#byAsk.get(askId);
    if (owner === undefined) return undefined;
    if (caller === undefined) return "no-record";
    return caller.ownerKey === owner.ownerKey ? undefined : "other-owner";
  }

  /** The IDs of the asks the owner owns, in the order they were created. */
  asksOf(ownerKey: string): string[] {
    return [...this.#byAsk].flatMap(([askId, owner]) =>
      owner.ownerKey === ownerKey ? [askId] : [],
    );
  }
}
