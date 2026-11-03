// A web reference's URL (excerpts, design decision 2; proposal B7; contract spec, Web reference
// URLs): absolute, `http:` or `https:`, with a host and no user name or password (AD-8). Read by
// hand, since the contract compiles without the DOM's `URL`; it accepts less than a browser's parser
// does, never more: no white space, control character or backslash anywhere, and `//` right after
// the scheme. The board page checks the scheme again before it opens a URL.

/** Why a URL is no web reference's: another scheme, credentials, or not an absolute URL at all. */
export type WebUrlProblem = "scheme" | "credentials" | "form";

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/;
const WEB_SCHEMES = new Set(["http", "https"]);
// White space, control characters (Unicode `Cc`: C0, DEL and C1) and the backslash, which
// browsers read as `/`.
const REFUSED = /[\s\\\p{Cc}]/u;
// A host, a bracketed IPv6 address included, then an optional port.
const AUTHORITY = /^(\[[^\]]*\]|[^:[\]]*)(?::[0-9]*)?$/;

/** What makes `url` no web reference's URL, or undefined when it is one. */
export const webUrlProblem = (url: string): WebUrlProblem | undefined => {
  const scheme = SCHEME.exec(url)?.[1];
  if (scheme === undefined) return "form";
  if (!WEB_SCHEMES.has(scheme.toLowerCase())) return "scheme";
  if (REFUSED.test(url)) return "form";
  const rest = url.slice(scheme.length + 1);
  if (!rest.startsWith("//")) return "form";
  const authority = rest.slice(2).split(/[/?#]/, 1)[0] ?? "";
  if (authority.includes("@")) return "credentials";
  const host = AUTHORITY.exec(authority)?.[1];
  return host === undefined || host === "" || host === "[]" ? "form" : undefined;
};
