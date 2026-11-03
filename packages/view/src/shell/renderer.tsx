// AskBoard's own renderer (design decision 8, renderer rows 1 and 2): each item renders through
// the `CatalogRenderer` port inside an item frame, which shows the item's loading state until it
// is ready, and an error boundary, which turns an item that throws into an error state and
// reports it, so that its question never counts as visible (AD-9, AD-10). Components read their
// value from the draft record and write it back, of whatever type their item's is (design decision
// 7); the renderer holds no other state. Since the ask lifecycle, a component may also get
// `extras` beside the port's props: the Choice atom's "Other…" text and option notes, which the
// lifecycle draft keeps (ask-lifecycle, design decision 6), and the shell may run a step before
// each value goes into the draft record, such as the start of a revision (task 6.7). Components
// also read the board, its items as sent and the draft record, and report their derived values
// (gantt-widget design decision 10).

import { Component, type ReactNode, useCallback, useSyncExternalStore } from "react";
import type { Rendered } from "../catalog/components.ts";
import {
  type BoardContent,
  type CatalogComponent,
  componentFor,
  type DerivedValues,
  type ItemProps,
} from "../catalog/port.ts";
import type { DerivedStore } from "./derived-store.ts";
import type { DraftRecord, DraftStore } from "./draft-store.ts";
import type { ReadyTracker } from "./ready-tracker.ts";

export type RenderContext = {
  readonly draft: DraftStore;
  readonly tracker: ReadyTracker;
  /** The board a component reads as its `board` prop, for a draft record (`board-content.ts`). */
  readonly boardContent: (draft: DraftRecord) => BoardContent;
  readonly derived: DerivedStore;
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
const Unregistered: CatalogComponent<{ readonly id: string }> = ({ item }) => {
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

type RenderItemProps = Rendered & {
  /** The question the item sits in. */
  readonly questionId: string;
  readonly context: RenderContext;
  /** The item may not change. */
  readonly disabled: boolean;
  /** What the item shows in place of its draft value, such as the answer the log holds. */
  readonly shown?: unknown;
  /** What the shell hands the component beside the port's props, such as Choice's extras. */
  readonly extras?: unknown;
  /** Runs before each value the component puts back, such as the start of a revision. */
  readonly onBeforeChange?: () => void;
};

// A component as the renderer calls it: the port's props, and the extras the shell has for it.
type Rendering = (props: ItemProps & { readonly extras?: unknown }) => ReactNode;

/** One item through the port, in its frame and its error boundary. */
export const RenderItem = ({
  item,
  component,
  questionId,
  context,
  disabled,
  shown,
  extras,
  onBeforeChange,
}: RenderItemProps) => {
  const { draft, tracker, boardContent, derived } = context;
  // The whole record, since the board holds it: the item's value is its entry, as `valueOf` reads.
  const record = useSyncExternalStore(draft.subscribe, draft.record);
  const value = record.get(item.id);
  const onValueChange = useCallback(
    (next: unknown) => {
      onBeforeChange?.();
      draft.set(item.id, next);
    },
    [draft, item.id, onBeforeChange],
  );
  const onDerived = useCallback(
    (values: DerivedValues) => derived.report(item.id, values),
    [derived, item.id],
  );
  const onError = useCallback(
    (error: unknown) => tracker.fail(item.id, messageOf(error)),
    [tracker, item.id],
  );
  const Item = (componentFor(component) ?? Unregistered) as Rendering;
  return (
    <ItemFrame itemId={item.id} tracker={tracker}>
      <ItemErrorBoundary onError={onError}>
        <Item
          item={item}
          questionId={questionId}
          value={shown ?? value}
          onValueChange={onValueChange}
          disabled={disabled}
          ready={tracker.readyFor(item.id)}
          board={boardContent(record)}
          onDerived={onDerived}
          {...(extras === undefined ? {} : { extras })}
        />
      </ItemErrorBoundary>
    </ItemFrame>
  );
};
