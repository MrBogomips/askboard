// AskBoard's own renderer (design decision 4): a recursive render of the item tree through the
// port's registry. The draft record is the only state; every item reads its slice from it.

import { useCallback, useSyncExternalStore } from "react";
import {
  componentFor,
  type Item,
  ItemFrame,
  type RenderContext,
  registerRenderer,
  UnknownItem,
  type ViewMessage,
} from "../port/index.ts";

const RenderItem = ({ item, context }: { item: Item; context: RenderContext }) => {
  const { draft, graph, emit, tracker } = context;
  const value = useSyncExternalStore(draft.subscribe, () => draft.get().values[item.id]);
  const ui = useSyncExternalStore(draft.subscribe, () => draft.get().ui[item.id]);
  const send = useCallback((message: ViewMessage) => emit(message), [emit]);
  const ready = tracker.readyFor(item.id);
  const Component = componentFor(item.type);
  const children = item.children?.map((child) => (
    <RenderItem key={child.id} item={child} context={context} />
  ));
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

const OwnRenderer = ({ context }: { context: RenderContext }) => (
  <>
    {context.board.items.map((item) => (
      <RenderItem key={item.id} item={item} context={context} />
    ))}
  </>
);

registerRenderer("own", OwnRenderer);
