// The pending asks above the prompt (PO decision of 2026-11-03, live run 11.3; mod spec,
// "Pending-asks list"; design decision 7, Pending asks): a `ui.render` hook on `AbovePrompt` draws a
// dim header, "AskBoard · <n> pending", and one row per pending ask, "<title> · <who> · <n> open ·
// <link>", fitted to the band's width: the text before the link is cut, the title first, and the
// link is kept whole; where that leaves the title too little room, the title alone is the link's
// label, so an ask always takes one row. With no ask pending, or while a survey holds the band, the
// hook passes to the plugins beneath, which it otherwise draws below its rows. The list is the
// mod's memory of the last poll (`pending.ts`), which redraws the band when the list changes; the
// elements are the surface's own constructors, called without JSX.

import { agentTextPiece, NOTICE_TEXT_MAX_CHARS, type PendingAsk } from "@askboard/contract";
import type { Memory } from "./memory.ts";
import type { AbovePromptInput, BandElements, ModApi, RenderElement } from "./mod-api.ts";
import { HEAD, points, SEPARATOR, TITLE_MIN_CHARS, tailOf, textOf } from "./pending.ts";

/** A pending ask's row: the text before its link, then the link, as its address or its label. */
export type BandRow = { readonly text: string; readonly link: string; readonly label?: string };

/** A pending ask's row in a band `columns` cells wide. */
export const bandRow = (ask: PendingAsk, columns: number): BandRow => {
  const room = Math.min(columns - points(`${SEPARATOR}${ask.link}`), NOTICE_TEXT_MAX_CHARS);
  if (room < TITLE_MIN_CHARS) {
    return { text: "", link: ask.link, label: agentTextPiece(ask.title, Math.max(columns, 1)) };
  }
  return { text: `${textOf(ask.title, tailOf(ask), room)}${SEPARATOR}`, link: ask.link };
};

const rowOf = (
  { Box, Text, Link }: BandElements,
  { text, link, label }: BandRow,
): RenderElement => {
  const linked = label === undefined ? Link({ href: link }) : Link({ href: link, label });
  const children =
    text === "" ? [linked] : [Text({ wrap: "truncate-end", children: text }), linked];
  return Box({ flexDirection: "row", children });
};

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
  const header = `${HEAD}${SEPARATOR}${pending.length} pending`;
  return elements.Box({
    flexDirection: "column",
    children: [
      elements.Text({ dimColor: true, wrap: "truncate-end", children: header }),
      ...pending.map((ask) => rowOf(elements, bandRow(ask, e.props.bodyColumns))),
      await next(e),
    ],
  });
};
