// The shared annotation card's handlers (document-review, design decision 9), as plain functions
// over structural parts so that they are tested without a DOM: the card's elements only hand them
// to React and to Radix.

import type { CardField } from "./card.tsx";

type Ref<T> = { current: T };
type Focusable = { focus(): void };

/** "Edit": the card starts writing, and focus will move to its first field. */
export const editPress =
  (switched: Ref<boolean>, setWriting: (writing: boolean) => void) => (): void => {
    switched.current = true;
    setWriting(true);
  };

/** A textarea's change: its text, through the caller's callback, as the user types (AD-9). */
export const fieldInput =
  (field: Pick<CardField, "onChange">) =>
  (event: { readonly currentTarget: { readonly value: string } }): void =>
    field.onChange(event.currentTarget.value);

/** A ref callback recording the first field's node. */
export const recordNode =
  <T>(first: Ref<T | null>) =>
  (node: T | null): void => {
    first.current = node;
  };

/**
 * The effect after "Edit": the button that held focus is gone, so focus goes to the first field,
 * but only after a switch, never when the card opens writing (the popover's own focus runs then).
 */
export const focusAfterEdit =
  (writing: boolean, switched: Ref<boolean>, first: Ref<Focusable | null>) => (): void => {
    if (writing && switched.current) first.current?.focus();
  };

/** Opening: focus goes to the field marked for it, else to the card, never to the header. */
export const openFocus =
  (card: Ref<(Focusable & { querySelector(selector: string): Focusable | null }) | null>) =>
  (event: { preventDefault(): void }): void => {
    event.preventDefault();
    const field = card.current?.querySelector("[data-annotation-focus]");
    (field ?? card.current)?.focus();
  };

/** Closing: focus returns to the target the caller names, the pin or the document. */
export const closeFocus =
  (target: () => Focusable | null | undefined) =>
  (event: { preventDefault(): void }): void => {
    event.preventDefault();
    target()?.focus();
  };
