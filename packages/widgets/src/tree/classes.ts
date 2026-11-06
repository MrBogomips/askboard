// The Tree's classes (DESIGN.md: Widget frame, Tree, Focus ring, Change highlight), from the
// design tokens as the view's Choice uses them. Every class is written out in full, so that
// Tailwind finds it in the chunk's own sources, and no element takes a `style` attribute (AD-8):
// the indent is one class per level, for each of the contract's 8 levels. The view's root font is
// 13px, so the measures DESIGN.md gives in pixels are written in pixels.

import type { TreeColumnType } from "@askboard/contract";

/** The bordered frame around the toolbar row and the grid. */
export const FRAME = "flex flex-col rounded-md border border-border bg-card";

/** The toolbar row on `muted`, `spacing.toolbar-row` high, above the grid. */
export const TOOLBAR =
  "flex h-[32px] items-center gap-2 rounded-t-md border-b border-border bg-muted px-2";

/** The tools, on the toolbar row's left. */
export const TOOLS = "flex items-center gap-[4px]";

/**
 * A tool: `button-secondary`, `spacing.control-height` high, with the focus ring; a disabled tool
 * takes `button-disabled`'s look.
 */
export const TOOL =
  "h-[28px] shrink-0 rounded-md border border-border bg-muted px-[12px] text-control " +
  "text-foreground not-aria-disabled:hover:bg-card focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring aria-disabled:text-muted-foreground " +
  "aria-disabled:opacity-50";

/** The question before a delete, in the toolbar row: a long name is cut, never the count. */
export const QUESTION = "flex min-w-0 items-center gap-[4px] text-control text-foreground";

export const QUESTION_NAME = "min-w-0 truncate";

/** The question's `fieldset`, in the tools' place, which would otherwise keep its content's width. */
export const QUESTION_ROW = "flex min-w-0 items-center gap-2";

/** The counter of the user's changes, at the toolbar row's right; the question never pushes it out. */
export const COUNTER =
  "ml-auto flex shrink-0 items-center gap-[6px] text-control text-foreground-secondary";

/** The change dot, `{colors.change}`: the counter's mark, and a moved row's after its name. */
export const CHANGE_DOT = "size-[8px] shrink-0 rounded-full bg-change";

export const QUESTION_REST = "shrink-0";

/** A confirmed delete's refusal, after the question's buttons: the plan's limit it would pass. */
export const QUESTION_ERROR = "min-w-0 truncate text-control text-destructive-text";

/** The grid: a fixed layout, so that the field columns keep their widths and the name takes the rest. */
export const GRID = "w-full table-fixed border-collapse";

/** The header row of column names, `spacing.header-row` high, in `typography.label` on `muted`. */
export const HEADER_ROW = "h-[32px] bg-muted text-label text-muted-foreground uppercase";

/** The name column's header. */
export const NAME_HEADER = "px-2 text-left";

/** A node's row, as tall as the mockup's grid rows, with a rule above it. */
export const ROW = "h-[36px] border-t border-border text-body text-foreground";

/** The name's cell, which takes the room the field columns leave. */
export const NAME_CELL = "px-2";

/** A field column's width and alignment by its type: numbers right-aligned, in the code face. */
export const FIELD_CELL: Readonly<Record<TreeColumnType, string>> = {
  number: "w-36 px-2 text-right font-mono text-code",
  text: "w-48 truncate px-2",
};

/** A field's cell while it is edited: text cells no longer clip, so the editor's ring shows. */
export const EDITED_FIELD_CELL: Readonly<Record<TreeColumnType, string>> = {
  number: FIELD_CELL.number,
  text: "w-48 px-2",
};

/** A field's column header, as wide and aligned as its cells. */
export const FIELD_HEADER: Readonly<Record<TreeColumnType, string>> = {
  number: "w-36 px-2 text-right",
  text: "w-48 px-2 text-left",
};

/**
 * The current row (spec, "Tree current row"): a `primary-subtle` fill on the row and a 2px
 * `primary` bar on the name cell's left edge, shown whether or not the row has the keyboard focus.
 * An added row keeps its change bar, inside the current one.
 */
export const CURRENT_ROW = "bg-primary-subtle";

export const CURRENT_BAR = "shadow-[inset_2px_0_0_0_var(--primary)]";

export const CURRENT_ADDED_BAR =
  "shadow-[inset_2px_0_0_0_var(--primary),inset_4px_0_0_0_var(--change)]";

/** The name's indent, `spacing.lg` per level below the first (DESIGN.md, Tree), by level. */
export const INDENT: readonly string[] = [
  "pl-0",
  "pl-[16px]",
  "pl-[32px]",
  "pl-[48px]",
  "pl-[64px]",
  "pl-[80px]",
  "pl-[96px]",
  "pl-[112px]",
];

/** The indent class of a 1-based level; a level past the contract's 8 takes the deepest. */
export const indentOf = (level: number): string =>
  INDENT[Math.min(Math.max(level, 1), INDENT.length) - 1] ?? "";

/** The focus ring on a focused row or cell (DESIGN.md, Focus ring): 2px of `ring`, offset 1px. */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The chevron's box, in `muted-foreground`; it turns to point down when its node is open. */
export const CHEVRON = "flex size-4 shrink-0 items-center justify-center text-muted-foreground";

export const CHEVRON_OPEN = "rotate-90";

/** The name, semibold on a parent row (DESIGN.md, Tree). */
export const NAME = "truncate";

export const PARENT_NAME = "truncate font-semibold";

/**
 * A renamed name (DESIGN.md, Change highlight): on the change fill in the change text, with the
 * change border, which keeps the mark at 3:1 against its surface.
 */
export const RENAMED = "rounded-md border border-change bg-change-subtle px-[4px] text-change-text";

/**
 * A changed field's cell: the change fill and text, and the change border as an inset ring, which
 * leaves the table's layout and the focus ring's outline as they are.
 */
export const CHANGED_FIELD = "bg-change-subtle text-change-text inset-ring inset-ring-change";

/** An added row's 2px change bar on its left edge, drawn on its name's cell. */
export const ADDED_BAR = "shadow-[inset_2px_0_0_0_var(--change)]";

// The input atoms' look (DESIGN.md, Input atoms) with the focus ring, as on every focusable
// element, and the destructive border of a refused entry.
const EDITOR_BASE =
  "h-[28px] w-full min-w-0 rounded-md border border-input bg-card px-1.5 text-body " +
  "text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring aria-invalid:border-destructive";

/** The cell editor and, under it, a number's echo; it takes the cell's width. */
export const EDITOR_BOX = "flex min-w-0 flex-1 flex-col gap-0.5 py-1";

/** A name's or a text's editor, in the input atoms' look, its border `field-error`'s when refused. */
export const EDITOR = EDITOR_BASE;

/** A number's editor: a text input, right-aligned in the code face as the cell's number is. */
export const NUMBER_EDITOR = `${EDITOR_BASE} text-right font-mono text-code`;

/** An input and its unit affix side by side, as an Input Group (DESIGN.md, Input atoms). */
export const AFFIX_GROUP = "flex min-w-0 items-center gap-1";

/** The unit affix after an input, in the code face and muted. */
export const AFFIX = "shrink-0 font-mono text-code text-muted-foreground";

/** A number's parsed value, echoed in the code face (DESIGN.md, Input atoms). */
export const ECHO = "text-right font-mono text-code text-muted-foreground";

/** The `field-error` line under the edited row (DESIGN.md, Field error). */
export const FIELD_ERROR = "px-2 pb-1.5 text-body text-destructive-text";
