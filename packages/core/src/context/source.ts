// What `board-host` asks of an item's source (excerpts, design decision 4, For `board-host`; AD-8):
// only a pointer excerpt or a pointer reference of the ask's current board document has one. Its
// pointer is resolved and confined again at each call, against the ask's root, so a file swapped
// after the send is judged as it is now.

import type { BoardContextItem } from "@askboard/contract";
import type { SourceState, SourceText, SourceUnavailable } from "./ports.ts";

/** A source the reading panel and the source view read, each call reading the file again. */
export type Source = {
  /** Its state now; for an excerpt, whether its range now differs from the text the board shows. */
  state(): Promise<SourceState>;
  /** Its text for the source view. */
  text(): Promise<SourceText>;
};

/** "Open in editor": the confined real path, and a line, always given. */
export type EditorLaunchTarget = { readonly file: string; readonly line: number };

/** A source with no root to read it from, or one whose read failed. */
export const MISSING: SourceUnavailable = { status: "missing" };

/** An item's pointer, the text the board shows of it, and the first line the send found. */
export type PointerSource = {
  readonly pointer: string;
  readonly sentText?: string;
  readonly line?: number;
};

/** The pointer source of a pointer excerpt or pointer reference; undefined for any other item. */
export const pointerSourceOf = (item: BoardContextItem): PointerSource | undefined => {
  if (item.type === "image" || !("pointer" in item.props)) return undefined;
  const { props } = item;
  if (props.status === "unresolved") return { pointer: props.pointer };
  if ("text" in props) {
    return { pointer: props.pointer, sentText: props.text, line: props.lines.start };
  }
  return {
    pointer: props.pointer,
    ...(props.lines === undefined ? {} : { line: props.lines.start }),
  };
};
