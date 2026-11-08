// AskBoard's own renderer (design decision 8, renderer rows 1 and 2): each item renders through
// the `CatalogRenderer` port inside an item frame, which shows the item's loading state until it
// is ready, and an error boundary, which turns an item that throws into an error state and
// reports it, so that its question never counts as visible (AD-9, AD-10). Components read their
// value from the draft record and write it back, of whatever type their item's is (design decision
// 7); the renderer holds no other state. Since the ask lifecycle, a component may also get
// `extras` beside the port's props: the Choice atom's "Other…" text and option notes, which the
// lifecycle draft keeps (ask-lifecycle, design decision 6), and the shell may run a step before
// each value goes into the draft record, such as the start of a revision (task 6.7), which seeds the
// answer's widget values since reopen-start-from-answer (design decision 2). Components
// also read the board, its items as sent and the draft record, and report their derived values
// (gantt-widget design decision 10). Since the molecules change (design decision 11), a component
// may put several items of its question into the draft record in one update, and an item shows the
// board's shown value, its answer's on a question being revised, until the user changes it. A
// component also reports a result beside its value, into the results store beside the draft
// record, and reads the result it holds, else its latest answer's (widget-registry, design
// decision 9). An item the card cannot take edits of, on a revision the board cannot show, is
// drawn disabled with a line under it, and writes nothing into the draft (keep-mine-shown-revision,
// design decisions 3 and 4).

import { Component, type ReactNode, useCallback, useMemo, useSyncExternalStore } from "react";
import type { Rendered } from "../catalog/components.ts";
import {
  type BoardContent,
  type BoardWidgetItem,
  type CatalogComponent,
  componentFor,
  type DerivedValues,
  type ItemProps,
  useStrings,
} from "../catalog/port.ts";
import { withEntries } from "./board-content.ts";
import { CELL_ENTRY_ITEM_TYPE, cellEntriesShown, entriesWithCells } from "./cell-entries.ts";
import type { DerivedStore } from "./derived-store.ts";
import { createDraftStore, type DraftRecord, type DraftStore } from "./draft-store.ts";
import { isEntryType } from "./entries.ts";
import { itemCallbacks, itemResultOf, itemValueOf } from "./item-callbacks.ts";
import type { ReadyTracker } from "./ready-tracker.ts";

export type RenderContext = {
  readonly draft: DraftStore;
  readonly tracker: ReadyTracker;
  /** The board a component reads as its `board` prop, for a draft record (`board-content.ts`). */
  readonly boardContent: (draft: DraftRecord) => BoardContent;
  readonly derived: DerivedStore;
  /** The results the widget items hold, beside the draft record; none: no item holds a result. */
  readonly results?: DraftStore;
  /** The entries the fields hold, beside the draft record; none: no item holds an entry. */
  readonly entries?: DraftStore;
  /** The cell entries the Tables hold, beside the draft record (table-widget, design decision 8). */
  readonly cellEntries?: DraftStore;
  /** The result an item's question's latest answer holds for it (`createAnsweredResults`). */
  readonly answeredResult?: (itemId: string) => unknown;
};

// What an item follows while the board has no results store: nothing is ever put into it.
const NO_RESULTS = createDraftStore();
const NO_ENTRIES = createDraftStore();
const NO_READ_ONLY: ReadonlySet<string> = new Set();
const NO_CELLS = createDraftStore();

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The error state of an item that failed. The wording is not recorded in EXPERIENCE.md. */
export const ItemError = () => {
  const text = useStrings();
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive p-sm text-body text-destructive-text"
    >
      {text("item.error")}
    </p>
  );
};

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
  // The snapshot is also the server one, which only the tests' server renderer reads.
  const itemStatusOf = () => tracker.itemStatus(itemId);
  const status = useSyncExternalStore(tracker.subscribe, itemStatusOf, itemStatusOf);
  const pending = status === "pending";
  const text = useStrings();
  return (
    <div data-askboard-item={itemId} className="relative">
      <div className={pending ? "invisible" : undefined}>{children}</div>
      {pending ? (
        <div className="absolute inset-0 flex items-start rounded-md bg-muted p-sm text-body text-muted-foreground">
          {text("item.loading")}
        </div>
      ) : null}
    </div>
  );
};

type RenderItemProps = Rendered & {
  /** The question the item sits in. */
  readonly questionId: string;
  /** The items the question's draft values may name (`itemIdsOf`): the only ones it may write. */
  readonly itemIds: readonly string[];
  readonly context: RenderContext;
  /** The item may not change. */
  readonly disabled: boolean;
  /**
   * The items that take no edit while the card shows a revision other than the one its answer
   * names (`readOnlyItemsOf`), at every depth: drawn disabled, with the line under each, and
   * writing nothing; none: every item takes edits.
   */
  readonly readOnlyItems?: ReadonlySet<string>;
  /** What the item shows in place of its draft value, such as the answer the log holds. */
  readonly shown?: unknown;
  /** The result the item shows in place of the one it holds, such as the answer's being sent. */
  readonly shownResult?: unknown;
  /**
   * What an item inside this item's layout shows in place of its draft value and of its result,
   * by item ID, as the card's answer gives them (layouts, design decision 6); none: it shows its
   * own.
   */
  readonly shownOf?: (itemId: string) => unknown;
  readonly shownResultOf?: (itemId: string) => unknown;
  /** What the shell hands the component beside the port's props, such as Choice's extras. */
  readonly extras?: unknown;
  /** Runs before each value the component puts back, such as the start of a revision. */
  readonly onBeforeChange?: () => void;
};

// A component as the renderer calls it: the port's props, and the extras the shell has for it.
type Rendering = (props: ItemProps & { readonly extras?: unknown }) => ReactNode;

// The entry an item shows: the one the user holds, never while the card shows an answer in its
// place (the answer being sent, or the logged one), whose fields are read-only.
const entryShown = (shown: unknown, shownResult: unknown, held: unknown): string | undefined =>
  shown === undefined && shownResult === undefined && typeof held === "string" ? held : undefined;

/** One item through the port, in its frame and its error boundary. */
export const RenderItem = ({
  item,
  component,
  questionId,
  itemIds,
  context,
  disabled,
  readOnlyItems = NO_READ_ONLY,
  shown,
  shownResult,
  extras,
  shownOf,
  shownResultOf,
  onBeforeChange,
}: RenderItemProps) => {
  const {
    draft,
    tracker,
    boardContent,
    derived,
    results = NO_RESULTS,
    entries = NO_ENTRIES,
    cellEntries = NO_CELLS,
    answeredResult,
  } = context;
  // The whole record, since the board holds it: the item's value is what the board shows for it.
  const record = useSyncExternalStore(draft.subscribe, draft.record, draft.record);
  const heldResults = useSyncExternalStore(results.subscribe, results.record, results.record);
  const heldEntries = useSyncExternalStore(entries.subscribe, entries.record, entries.record);
  const heldCells = useSyncExternalStore(
    cellEntries.subscribe,
    cellEntries.record,
    cellEntries.record,
  );
  const board = withEntries(
    boardContent(record),
    entriesWithCells(heldEntries, heldCells),
    heldResults,
  );
  const onDerived = useCallback(
    (values: DerivedValues) => derived.report(item.id, values),
    [derived, item.id],
  );
  const onError = useCallback(
    (error: unknown) => tracker.fail(item.id, messageOf(error)),
    [tracker, item.id],
  );
  const text = useStrings();
  const readOnly = readOnlyItems.has(item.id);
  const heldStore = context.results;
  const entryStore = context.entries;
  const cellStore = context.cellEntries;
  const { onValueChange, onValuesChange, onResultChange, onEntryChange, onCellEntriesChange } =
    useMemo(
      () =>
        itemCallbacks({
          draft,
          results: heldStore,
          entries: entryStore,
          entryAllowed: isEntryType(item.type),
          cellEntries: cellStore,
          cellEntriesAllowed: item.type === CELL_ENTRY_ITEM_TYPE,
          itemId: item.id,
          questionId,
          itemIds,
          readOnlyItems,
          onBeforeChange,
          onError,
        }),
      [
        draft,
        heldStore,
        entryStore,
        cellStore,
        item.type,
        item.id,
        questionId,
        itemIds,
        readOnlyItems,
        onBeforeChange,
        onError,
      ],
    );
  // One item the layout holds, through this same renderer: its own frame, boundary and draft.
  const renderItem = (child: BoardWidgetItem): ReactNode => (
    <RenderItem
      key={child.id}
      item={child}
      component={child.type}
      questionId={questionId}
      itemIds={itemIds}
      context={context}
      disabled={disabled}
      readOnlyItems={readOnlyItems}
      shown={shownOf?.(child.id)}
      shownResult={shownResultOf?.(child.id)}
      {...(shownOf === undefined ? {} : { shownOf })}
      {...(shownResultOf === undefined ? {} : { shownResultOf })}
      {...(onBeforeChange === undefined ? {} : { onBeforeChange })}
    />
  );
  const Item = (componentFor(component) ?? Unregistered) as Rendering;
  return (
    <ItemFrame itemId={item.id} tracker={tracker}>
      <ItemErrorBoundary onError={onError}>
        <Item
          item={item}
          questionId={questionId}
          value={itemValueOf(shown, board, item.id)}
          onValueChange={onValueChange}
          onValuesChange={onValuesChange}
          result={itemResultOf(shownResult, heldResults.get(item.id), answeredResult?.(item.id))}
          onResultChange={onResultChange}
          disabled={disabled || readOnly}
          ready={tracker.readyFor(item.id)}
          board={board}
          onDerived={onDerived}
          entry={entryShown(shown, shownResult, heldEntries.get(item.id))}
          onEntryChange={onEntryChange}
          cellEntries={cellEntriesShown(shown, shownResult, heldCells.get(item.id))}
          onCellEntriesChange={onCellEntriesChange}
          renderItem={renderItem}
          {...(extras === undefined ? {} : { extras })}
        />
        {readOnly ? (
          <p data-askboard-read-only={item.id} className="mt-sm text-body text-muted-foreground">
            {text("change.readOnlyAfterReload")}
          </p>
        ) : null}
      </ItemErrorBoundary>
    </ItemFrame>
  );
};
