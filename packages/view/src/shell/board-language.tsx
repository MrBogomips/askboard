// The board's language for everything the shell renders (settings-languages design decision 9;
// spec view-and-widgets, "The board's interface in the ask's language"): the board document's,
// en-US when it holds none, provided through the port so that the catalog components' strings
// follow it too. No control changes it.

import { type ReactNode, useSyncExternalStore } from "react";
import { LanguageContext } from "../catalog/port.ts";
import { languageOf } from "../strings/language.ts";
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
    <LanguageContext.Provider value={languageOf(document)}>{children}</LanguageContext.Provider>
  );
};
