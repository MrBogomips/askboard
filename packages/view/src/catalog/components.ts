// Which catalog component renders each item of a board document (AD-9): the shell renders by it,
// and `assemble` picks the component chunks a board needs by it. The component's name is also its
// chunk's name, the folder under `catalog/` that holds it (design decision 7).

import type { BoardDocument } from "@askboard/contract";

/** The Choice atom: Radix Radio Group for one choice, Checkbox for several (design decision 8). */
export const CHOICE = "choice";

type Item = BoardDocument["items"][number];

/** E1's only item is the plain question, whose options the Choice atom shows. */
export const componentOf = (item: Item): string => {
  switch (item.type) {
    case "question":
      return CHOICE;
  }
};

/** The components a board needs, each once, by name. */
export const componentsOf = (document: BoardDocument): string[] =>
  [...new Set(document.items.map(componentOf))].sort();
