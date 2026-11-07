// The Toggle's classes (DESIGN.md: Input atoms, Switch), on the token utilities only, each written
// out in full so that Tailwind finds it in the chunk's own sources.

/** The switch, its label, its state and "Clear" on one line, wrapping on a narrow card. */
export const ROW = "flex min-w-0 flex-wrap items-center gap-sm";

/** Radix's switch: off on `muted` with the input border, on `primary`; the focus ring; disabled dimmed. */
export const ROOT =
  "inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border border-input bg-muted p-[2px] " +
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "data-[disabled]:opacity-50";

/** The thumb: a `card` disc that moves to the end when on. */
export const THUMB =
  "block size-[12px] rounded-full bg-card data-[state=checked]:translate-x-[14px]";

/** The label beside the switch, always visible. */
export const TOGGLE_LABEL = "text-body font-semibold text-foreground";

/** "Not set" in `muted-foreground`; "On" and "Off" in the code type once set. */
export const STATE = "text-body text-muted-foreground";
export const STATE_SET = "font-mono text-code text-foreground";
