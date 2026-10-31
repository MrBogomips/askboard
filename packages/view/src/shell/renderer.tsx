// AskBoard's own renderer (design decision 8, renderer rows 1 and 2): each item renders through
// the `CatalogRenderer` port inside an item frame, which shows the item's loading state until it
// is ready, and an error boundary, which turns an item that throws into an error state and
// reports it, so that its question never counts as visible (AD-9, AD-10). Components read their
// value from the draft record and write it back; the renderer holds no other state.

import type { BoardQuestion } from "@askboard/contract";
import { Component, type ReactNode, useCallback, useSyncExternalStore } from "react";
import { componentOf } from "../catalog/components.ts";
import { type CatalogComponent, componentFor } from "../catalog/port.ts";
import type { DraftStore } from "./draft-store.ts";
import type { ReadyTracker } from "./ready-tracker.ts";

export type RenderContext = {
  readonly draft: DraftStore;
  readonly tracker: ReadyTracker;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The error state of an item that failed. The wording is not recorded in EXPERIENCE.md. */
export const ItemError = () => (
  <p
    role="alert"
    className="rounded-md border border-destructive p-2 text-body text-destructive-text"
  >
    This item could not be shown.
  </p>
);

type BoundaryProps = { readonly onError: (error: unknown) => void; readonly children: ReactNode };

class ItemErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? <ItemError /> : this.props.children;
  }
}

// An item whose component no chunk registered fails like one that throws (AD-10).
const Unregistered: CatalogComponent = ({ item }) => {
  throw new Error(`no catalog component is registered for the item "${item.id}"`);
};

/**
 * The frame around every item: while the item is pending, its content is laid out but hidden
 * under a static loading block (DESIGN.md, Question loading), so the item's box does not move when
 * the loading state ends.
 */
const ItemFrame = ({
  itemId,
  tracker,
  children,
}: {
  readonly itemId: string;
  readonly tracker: ReadyTracker;
  readonly children: ReactNode;
}) => {
  const status = useSyncExternalStore(tracker.subscribe, () => tracker.itemStatus(itemId));
  const pending = status === "pending";
  return (
    <div data-askboard-item={itemId} className="relative">
      <div className={pending ? "invisible" : undefined}>{children}</div>
      {pending ? (
        <div className="absolute inset-0 flex items-start rounded-md bg-muted p-2 text-body text-muted-foreground">
          Loading
        </div>
      ) : null}
    </div>
  );
};

type RenderItemProps = {
  readonly item: BoardQuestion;
  readonly context: RenderContext;
  /** The item may not change. */
  readonly disabled: boolean;
  /** What the item shows in place of its draft value, such as the answer the log holds. */
  readonly shown?: readonly string[];
};

/** One item through the port, in its frame and its error boundary. */
export const RenderItem = ({ item, context, disabled, shown }: RenderItemProps) => {
  const { draft, tracker } = context;
  const value = useSyncExternalStore(draft.subscribe, () => draft.valueOf(item.id));
  const onValueChange = useCallback(
    (next: readonly string[]) => draft.set(item.id, next),
    [draft, item.id],
  );
  const onError = useCallback(
    (error: unknown) => tracker.fail(item.id, messageOf(error)),
    [tracker, item.id],
  );
  const Item = componentFor(componentOf(item)) ?? Unregistered;
  return (
    <ItemFrame itemId={item.id} tracker={tracker}>
      <ItemErrorBoundary onError={onError}>
        <Item
          item={item}
          value={shown ?? value}
          onValueChange={onValueChange}
          disabled={disabled}
          ready={tracker.readyFor(item.id)}
        />
      </ItemErrorBoundary>
    </ItemFrame>
  );
};
