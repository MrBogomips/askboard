// URLs of Markdown links with the one verdict the contract's `isLinkUrl` gives each (atoms, task 5.9).

/** A link URL of the longest length a link may have. */
export const LONGEST_LINK_URL = `https://example.com/${"a".repeat(2_048 - "https://example.com/".length)}`;

/**
 * Every URL with its verdict: schemes, credentials in each spelling, controls, the bound and one
 * past it (atoms, task 5.9). The view's check and the board page's are both tested against it.
 */
export const LINK_URL_TABLE: readonly (readonly [string, boolean])[] = [
  ["https://example.com/docs", true],
  ["http://example.com", true],
  ["HTTPS://EXAMPLE.COM/x", true],
  ["https://a.test:8443/x?q=1#f", true],
  ["https://a.test/@x", true],
  ["javascript:alert(1)", false],
  ["data:text/html,x", false],
  ["file:///etc/passwd", false],
  ["ftp://example.com/x", false],
  ["mailto:a@b.test", false],
  ["//example.com/x", false],
  ["/relative", false],
  ["", false],
  ["https:", false],
  ["https://", false],
  ["https://u@h.test/", false],
  ["https://u:p@h.test/", false],
  ["HTTPS:u:p@h.test", false],
  ["https://:p@h.test/", false],
  // The URL parser reads the backslash as a slash: host h.test, no credential.
  ["https://h.test\\@evil.test/", true],
  ["https://example.com/a b", false],
  ["https://example.com/a\nb", false],
  ["https://example.com/a\u0000b", false],
  ["https://example.com/a\u0085b", false],
  [LONGEST_LINK_URL, true],
  [`${LONGEST_LINK_URL}a`, false],
];
