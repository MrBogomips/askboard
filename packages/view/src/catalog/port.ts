// The `CatalogRenderer` port (AD-9): the one module through which catalog components register
// and AskBoard's own renderer finds them (renderer row 1). It runs in the shell chunk; the view
// build maps a component chunk's imports of this module to the shell's copy, so every chunk shares
// one registry. A component renders from its props alone: the item, its value in the draft record
// and whether it may change; it puts each edit into the draft record and reports itself ready.

import type { BoardQuestion } from "@askboard/contract";
import { type ReactNode, useLayoutEffect } from "react";

export type ItemProps = {
  readonly item: BoardQuestion;
  /** The item's value in the draft record: the option labels chosen so far. */
  readonly value: readonly string[];
  /** Puts a new value into the draft record; nothing leaves the view (AD-9). */
  readonly onValueChange: (value: readonly string[]) => void;
  /** The item may not change: its question is answered, being sent or locked. */
  readonly disabled: boolean;
  /** Reports the item ready (AD-9); a component calls it through `useReadyAfterLayout`. */
  readonly ready: () => void;
};

export type CatalogComponent = (props: ItemProps) => ReactNode;

const components = new Map<string, CatalogComponent>();

/** Registers a component under its catalog name, once. */
export const register = (name: string, component: CatalogComponent): void => {
  if (components.has(name)) throw new Error(`the component "${name}" is registered twice`);
  components.set(name, component);
};

/** The component registered under a name, if any. */
export const componentFor = (name: string): CatalogComponent | undefined => components.get(name);

export const registeredComponents = (): string[] => [...components.keys()].sort();

/**
 * The ID of the element holding a question's text, which the question card renders and its
 * component's controls are labelled by. `:` is in no item ID (ID_PATTERN), so no two items clash.
 */
export const questionTextId = (itemId: string): string => `${itemId}:text`;

/**
 * The layout effect behind `useReadyAfterLayout`: once `settled`, it reports the item ready on the
 * next frame, by when its content has been laid out, unless the component is gone first.
 */
export const readyEffect =
  (
    ready: () => void,
    settled: boolean,
    request: (callback: () => void) => number = requestAnimationFrame,
    cancel: (frame: number) => void = cancelAnimationFrame,
  ) =>
  (): (() => void) | undefined => {
    if (!settled) return undefined;
    const frame = request(() => ready());
    return () => cancel(frame);
  };

/**
 * Reports the item ready once its content has been laid out, after `settled` turns true: a
 * component with asynchronous work passes whether that work has settled (AD-9).
 */
export const useReadyAfterLayout = (ready: () => void, settled = true): void => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect is made from exactly these.
  useLayoutEffect(readyEffect(ready, settled), [ready, settled]);
};
