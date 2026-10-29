// The `CatalogRenderer` port stand-in (AD-9): the only module a component may import besides
// React and its own library. It lives in the shell chunk; other chunks reach it through the
// `__askboard` global (build.ts maps imports of this file to it).

import { createElement, type ReactNode, useLayoutEffect, useRef } from "react";

export type Item = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: Item[];
};

export type BoardDocument = { id: string; title?: string; items: Item[] };

// The draft record (AD-20): every edit and every piece of view state a reload keeps.
export type Draft = { values: Record<string, unknown>; ui: Record<string, unknown> };

// The compute graph's values; static in this probe (design, non-goals).
export type Graph = Record<string, unknown>;

export type ViewMessage =
  | { type: "draft.set"; id: string; value: unknown }
  | { type: "ui.set"; id: string; value: unknown };

export type ItemProps = {
  item: Item;
  draft: unknown;
  ui: unknown;
  graph: Graph;
  emit: (message: ViewMessage) => void;
  ready: () => void;
  children?: ReactNode;
};

export type CatalogComponent = (props: ItemProps) => ReactNode;

export type DraftStore = {
  get: () => Draft;
  replace: (next: Draft) => void;
  subscribe: (listener: () => void) => () => void;
};

export type Tracker = { readyFor: (id: string) => () => void };

export type RenderContext = {
  board: BoardDocument;
  draft: DraftStore;
  graph: Graph;
  emit: (message: ViewMessage) => void;
  tracker: Tracker;
};

// A renderer is a React component that renders the whole board from the context.
export type RendererComponent = (props: { context: RenderContext }) => ReactNode;

const components = new Map<string, CatalogComponent>();
const renderers = new Map<string, RendererComponent>();

export const register = (type: string, component: CatalogComponent): void => {
  if (components.has(type)) throw new Error(`component ${type} registered twice`);
  components.set(type, component);
};

export const componentFor = (type: string): CatalogComponent | undefined => components.get(type);
export const registeredTypes = (): string[] => [...components.keys()];

export const registerRenderer = (name: string, renderer: RendererComponent): void => {
  renderers.set(name, renderer);
};
export const rendererFor = (name: string): RendererComponent | undefined => renderers.get(name);

export const createDraftStore = (initial: Draft): DraftStore => {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    replace: (next) => {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

// Immutable draft updates (value objects are never mutated).
export const withValue = (draft: Draft, id: string, value: unknown): Draft => ({
  ...draft,
  values: { ...draft.values, [id]: value },
});
export const withUi = (draft: Draft, id: string, value: unknown): Draft => ({
  ...draft,
  ui: { ...draft.ui, [id]: value },
});

// Reports ready once the item's content has been laid out once, after `settled` turns true.
export const useReadyAfterLayout = (ready: () => void, settled = true): void => {
  const reported = useRef(false);
  useLayoutEffect(() => {
    if (!settled || reported.current) return;
    reported.current = true;
    requestAnimationFrame(() => ready());
  }, [settled, ready]);
};

// The element both renderers put around every item: it carries the ID the tracker measures.
export const ItemFrame = ({ item, children }: { item: Item; children?: ReactNode }) =>
  createElement(
    "div",
    { "data-item-id": item.id, "data-item-type": item.type, className: "ab-item" },
    children,
  );

export const UnknownItem = ({ item, ready }: { item: Item; ready: () => void }) => {
  useReadyAfterLayout(ready);
  return createElement("p", { className: "text-destructive-text" }, `Unknown item ${item.type}`);
};
