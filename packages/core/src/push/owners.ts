// The owners of asks (design decision 4, AD-5): the binding of each ask's creating call, set once
// when the ask is created; only its origin's label may change, when the owner's agent becomes
// better known (a teammate the mod reported late, design decision 4, Origin, plan B). An ask
// created without a binding is unchecked.

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

  /**
   * Gives the ask's origin `label`, which names its agent alone, with no ordinal. Whether the origin
   * changed: an unchecked ask, or one without an origin, has none to change.
   */
  relabel(askId: string, label: string): boolean {
    const owner = this.#byAsk.get(askId);
    const origin = owner?.origin;
    if (owner === undefined || origin === undefined) return false;
    if (origin.label === label && origin.ordinal === undefined) return false;
    const { ordinal: _numbered, ...unnumbered } = origin;
    this.#byAsk.set(askId, frozenCopy({ ...owner, origin: { ...unnumbered, label } }));
    return true;
  }

  /** The IDs of the asks the owner owns, in the order they were created. */
  asksOf(ownerKey: string): string[] {
    return [...this.#byAsk].flatMap(([askId, owner]) =>
      owner.ownerKey === ownerKey ? [askId] : [],
    );
  }
}
