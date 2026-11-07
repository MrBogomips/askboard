// The DateField's calendar classes (DESIGN.md: Input atoms, Date Picker, Focus ring, elevation), on the
// token utilities only, each written out in full so that Tailwind finds it in the chunk's own sources;
// react-day-picker's own stylesheet is not used, and no element takes a `style` attribute (AD-8). The
// state classes of a day are read from the data attributes react-day-picker puts on its cell.

/** The calendar button after the field: a square button in the toolbar-button look. */
export const CALENDAR_BUTTON =
  "inline-flex size-[28px] shrink-0 items-center justify-center rounded-md border border-border bg-muted " +
  "text-foreground not-disabled:hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring";

/** The non-modal popover: `popover` colours with `{elevation.shadow-md}`. */
export const POPOVER =
  "z-50 rounded-md border border-border bg-popover p-sm text-popover-foreground shadow-md " +
  "focus-visible:outline-none";

/** react-day-picker's `classNames`, by its part names. */
export const DAY_PICKER_CLASSES = {
  root: "text-body text-foreground",
  months: "relative flex flex-col",
  month: "flex flex-col gap-xs",
  month_caption: "flex h-[28px] items-center justify-center",
  caption_label: "text-body font-semibold text-foreground",
  nav: "absolute inset-x-0 top-0 flex h-[28px] items-center justify-between",
  button_previous:
    "inline-flex size-[28px] items-center justify-center rounded-md hover:bg-muted " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-40",
  button_next:
    "inline-flex size-[28px] items-center justify-center rounded-md hover:bg-muted " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-40",
  chevron: "size-[14px] fill-foreground",
  month_grid: "border-collapse",
  weekdays: "",
  weekday: "size-[32px] text-center text-badge font-medium text-muted-foreground",
  weeks: "",
  week: "",
  day: "group p-0 text-center",
  day_button:
    "inline-flex size-[32px] items-center justify-center rounded-md text-body text-foreground " +
    "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
    "group-data-[today]:border group-data-[today]:border-primary " +
    "group-data-[outside]:text-muted-foreground " +
    "group-data-[disabled]:cursor-not-allowed group-data-[disabled]:text-muted-foreground group-data-[disabled]:opacity-40 group-data-[disabled]:hover:bg-transparent " +
    "group-data-[selected]:bg-primary group-data-[selected]:text-primary-foreground group-data-[selected]:hover:bg-primary",
} as const;
