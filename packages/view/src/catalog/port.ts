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

import type { ElementShape, FieldCheckFailure, KeyTable, Locale } from "@askboard/contract";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";
import { type Slots, type StringKey, t } from "../strings/index.ts";
import type { Theme } from "../theme.ts";

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
  /**
   * Question ID to its widget items' IDs, in order (approval-scale-ranking, design decision 7):
   * what a component reads of the items beside it. The shell always sets it, for the live board
   * and a Snapshot; optional in the type so a component's fixtures stand without it.
   */
  readonly questionItems?: ReadonlyMap<string, readonly string[]> | undefined;
  readonly draft: ReadonlyMap<string, unknown>;
  /**
   * Item ID to the value the item shows: its draft value, else the value its question's latest
   * answer holds for it; an item with no entry shows its props as sent. The draft record itself
   * while no answer holds a widget value. The board as it stands reads it; change marks and
   * counters read the draft record.
   */
  readonly shown: ReadonlyMap<string, unknown>;
  /**
   * The IDs of the items whose fields hold an entry, text they cannot read as a value (layouts,
   * design decision 6): the Tabs read it for the mark of a tab that holds a field to correct. The
   * shell sets it on the board a rendered item reads; absent when no item holds one.
   */
  readonly entries?: ReadonlySet<string> | undefined;
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
  /**
   * The item's result as it holds it: the one it put into the draft record, else its latest
   * answer's, read-only once the question is answered; undefined while it has none. Distinct from
   * `value`, the edited content (widget-registry, design decision 9).
   */
  readonly result: unknown;
  /**
   * Puts the item's result into the draft record, apart from its edited value, `undefined` for
   * none; nothing leaves the view (AD-9). A widget holds no result while the user has given none.
   */
  readonly onResultChange: (result: unknown) => void;
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
  /**
   * The text the item's field holds that it cannot read as a value, or whose value a bound refuses
   * (atoms, design decision 3): kept in the draft record apart from the item's value and result,
   * restored after a reload and never part of an answer. A field shows it as typed while there is
   * one, else its result formatted for entry; undefined while it has none or the item is read-only.
   */
  readonly entry: string | undefined;
  /**
   * Puts the field's unreadable text into the draft record as its entry, cut at 200 code points, an
   * empty text or `undefined` for none, which also clears the item's result; only the NumberField,
   * MoneyField and DateField hold one, and nothing leaves the view (AD-9).
   */
  readonly onEntryChange: (entry: string | undefined) => void;
  /**
   * Renders one item the layout holds through the port, in its own item frame and error boundary,
   * with the question's ID, its item IDs, the card's read-only state, the shown answer and the
   * revision step, so that a nested item has its own value, result and entry (layouts, design
   * decision 6). The shell sets it on every item; a layout's component with no `renderItem`
   * throws, which shows its error state.
   */
  readonly renderItem?: (item: BoardWidgetItem) => ReactNode;
  /**
   * The text each cell of the item holds that gives no value (table-widget, design decision 8), by
   * cell, `row.field`: kept in the draft record apart from the item's value and result, restored
   * after a reload and never part of an answer. The map is empty while the item holds none or is
   * read-only; only a Table holds any.
   */
  readonly cellEntries: ReadonlyMap<string, string>;
  /**
   * Replaces the item's whole map of cell entries in the draft record, each text cut at 200 code
   * points and each empty one dropped; an empty map removes them. Only a Table holds any, and
   * nothing leaves the view (AD-9).
   */
  readonly onCellEntriesChange: (entries: ReadonlyMap<string, string>) => void;
};

export type CatalogComponent<Item = unknown, Value = unknown> = (
  props: ItemProps<Item, Value>,
) => ReactNode;

/**
 * What the shell needs of a component's widget type beyond rendering it (widget-registry, design
 * decision 8), given by its chunk when it registers: the element shape of its props, for the one
 * generic diff of the agent's change (a type with none is not listed), and the string key of its
 * name in the agent-change notice (a type with none is named by its type as sent). The shell holds
 * no table by widget type.
 */
export type ComponentFacts = {
  readonly shape?: (props: unknown) => ElementShape;
  readonly name?: StringKey;
  /**
   * Whether the item's result requires a reason (approval-scale-ranking, design decision 5): while
   * it gives a pair for the result the item holds or shows, the question's open prompt reads
   * `label` and is required, and `missing` is its field error.
   */
  readonly reason?: (result: unknown) => ReasonStrings | undefined;
  /**
   * A revision of a question holding such an item asks first once the agent has received the
   * latest answer (approval-scale-ranking, design decision 5).
   */
  readonly confirmsRevision?: true;
  /**
   * Whether the type takes `result` for an item with `props`, by the contract's shape check and
   * its check of a result against props, the two `widgetResultFits` runs (approval-scale-ranking,
   * pre-PR reviews): the shell holds or seeds a result only while this says true, so a draft never
   * holds one `ask-core` would refuse. Every type that gives a result registers it; the shell
   * takes no result for a type that did not, never any. The shell cannot import the registry, so
   * each chunk registers it over the contract's own functions.
   */
  readonly fits?: (result: unknown, props: unknown) => boolean;
  /**
   * Whether the item shows `value`, the whole edited props it put into the draft, on a revision
   * whose props are `props` (latex-kanban-timeline, task 5b.2; security review X-2): the item's own
   * `shownProps` asks the same function, and the shell holds a value across an agent's change only
   * while it says true, so an answer sends what the item shows (AD-10, AD-20). A type that gives no
   * such value registers none, and the shell keeps its values as they are.
   */
  readonly valueFits?: (value: unknown, props: unknown) => boolean;
  /**
   * Why the item's result fails its field check, if it does (form-widget, design decisions 2 and
   * 5): `result` is `undefined` while the item holds none, and a `required` failure is that case
   * alone. The shell blocks "Answer" while any field of a question fails it, apart from fit: a
   * value that fails only its check still fits and stays in the draft. Each chunk of an input
   * field registers its contract function (the TextField's also runs its pattern, which only the
   * board does); a type that registers none never blocks.
   */
  readonly check?: (result: unknown, props: unknown) => FieldCheckFailure | undefined;
  /**
   * The item's result points into the agent's content of the revision it was made on (document-
   * review, design decision 15): a passage quoted from a document's text, a place on an image. On a
   * revision the board cannot show, after a reload or a takeover under kept work, such a result
   * would be made on one revision's content and sent naming another's, so the item is read-only
   * then, as an item that registers `shape` is (`readOnlyItemsOf`), and its field check is not
   * run, since the content it places against is not the content the answer names. A type whose
   * result means the same on any revision (a Scale's value, a TextField's text) registers none.
   */
  readonly revisionBound?: true;
  /**
   * The type's key table (keyboard-shortcuts-help, design decision 5): the item frame of a type that
   * registers one gives its widget the keys panel, which lists the table's entries by group, opens
   * on the Keys button and on `?`, and lists only the entries marked `readOnly` while the item
   * takes no edits. The chunk registers the contract's table for its type, as it registers `fits`
   * and `check`, so the shell imports no registry. A type with no table registers none.
   */
  readonly keys?: KeyTable;
};

/** The two strings a required reason uses: the open prompt's label and its field error. */
export type ReasonStrings = { readonly label: StringKey; readonly missing: StringKey };

const components = new Map<string, CatalogComponent>();
const facts = new Map<string, ComponentFacts>();

/**
 * Registers a component under its catalog name, once, with the facts its chunk gives of its type,
 * if any. The renderer hands it only the items its name renders and the values it put in the draft
 * record itself, which no type can say across chunks: the registry keeps components by name alone.
 */
export const register = <Item, Value>(
  name: string,
  component: CatalogComponent<Item, Value>,
  componentFacts?: ComponentFacts,
): void => {
  if (components.has(name)) throw new Error(`the component "${name}" is registered twice`);
  components.set(name, component as unknown as CatalogComponent);
  if (componentFacts !== undefined) facts.set(name, componentFacts);
};

/** The component registered under a name, if any. */
export const componentFor = (name: string): CatalogComponent | undefined => components.get(name);

/** The facts a component's chunk registered with it, if it gave any. */
export const componentFacts = (name: string): ComponentFacts | undefined => facts.get(name);

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
 * The ask's language, which the shell provides for the board (settings-languages design decision
 * 9): the view's own strings, the catalog components' included, are in it; en-US when none is
 * provided.
 */
export const LanguageContext = createContext<Locale>("en-US");

/** The ask's language, for a text made outside a lookup. */
export const useLanguage = (): Locale => useContext(LanguageContext);

/** A string lookup in one language: the shape `useStrings` returns and the widgets' models take. */
export type { Slots, StringKey };

export type Say = (key: StringKey, slots?: Slots) => string;

/** The string `key` in `language`, for a text made outside a component (a widget model's). */
export const say = (language: Locale, key: StringKey, slots?: Slots): string =>
  t(language, key, slots);

/** The lookup of the view's own strings in the ask's language. */
export const useStrings = (): ((key: StringKey, slots?: Slots) => string) => {
  const language = useLanguage();
  return useCallback((key: StringKey, slots?: Slots) => t(language, key, slots), [language]);
};

/** The ask's locale, for the values the board shows (design decision 8); en-US when none is provided. */
export const LocaleContext = createContext<Locale>("en-US");

/** The ask's locale, which may differ from its language. */
export const useLocale = (): Locale => useContext(LocaleContext);

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
  /**
   * Asks the board page to open a link of Markdown in a new tab (atoms, design decision 6): the
   * item that holds the Markdown, a Text or the question whose option preview holds it, and the
   * URL. The page opens it only when its own board document says the item holds Markdown.
   */
  readonly openLink: (itemId: string, url: string) => void;
};

export const HostContext = createContext<ViewHost>({
  hosted: true,
  openReference: () => {},
  openLink: () => {},
});

export const useHosted = (): boolean => useContext(HostContext).hosted;

export const useOpenReference = (): ((itemId: string) => void) =>
  useContext(HostContext).openReference;

/** The theme in effect, as DESIGN's tokens resolve it: `dark` while the root holds the class. */
export type { Theme };

/** What the theme reads of a class list: a DOM token list, or the names themselves. */
export type ClassList = Pick<DOMTokenList, "contains"> | readonly string[];

/**
 * The theme a class list gives (chart-widget, design decision 6): dark while it holds `dark` as a
 * whole token, else light. The pure core of `useTheme`; `applyTheme` sets the class.
 */
export const themeOfClasses = (classes: ClassList): Theme =>
  (Array.isArray(classes) ? classes.includes("dark") : (classes as DOMTokenList).contains("dark"))
    ? "dark"
    : "light";

/** The subscription `useSyncExternalStore` takes, for the theme. */
export type ThemeStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => Theme;
};

/**
 * A store of the theme of `root`, whose class attribute one observer watches for as long as any
 * listener is subscribed, however many there are (chart-widget, design decision 6). `Observer` is
 * the platform's `MutationObserver`, or a stand-in.
 */
export const createThemeStore = <Root extends { readonly classList: ClassList }>(
  root: Root,
  Observer: new (
    callback: () => void,
  ) => { observe(target: Root, options: MutationObserverInit): void; disconnect(): void },
): ThemeStore => {
  const listeners = new Set<() => void>();
  let observer: { disconnect(): void } | undefined;
  return {
    getSnapshot: () => themeOfClasses(root.classList),
    subscribe: (listener) => {
      listeners.add(listener);
      if (observer === undefined) {
        const made = new Observer(() => {
          for (const each of [...listeners]) each();
        });
        made.observe(root, { attributes: true, attributeFilter: ["class"] });
        observer = made;
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && observer !== undefined) {
          observer.disconnect();
          observer = undefined;
        }
      };
    },
  };
};

const LIGHT_STORE: ThemeStore = { subscribe: () => () => {}, getSnapshot: () => "light" };

let pageStore: { readonly root: HTMLElement; readonly store: ThemeStore } | undefined;

// The store of the page's document root, made at first use; a page with no document has none.
const storeOfPage = (): ThemeStore => {
  if (typeof document === "undefined") return LIGHT_STORE;
  const root = document.documentElement;
  if (pageStore?.root !== root) {
    pageStore = { root, store: createThemeStore<HTMLElement>(root, MutationObserver) };
  }
  return pageStore.store;
};

/**
 * The theme in effect, light or dark, re-rendering the component when the document's root takes or
 * loses the `dark` class (chart-widget, design decision 6; DESIGN, Dark theme mechanism): the same
 * on the board and in a Snapshot, whose view sets the class itself. One observer serves the page.
 */
export const useTheme = (): Theme => {
  const store = storeOfPage();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
};

export const useOpenLink = (): ((itemId: string, url: string) => void) =>
  useContext(HostContext).openLink;

// The key helpers and the key hint and Keys button of the port (keyboard-shortcuts-help, design
// decisions 3 to 5), which the chunks reach through this module like every other name here.

export type { KeyInEffect, KeySource } from "./keys/effective.ts";
export { KeyHint, KeysButton, useKeysPanel } from "./keys/key-help.tsx";
export { useKeyTable } from "./keys/key-table.tsx";
export type { KeysPanelControl } from "./keys/keys-button.ts";
export { type KeyPlatform, keyLabel, useKeyPlatform } from "./keys/label.ts";
export { isTextTarget, type KeyEventFields, keyPressOf } from "./keys/press.ts";
