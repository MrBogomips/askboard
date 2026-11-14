// The shared annotation pin (document-review, design decision 7; DESIGN.md: Annotation pin): a
// numbered button in the change colour, whose accessible name holds its number. Where it stands
// is the caller's: a portal into a passage's slot in a Document review, an overlay's button over
// an image. It passes its attributes and ref on, so that the card can take it as its anchor.

import { useStrings } from "@askboard/view/catalog";
import type { ComponentProps } from "react";
import { PIN } from "./classes.ts";

export type PinProps = Omit<ComponentProps<"button">, "children" | "type"> & {
  /** The pin's number, which it shows and its name holds. */
  readonly number: number;
  /** The accessible name when the caller has a better one ("Comment 3"); "Pin {number}" otherwise. */
  readonly label?: string;
};

export const Pin = ({ number, label, className, ...rest }: PinProps) => {
  const text = useStrings();
  return (
    <button
      {...rest}
      type="button"
      aria-label={label ?? text("annotations.pin", { number })}
      className={className === undefined ? PIN : `${PIN} ${className}`}
    >
      {number}
    </button>
  );
};
