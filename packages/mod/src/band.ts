// The pending asks above the prompt (PO decisions of 2026-11-03, live run 11.3 and the band's
// recheck; mod spec, "Pending-asks list"; design decision 7, Pending asks): a `ui.render` hook on
// `AbovePrompt` draws a header, "🙋 AskBoard · <n> pending", and one row per pending ask,
// "🙋 AskBoard › <title>", the title being the label of the link to its board, the header and the
// prefix in the accent colour and the title in the terminal's link style. On a narrow band only the
// title is cut, ending with "…": the prefix stays whole, so an ask always takes one row. With no ask pending, or while a survey holds the band, the hook passes to the plugins
// beneath, which it otherwise draws below its rows. The list is the mod's memory of the last poll
// (`pending.ts`), which redraws the band when the list changes; the elements are the surface's own
// constructors, called without JSX.

import { agentTextPiece, type PendingAsk } from "@askboard/contract";
import type { Memory } from "./memory.ts";
import type { AbovePromptInput, BandElements, ModApi, RenderElement } from "./mod-api.ts";
import { headerOf, ROW_PREFIX, ROW_PREFIX_COLUMNS } from "./pending.ts";

/**
 * AskBoard's accent in the band: the colour name nearest DESIGN.md's petrol `primary`, which each
 * terminal draws from its own palette, so it stays legible on light and dark themes.
 */
export const ACCENT = "cyan";

/** A pending ask's title in a band `columns` cells wide: cut with "…" so that its row fits. */
export const titleIn = (title: string, columns: number): string =>
  agentTextPiece(title, Math.max(columns - ROW_PREFIX_COLUMNS, 1));

// A row Box holding the prefix, a Text in the accent colour, and a Link whose label is the title.
// On Claude Code 2.1.317's terminal a Link that is a Box's own child draws as an underlined link in
// the terminal's link style; one inside a Text, or holding a Text, draws its text and then its
// address (the PO's live checks of efdc595 and 96d34a9). So the title takes the link style, not
// the accent.
const rowOf = (
  { Box, Text, Link }: BandElements,
  ask: PendingAsk,
  columns: number,
): RenderElement =>
  Box({
    flexDirection: "row",
    children: [
      Text({ color: ACCENT, children: ROW_PREFIX }),
      Link({ href: ask.link, label: titleIn(ask.title, columns) }),
    ],
  });

/** The band's hook: the pending asks' rows above what the plugins beneath draw, or a pass. */
export const drawBand = async (
  memory: Memory,
  $: ModApi,
  e: AbovePromptInput,
  next: (e: AbovePromptInput) => Promise<RenderElement>,
): Promise<RenderElement> => {
  const { pending } = memory;
  if (pending.length === 0 || e.props.hasSurvey) return next(e);
  const elements = $.ui.resolve(e);
  return elements.Box({
    flexDirection: "column",
    children: [
      elements.Text({ color: ACCENT, wrap: "truncate-end", children: headerOf(pending.length) }),
      ...pending.map((ask) => rowOf(elements, ask, e.props.bodyColumns)),
      await next(e),
    ],
  });
};
