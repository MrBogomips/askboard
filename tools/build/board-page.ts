// The board page as `board-host` serves it (design decision 5, AD-8): HTML with its styles and its
// one script inline, exactly as `board-page.css` and `board-page.js` hold them, so the page's CSP
// can name both by the hashes the manifest records. The script builds everything else. The empty
// `data:` icon keeps Firefox from requesting /favicon.ico, which the policy's `img-src` refuses
// with a CSP violation.

export const boardPageHtml = (script: string, styles: string): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
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
