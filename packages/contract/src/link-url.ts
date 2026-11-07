// The one check of a Markdown link's URL (atoms, task 5.9; view-and-widgets spec: Markdown links in
// the view, The board page opens Markdown links). The view draws an anchor for a URL only when this
// holds, and the board page opens one only when it holds, so a link the page would refuse is never
// drawn as a link. No other layer restates the bound or the scheme list.

import { URL_MAX_CHARS } from "./context/limits.ts";

// The URL parser every runtime of AskBoard has; `contract` compiles with no DOM or Node types, so
// its shape is stated here.
const { URL: UrlParser } = globalThis as unknown as {
  readonly URL: new (
    url: string,
  ) => { protocol: string; host: string; username: string; password: string };
};

/** The most characters of a link's URL: the context limit's URL length. */
export const LINK_URL_MAX_CHARS = URL_MAX_CHARS;

// A space or a control character: C0, DEL and C1. markdown-it's links hold none, since it
// percent-encodes them; a browser would strip some of them and read the rest as a URL.
const hasBlankOrControl = (text: string): boolean =>
  Array.from(text).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x20 || (code >= 0x7f && code <= 0x9f);
  });

/**
 * Whether the URL may be a link: `http:` or `https:` with a host and no user name or password, at
 * most `LINK_URL_MAX_CHARS` characters with no space or control character, as the URL parser reads
 * it, so that no spelling of a credential slips past a pattern.
 */
export const isLinkUrl = (url: string): boolean => {
  if (url.length > LINK_URL_MAX_CHARS || hasBlankOrControl(url)) return false;
  try {
    const { protocol, host, username, password } = new UrlParser(url);
    return (
      (protocol === "https:" || protocol === "http:") &&
      host !== "" &&
      username === "" &&
      password === ""
    );
  } catch {
    return false;
  }
};
