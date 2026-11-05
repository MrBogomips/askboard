// The board's language and locale for everything the shell renders (settings-languages design
// decisions 8 and 9; spec view-and-widgets, "The board's interface in the ask's language" and
// "Values shown in the ask's locale"): the board document's, en-US when it holds none, the locale
// its language when it holds no locale, provided through the port so that the catalog components
// follow them too. No control changes them.

import { type ReactNode, useSyncExternalStore } from "react";
import { LanguageContext, LocaleContext } from "../catalog/port.ts";
import { languageOf, localeOf } from "../strings/language.ts";
import type { BoardView } from "./board.tsx";
import type { Store } from "./store.ts";

export const BoardLanguage = ({
  view,
  children,
}: {
  readonly view: Store<BoardView>;
  readonly children?: ReactNode;
}) => {
  // The server snapshot is the same store, so the provider also renders outside a browser.
  const { document } = useSyncExternalStore(view.subscribe, view.get, view.get);
  return (
    <LanguageContext.Provider value={languageOf(document)}>
      <LocaleContext.Provider value={localeOf(document)}>{children}</LocaleContext.Provider>
    </LanguageContext.Provider>
  );
};
