// The `CatalogRenderer` port (AD-9): the one module through which catalog components register
// and AskBoard's own renderer finds them (renderer row 1). It runs in the shell chunk; the view
// build maps a component chunk's imports of this module to the shell's copy, so every chunk shares
// one registry. A component renders from its props alone: the item, the question it sits in, its
// value as it shows it, the board it sits on and whether it may change; it puts each edit into
// the draft record, reports the derived values it declares and reports itself ready. Items and
// values are of any type: Choice's are a question and its option labels, a widget's are its item
// and its full edited props (design decision 7). A component may put several items of its own
// question into the draft record in one update, as a linked edit does (molecules, design decision
// 11).

import { createContext, type ReactNode, useContext, useLayoutEffect } from "react";
import type { Locale } from "@askboard/contract";
import { createContext, type ReactNode, useCallback, useContext, useLayoutEffect } from "react";
import { type Slots, type StringKey, t } from "../strings/index.ts";

/** A widget item as the board document holds it: its type, its ID and its props, as sent. */
export type BoardWidgetItem = {
  readonly type: string;
  readonly id: string;
  readonly props: unknown;
};

/**
 * The board a component reads, read-only (AD-9; gantt-widget design decision 7): every widget item
 * the board document holds, as sent, each question's items in order, the draft record, item ID to
 * edited value, with no entry for an untouched item, and what each item shows (molecules, design
 * decision 11). The same object while the items, the record and the answers are the same, so a
 * component can memoize on it.
 */
export type BoardContent = {
  readonly items: readonly BoardWidgetItem[];
  readonly draft: ReadonlyMap<string, unknown>;
  /**
   * Item ID to the value the item shows: its draft value, else the value its question's latest
   * answer holds for it; an item with no entry shows its props as sent. The draft record itself
   * while no answer holds a widget value. The board as it stands reads it; change marks and
   * counters read the draft record.
   */
  readonly shown: ReadonlyMap<string, unknown>;
};

/** Derived values, by AD-13's reference without brackets (`release.finish`), each a JSON value. */
export type DerivedValues = Readonly<Record<string, unknown>>;

export type ItemProps<Item = unknown, Value = unknown> = {
  readonly item: Item;
  /** The question the item sits in, whose text labels it; Choice's item is the question itself. */
  readonly questionId: string;
  /**
   * The item's value as it shows it: its draft value, else its question's latest answer's, else
   * undefined, while it shows its props as sent.
   */
  readonly value: Value | undefined;
  /** Puts a new value into the draft record, `undefined` for none; nothing leaves the view (AD-9). */
  readonly onValueChange: (value: Value | undefined) => void;
  /**
   * Puts the values of several items of the item's own question into the draft record, by item
   * ID, in one update, `undefined` removing one; an update naming an item outside the question
   * changes nothing and fails the item (molecules, design decision 11).
   */
  readonly onValuesChange: (values: Readonly<Record<string, unknown>>) => void;
  /** The item may not change: its question is answered, being sent or locked. */
  readonly disabled: boolean;
  /** Reports the item ready (AD-9); a component calls it through `useReadyAfterLayout`. */
  readonly ready: () => void;
  /** The board the item sits on: its widget items as sent, the draft record and what each shows. */
  readonly board: BoardContent;
  /**
   * Reports the item's declared derived values as they stand, each report replacing the last; an
   * answer carries those of the items it carries a value for (AD-20, FR-12).
   */
  readonly onDerived: (values: DerivedValues) => void;
};

export type CatalogComponent<Item = unknown, Value = unknown> = (
  props: ItemProps<Item, Value>,
) => ReactNode;

const components = new Map<string, CatalogComponent>();

/**
 * Registers a component under its catalog name, once. The renderer hands it only the items its
 * name renders and the values it put in the draft record itself, which no type can say across
 * chunks: the registry keeps components by name alone.
 */
export const register = <Item, Value>(
  name: string,
  component: CatalogComponent<Item, Value>,
): void => {
  if (components.has(name)) throw new Error(`the component "${name}" is registered twice`);
  components.set(name, component as unknown as CatalogComponent);
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

/**
 * What the view has of its host (AD-9, excerpts decision 6), which the shell provides: whether it
 * has a parent, a live board page it can ask to open a reference or a source (a Snapshot has none),
 * and the way to ask: the view message that names an item, which the board page answers from its
 * own board document.
 */
export type ViewHost = {
  readonly hosted: boolean;
  /** Asks the board page to open a reference, or an excerpt's source, by its item ID. */
  readonly openReference: (itemId: string) => void;
};

export const HostContext = createContext<ViewHost>({ hosted: true, openReference: () => {} });

export const useHosted = (): boolean => useContext(HostContext).hosted;

export const useOpenReference = (): ((itemId: string) => void) =>
  useContext(HostContext).openReference;
 * The ask's language, which the shell provides for the board (settings-languages design decision
 * 9): the view's own strings, the catalog components' included, are in it; en-US when none is
 * provided.
 */
export const LanguageContext = createContext<Locale>("en-US");

/** The ask's language, for a text made outside a lookup. */
export const useLanguage = (): Locale => useContext(LanguageContext);

/** The lookup of the view's own strings in the ask's language. */
export const useStrings = (): ((key: StringKey, slots?: Slots) => string) => {
  const language = useLanguage();
  return useCallback((key: StringKey, slots?: Slots) => t(language, key, slots), [language]);
};

/** The ask's locale, for the values the board shows (design decision 8); en-US when none is provided. */
export const LocaleContext = createContext<Locale>("en-US");

/** The ask's locale, which may differ from its language. */
export const useLocale = (): Locale => useContext(LocaleContext);
