// The toolbar's handlers (document-review, design decision 9), as plain functions over structural
// parts so that they are tested without a DOM: the elements only hand them to React.

import { type KeyEventFields, keyPressOf } from "@askboard/view/catalog";
import { toolbarFocus, toolbarPressMove } from "../shared/toolbar-focus.ts";

type Ref<T> = { current: T };
type Focusable = { focus(): void };

/** The ref callback that records the tool button at `place`. */
export const recordTool =
  <T>(buttons: Ref<(T | null)[]>, place: number) =>
  (node: T | null): void => {
    buttons.current[place] = node;
  };

/**
 * The horizontal arrows, Home and End, held with no modifier, move the focus among the enabled
 * tools; with any other hold the key is the browser's and its default stays.
 */
export const toolbarKeys =
  (enabled: readonly boolean[], at: number, buttons: Ref<(Focusable | null)[]>) =>
  (event: KeyEventFields & { preventDefault(): void }): void => {
    const move = toolbarPressMove(keyPressOf(event));
    if (move === undefined) return;
    event.preventDefault();
    buttons.current[toolbarFocus(enabled, at, move)]?.focus();
  };

/**
 * A press keeps the selection in the document: the mousedown default, which would move the focus
 * to the button and collapse the selection, is prevented. The click still comes.
 */
export const keepSelection = (event: { preventDefault(): void }): void => event.preventDefault();

/** The tool takes the toolbar's Tab stop when it gets the focus. */
export const holdStop = (setAt: (place: number) => void, place: number) => (): void => setAt(place);

/** The tool's press. */
export const pressTool =
  <Tool>(tool: Tool, onTool: (tool: Tool) => void) =>
  (): void =>
    onTool(tool);
