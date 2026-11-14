// The json-render adapter (design decision 4), shared by the two json-render renderer chunks. The board document's item tree becomes
// json-render's flat spec; every registered component is wrapped once into json-render's
// registry. json-render's state store is an adapter over the draft record, so json-render
// holds no state of its own: reads go through `useStateValue`, writes through its `set`.
//
// Only the item ID passes through json-render's props: json-render resolves `$state`,
// `$bindState`, `$cond`, `$template` and `$computed` objects found in any prop value, and agent
// content must stay data (AD-8). The wrapper takes the item from the board document instead.

import { createStoreAdapter } from "@json-render/core/store-utils";
import {
  type ComponentRegistry,
  type ComponentRenderProps,
  JSONUIProvider,
  Renderer,
  useStateStore,
  useStateValue,
} from "@json-render/react";
import { type ReactNode, useCallback, useMemo } from "react";
import {
  componentFor,
  type Draft,
  type Item,
  ItemFrame,
  type RenderContext,
  registeredTypes,
  UnknownItem,
  type ViewMessage,
} from "../port/index.ts";

const ROOT = "__root";
const ROOT_TYPE = "__Root";

type Element = { type: string; props: { itemId?: string }; children: string[] };

const toSpec = (items: Item[]) => {
  const elements: Record<string, Element> = {
    [ROOT]: { type: ROOT_TYPE, props: {}, children: items.map((item) => item.id) },
  };
  const add = (item: Item): void => {
    const children = item.children ?? [];
    elements[item.id] = {
      type: item.type,
      props: { itemId: item.id },
      children: children.map((child) => child.id),
    };
    children.forEach(add);
  };
  items.forEach(add);
  return { root: ROOT, elements };
};

const indexItems = (items: Item[], index = new Map<string, Item>()): Map<string, Item> => {
  for (const item of items) {
    index.set(item.id, item);
    indexItems(item.children ?? [], index);
  }
  return index;
};

type Wrapped = ComponentRenderProps<{ itemId?: string }>;

const Wrapper = ({
  element,
  children,
  context,
  items,
}: Wrapped & { context: RenderContext; items: Map<string, Item> }) => {
  const item = items.get(element.props.itemId ?? "") as Item;
  const store = useStateStore();
  const value = useStateValue(`/values/${item.id}`);
  const ui = useStateValue(`/ui/${item.id}`);
  const { emit, graph, tracker } = context;
  const send = useCallback(
    (message: ViewMessage) => {
      const branch = message.type === "draft.set" ? "values" : "ui";
      store.set(`/${branch}/${message.id}`, message.value);
      emit({ ...message, viaJsonRender: true } as ViewMessage);
    },
    [store, emit],
  );
  const ready = tracker.readyFor(item.id);
  const Component = componentFor(item.type);
  return (
    <ItemFrame item={item}>
      {Component ? (
        <Component item={item} draft={value} ui={ui} graph={graph} emit={send} ready={ready}>
          {children}
        </Component>
      ) : (
        <UnknownItem item={item} ready={ready} />
      )}
    </ItemFrame>
  );
};

const Root = ({ children }: { children?: ReactNode }) => <>{children}</>;

export const JsonRenderRenderer = ({ context }: { context: RenderContext }) => {
  const { board, draft } = context;
  const spec = useMemo(() => toSpec(board.items), [board]);
  const items = useMemo(() => indexItems(board.items), [board]);
  const store = useMemo(
    () =>
      createStoreAdapter({
        getSnapshot: () => draft.get(),
        setSnapshot: (next) => draft.replace(next as Draft),
        subscribe: draft.subscribe,
      }),
    [draft],
  );
  const registry = useMemo(() => {
    const entries = registeredTypes().map((type) => [
      type,
      (props: Wrapped) => <Wrapper {...props} context={context} items={items} />,
    ]);
    return Object.fromEntries([...entries, [ROOT_TYPE, Root]]) as ComponentRegistry;
  }, [context, items]);
  const fallback = (props: Wrapped) => <Wrapper {...props} context={context} items={items} />;
  return (
    <JSONUIProvider registry={registry} store={store}>
      <Renderer spec={spec} registry={registry} fallback={fallback} />
    </JSONUIProvider>
  );
};
