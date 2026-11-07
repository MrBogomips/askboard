// The Chart's agent text (chart-widget, design decision 3; NFR-5, AD-8): every label, series name,
// axis label and unit reaches the canvas as data. Pure, no DOM and no chart library.
//
// The chart library reads `{name|text}` in any text that has `rich` styles as markup (zrender's
// `STYLE_REG`, `lib/graphic/helper/parseText.js`), and its rich tooltip always has them, so an
// agent's label would be styled by whatever it names. `chartText` writes a U+2060 WORD JOINER after
// each `{` the rule could open: zero-width and no line break, it stops the match and draws as
// written. The tests run zrender's own parser on the result and fail if the rule changes.

import { agentTextRuns, formatNumber, type Locale } from "@askboard/contract";

const WORD_JOINER = "⁠";

// The opening of a style: a brace followed by what STYLE_REG's name and bar need.
const OPENER = /\{(?=[a-zA-Z0-9_]+\|)/g;

/**
 * Agent text with controls and bidirectional characters as visible `\uXXXX` escapes (the board's
 * rule for agent text), and nothing else changed: what the DOM shows, which is no markup.
 */
export const escapedText = (text: string): string =>
  agentTextRuns(text)
    .map((run) => run.text)
    .join("");

/**
 * Agent text as the canvas shows it: the escapes of `escapedText`, a word joiner after every `{`
 * that the chart library's markup rule could open, and a word joiner at the start. The first stops
 * the markup; the second keeps the text, and every prefix of it, from being an inherited name
 * (`__proto__`, `constructor`, ...), which the library's cache of text widths, a plain object keyed
 * by the text, would take for an entry of its own (review of groups 1 to 4, X-1). The joiner draws
 * nothing. Applying it twice gives what applying it once gives.
 */
export const chartText = (text: string): string => {
  const joined = escapedText(text).replace(OPENER, `{${WORD_JOINER}`);
  return joined.startsWith(WORD_JOINER) ? joined : `${WORD_JOINER}${joined}`;
};

const withUnit = (number: string, unit: string | undefined, say: (text: string) => string) =>
  unit === undefined ? number : `${number} ${say(unit)}`;

/**
 * A value as the axis and the tooltip show it on the canvas: the number in the ask's locale, then
 * the unit, if the chart has one, as chart text (the unit is the agent's).
 */
export const formatChartValue = (value: number, locale: Locale, unit?: string): string =>
  withUnit(formatNumber(value, locale), unit, chartText);

/** The same for the DOM, the live region's: the unit as `escapedText`, with no joiner. */
export const formatReadingValue = (value: number, locale: Locale, unit?: string): string =>
  withUnit(formatNumber(value, locale), unit, escapedText);
