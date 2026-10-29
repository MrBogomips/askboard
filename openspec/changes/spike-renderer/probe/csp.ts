// The two policies of AD-8, as written in the spine on 2026-10-29. The board page's policy names
// no image or font source: the srcdoc inherits it, so a blocked `blob:` image or `data:` font is
// a finding for AD-8, not something this stand-in adds.

const sources = (hashes: readonly string[]): string =>
  hashes.length === 0 ? "'none'" : hashes.map((hash) => `'sha256-${hash}'`).join(" ");

export const viewPolicy = (scripts: readonly string[], styles: readonly string[]): string =>
  [
    "default-src 'none'",
    `script-src ${sources(scripts)}`,
    `style-src ${sources(styles)}`,
    "img-src data: blob:",
    "font-src data:",
    "connect-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");

export const boardPolicy = (scripts: readonly string[], styles: readonly string[]): string =>
  [
    "default-src 'none'",
    `script-src ${sources(scripts)}`,
    `style-src ${sources(styles)}`,
    "connect-src 'self'",
    "frame-src 'self'",
  ].join("; ");
