// The `CatalogRenderer` port (AD-9): the one module through which catalog components register
// and the view's renderer finds them. It runs in the shell chunk; the view build maps a component
// chunk's imports of this module to the shell's copy, so every chunk shares one registry. Task 8.4
// completes it with the item frame, ready tracking and the draft store.

import type { BoardQuestion } from "@askboard/contract";
import type { ReactNode } from "react";

export type ItemProps = {
  readonly item: BoardQuestion;
  /** The item's value in the draft record: the option labels chosen so far. */
  readonly value: readonly string[];
  /** Puts a new value into the draft record; nothing leaves the view (AD-9). */
  readonly onValueChange: (value: readonly string[]) => void;
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
