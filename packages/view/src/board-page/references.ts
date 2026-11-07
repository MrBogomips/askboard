// What the board page opens for a reference (excerpts, design decision 7; AD-8): it reads the URL
// from the board document it holds, never from the view's message, and only for an item that is a
// reference of that document whose URL is `http:` or `https:`.

import { nestedWidgetItemsOf } from "../nested-items.ts";
import { questionsOf, type ViewDocument, type WidgetItem } from "../view-document.ts";

/** The context item of the board document with this ID, if it holds one. */
export const boardItemOf = (
  document: ViewDocument | undefined,
  itemId: string,
): WidgetItem | undefined =>
  document === undefined
    ? undefined
    : questionsOf(document)
        .flatMap((question) => nestedWidgetItemsOf(question.props.items))
        .find((item) => item.id === itemId);

const isWebUrl = (text: string): boolean => {
  try {
    const { protocol } = new URL(text);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * The file a FILE reference or an excerpt names, as its pointer reads in the board document: what
 * opens in the reading panel. None for an excerpt the agent wrote and for any other item.
 */
export const sourcePointerOf = (
  document: ViewDocument | undefined,
  itemId: string,
): string | undefined => {
  const item = boardItemOf(document, itemId);
  if (item?.type !== "reference" && item?.type !== "excerpt") return undefined;
  const props = item.props;
  if (typeof props !== "object" || props === null || !Object.hasOwn(props, "pointer")) {
    return undefined;
  }
  const pointer = (props as { readonly pointer?: unknown }).pointer;
  return typeof pointer === "string" && pointer !== "" ? pointer : undefined;
};

/** The URL of a web or GitHub reference of the board document, if the item is one. */
export const webUrlOf = (
  document: ViewDocument | undefined,
  itemId: string,
): string | undefined => {
  const item = boardItemOf(document, itemId);
  if (item?.type !== "reference") return undefined;
  const props = item.props;
  if (typeof props !== "object" || props === null || !Object.hasOwn(props, "url")) return undefined;
  const url = (props as { readonly url?: unknown }).url;
  return typeof url === "string" && isWebUrl(url) ? url : undefined;
};
