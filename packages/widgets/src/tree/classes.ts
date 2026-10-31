// The Tree's classes (DESIGN.md: Widget frame, Tree, Focus ring), from the design tokens as the
// view's Choice uses them. Every class is written out in full, so that Tailwind finds it in the
// chunk's own sources, and no element takes a `style` attribute (AD-8): the indent is one class
// per level, for each of the contract's 8 levels. The view's root font is 13px, so the measures
// DESIGN.md gives in pixels are written in pixels.

import type { TreeColumnType } from "@askboard/contract";

/** The bordered frame around the toolbar row and the grid. */
export const FRAME = "flex flex-col rounded-md border border-border bg-card";

/** The toolbar row on `muted`, `spacing.toolbar-row` high, above the grid. */
export const TOOLBAR =
  "flex h-[32px] items-center gap-2 rounded-t-md border-b border-border bg-muted px-2";

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

/** A field's column header, as wide and aligned as its cells. */
export const FIELD_HEADER: Readonly<Record<TreeColumnType, string>> = {
  number: "w-36 px-2 text-right",
  text: "w-48 px-2 text-left",
};

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

/** The chevron's box, in `muted-foreground`; it turns to point down when its node is open. */
export const CHEVRON = "flex size-4 shrink-0 items-center justify-center text-muted-foreground";

export const CHEVRON_OPEN = "rotate-90";

/** The name, semibold on a parent row (DESIGN.md, Tree). */
export const NAME = "truncate";

export const PARENT_NAME = "truncate font-semibold";
