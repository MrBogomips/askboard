// The board page as `board-host` serves it (design decision 5, AD-8): HTML with its styles and its
// one script inline, exactly as `board-page.css` and `board-page.js` hold them, so the page's CSP
// can name both by the hashes the manifest records. The script builds everything else. The empty
// `data:` icon keeps Firefox from requesting /favicon.ico, which the policy's `img-src` refuses
// with a CSP violation.
//
// `<base href="/">` keeps the token out of the view (AD-8). The view's srcdoc document takes its
// base URL from the board page's document base URL, which without a base element is the page's
// URL, link token included: `document.baseURI` in the view read `?t=` in Chromium, Firefox and
// WebKit, and Firefox reads it again whenever the board page's URL changes. With the base element
// it is the origin's root in all three, on first load, after a reload and after the URL changes.
// The link keeps its token, so a reload works and every request still carries one (AD-11). Every
// URL the board page uses is absolute or rooted (`/m`, `/c/`, `/ws/`), so nothing resolves
// differently. The policy allows it with `base-uri 'self'`.

export const boardPageHtml = (script: string, styles: string): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<base href="/">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<link rel="icon" href="data:,">',
    "<title>AskBoard</title>",
    ...(styles === "" ? [] : [`<style>${styles}</style>`]),
    "</head>",
    "<body>",
    `<script>${script}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
