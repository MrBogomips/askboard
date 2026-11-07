// The Markdown renderer (atoms, design decision 5; view-and-widgets spec: Markdown rendered as data,
// Markdown images, tables and controls, Markdown links in the view, Markdown bounded work; AD-8):
// agent Markdown becomes DOM nodes in two steps that each refuse what the spec forbids, so that a
// slip in one is caught by the other. markdown-it writes HTML with `html` off, only `http:` and
// `https:` links, an image as a link to its source, table alignment as a class, bidirectional and
// other controls as visible escapes, and no attribute but a link's `href`, a list's `start` and the
// alignment classes; DOMPurify then parses that output against the exact allow-list below and
// returns a document fragment, so the component appends nodes and never sets `innerHTML`.
// Document review renders through this module too. Plain ECMAScript apart from the `win` it is
// given: no request, no style, no script.

import { agentTextRuns, TEXT_MAX_CHARS } from "@askboard/contract";
import DOMPurify, { type Config, type DOMPurify as Purifier, type WindowLike } from "dompurify";
import MarkdownIt, { type MarkdownIt as Parser, type Token } from "markdown-it";

/** Block nesting past this is not parsed: the deeper marks show as text (design decision 5). */
export const MARKDOWN_NESTING_MAX = 20;

/** A source holds at most this many code points, a Text's and an option preview's limit. */
export const MARKDOWN_MAX_CHARS = TEXT_MAX_CHARS;

/**
 * The HTML markdown-it writes is at most this many characters before the sanitizer sees it: a
 * reference definition used by many images or links grows a source of `MARKDOWN_MAX_CHARS` code
 * points into megabytes, and past the bound the item shows its source as plain text (checkpoint
 * 1.8 X-2, design decision 5).
 */
export const MARKDOWN_HTML_MAX_CHARS = 200_000;

/** The classes a table cell may carry: the alignment, in place of a `style` attribute. */
export const ALIGN_CLASSES: readonly string[] = Object.freeze([
  "md-align-left",
  "md-align-center",
  "md-align-right",
]);

/** The tags the sanitizer keeps, exactly (design decision 5). */
export const MARKDOWN_ALLOWED_TAGS: readonly string[] = Object.freeze([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

/** The attributes the sanitizer keeps, exactly; `class` only with an alignment class. */
export const MARKDOWN_ALLOWED_ATTR: readonly string[] = Object.freeze(["class", "href", "start"]);

/**
 * Whether a link or image URL may be a link: `http:` or `https:` with a host and no user name or
 * password, as the board page opens (view-and-widgets spec: Markdown links in the view). Read by
 * the URL parser, so that no spelling of a credential slips past a pattern (review 2.3 and 4.4, U-2).
 */
export const isMarkdownLinkUrl = (url: string): boolean => {
  if (!/^https?:/i.test(url)) return false;
  try {
    const { host, username, password } = new URL(url);
    return host !== "" && username === "" && password === "";
  } catch {
    return false;
  }
};

/** Whether a list's `start` may stay: a whole number of at most nine digits. */
export const keepStart = (value: string): boolean => /^[0-9]{1,9}$/.test(value);

/** Whether a `class` value may stay: one of the three alignment classes, nothing else. */
export const keepClass = (name: string): boolean => ALIGN_CLASSES.includes(name);

// Controls as visible `\uXXXX` escapes, as agent-written labels show them (AD-8, AD-12), except the
// line breaks and tabs a code block holds, which are no escapes.
const visible = (text: string): string =>
  text.replace(/[^\n\t]+/g, (run) =>
    agentTextRuns(run)
      .map((part) => part.text)
      .join(""),
  );

const ALIGN_STYLE = /^text-align:(left|center|right)$/;

// What a token keeps of its attributes: a link's `href`, an ordered list's `start`, a cell's
// alignment as a class; no other token holds any, and an image's are read by its own rule.
const tidy = (token: Token): void => {
  if (token.type === "image") return;
  const kept: [string, string][] = [];
  const keep = (name: string) => {
    const value = token.attrGet(name);
    // markdown-it sets a list's `start` as a number.
    if (typeof value === "string" || typeof value === "number") kept.push([name, String(value)]);
  };
  if (token.type === "link_open") keep("href");
  else if (token.type === "ordered_list_open") keep("start");
  else if (token.type === "th_open" || token.type === "td_open") {
    const aligned = ALIGN_STYLE.exec(String(token.attrGet("style") ?? ""));
    if (aligned !== null) kept.push(["class", `md-align-${aligned[1]}`]);
  }
  token.attrs = kept.length === 0 ? null : kept;
};

// A link whose destination is empty (`[a]()`, `[a]( )`): markdown-it never asks `validateLink` for
// it, so its text stays and its link goes. `[a](<>)` is no link to markdown-it and shows as its
// source text (review 2.3 and 4.4, S-2; review 5.6, S-2).
const withoutEmptyLinks = (children: Token[]): Token[] => {
  const kept: Token[] = [];
  let dropping = false;
  for (const child of children) {
    if (child.type === "link_open" && String(child.attrGet("href") ?? "") === "") dropping = true;
    else if (child.type === "link_close" && dropping) dropping = false;
    else kept.push(child);
  }
  return kept;
};

const create = (): Parser => {
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
    maxNesting: MARKDOWN_NESTING_MAX,
  });
  md.validateLink = isMarkdownLinkUrl;
  md.core.ruler.push("askboard_attributes", (state) => {
    for (const token of state.tokens) {
      tidy(token);
      if (token.children !== null) token.children = withoutEmptyLinks(token.children);
      for (const child of token.children ?? []) tidy(child);
    }
  });
  const { escapeHtml } = md.utils;
  const { rules } = md.renderer;
  const textOf = (tokens: Token[], at: number): string =>
    escapeHtml(visible(tokens[at]?.content ?? ""));
  rules.text = (tokens, at) => textOf(tokens, at);
  rules.code_inline = (tokens, at) => `<code>${textOf(tokens, at)}</code>`;
  rules.code_block = (tokens, at) => `<pre><code>${textOf(tokens, at)}</code></pre>\n`;
  rules.fence = rules.code_block;
  // An image is never loaded: a link to its source, labelled with its alt text, or with the source
  // when there is none, so that no link is empty. An image with no source shows its alt text, or
  // `![]()` when it has neither (an empty source and an empty alt leave nothing else to show).
  rules.image = (tokens, at, options, env, self) => {
    const token = tokens[at];
    const source = String(token?.attrGet("src") ?? "");
    const alt = visible(self.renderInlineAsText(token?.children ?? [], options, env));
    if (source === "") return escapeHtml(alt === "" ? "![]()" : alt);
    return `<a href="${escapeHtml(source)}">${escapeHtml(alt === "" ? source : alt)}</a>`;
  };
  return md;
};

let markdown: Parser | undefined;

/**
 * The HTML markdown-it writes for a source, or none when the source is over `MARKDOWN_MAX_CHARS`
 * code points or its HTML over `MARKDOWN_HTML_MAX_CHARS` characters: the caller then shows the
 * source as plain text. Not yet sanitized.
 */
export const markdownHtml = (source: string): string | undefined => {
  if (Array.from(source).length > MARKDOWN_MAX_CHARS) return undefined;
  markdown ??= create();
  const html = markdown.render(source);
  return html.length > MARKDOWN_HTML_MAX_CHARS ? undefined : html;
};

// Passed with every call: DOMPurify ignores a call's config once `setConfig` has been used.
const SANITIZE_CONFIG: Config & { RETURN_DOM_FRAGMENT: true } = {
  ALLOWED_TAGS: [...MARKDOWN_ALLOWED_TAGS],
  ALLOWED_ATTR: [...MARKDOWN_ALLOWED_ATTR],
  ALLOWED_URI_REGEXP: /^https?:/i,
  // DOMPurify tests every attribute value but a safe-listed one against the URI pattern.
  ADD_URI_SAFE_ATTR: ["start"],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  RETURN_DOM_FRAGMENT: true,
};

const purifiers = new WeakMap<object, Purifier>();

/**
 * The window's DOMPurify with its hook: a `class` is dropped unless it is an alignment class, a `start`
 * unless it is a whole number. None
 * when the window cannot run DOMPurify, so that nothing is ever shown unsanitized.
 */
export const sanitizerFor = (win: WindowLike): Purifier | undefined => {
  const known = purifiers.get(win);
  if (known !== undefined) return known;
  const purifier = DOMPurify(win);
  if (!purifier.isSupported) return undefined;
  purifier.addHook("uponSanitizeAttribute", (_node, event) => {
    const { attrName, attrValue } = event;
    if (attrName === "class" && !keepClass(attrValue)) event.keepAttr = false;
    if (attrName === "start" && !keepStart(attrValue)) event.keepAttr = false;
    if (attrName === "href" && !isMarkdownLinkUrl(attrValue)) event.keepAttr = false;
  });
  purifiers.set(win, purifier);
  return purifier;
};

/**
 * HTML as sanitized nodes of the window's document, by the exact tags, attributes and `http:` and
 * `https:` links above, no data or ARIA attributes; none when the window cannot sanitize.
 */
export const sanitizeHtml = (dirty: string, win: WindowLike): DocumentFragment | undefined =>
  sanitizerFor(win)?.sanitize(dirty, SANITIZE_CONFIG);

/**
 * A source as sanitized nodes of the window's document, ready to append; none when the source or its
 * HTML is over its bound or the window cannot sanitize, and the caller then shows plain text.
 */
export const renderMarkdown = (source: string, win: WindowLike): DocumentFragment | undefined => {
  const dirty = markdownHtml(source);
  return dirty === undefined ? undefined : sanitizeHtml(dirty, win);
};
