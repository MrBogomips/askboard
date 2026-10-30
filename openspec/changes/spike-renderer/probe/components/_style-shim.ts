// The style-element shim (group 4, S-6's second measured change). Radix inserts `<style>`
// elements at run time: the scroll lock's (react-remove-scroll-bar through react-style-singleton,
// appended to `document.head`) and Select's viewport rule (rendered by React in its portal). A
// hash-only `style-src` blocks both. With the shim, a `<style>` gets a `type` that is not CSS, so
// the browser builds no stylesheet from it (HTML, "update a style block"), and its rules apply as
// a constructed stylesheet in `document.adoptedStyleSheets`, which the CSP allows (D11).
// - Appended to `document.head`, it goes into a detached holder instead: Chromium checks the CSP
//   when a `<style>` is connected, whatever its type (a trial run, not kept).
// - Inserted anywhere else (React's own `<style>` elements), it is inserted with the inert type.
// Removing the element removes the sheet. Other nodes are inserted and removed as before.

const INERT_TYPE = "text/x-askboard-adopted";
const sheets = new WeakMap<HTMLStyleElement, CSSStyleSheet>();

const adopt = (style: HTMLStyleElement) => {
  if (sheets.has(style)) return;
  style.type = INERT_TYPE;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(style.textContent ?? "");
  sheets.set(style, sheet);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
};

const drop = (node: Node) => {
  if (!(node instanceof HTMLStyleElement)) return;
  const sheet = sheets.get(node);
  if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  sheets.delete(node);
};

let installed = false;
export const shimStyleElements = (): void => {
  if (installed) return;
  installed = true;
  const { appendChild, insertBefore, removeChild } = Node.prototype;
  const holder = document.createElement("div");
  Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
    if (!(node instanceof HTMLStyleElement)) return appendChild.call(this, node) as T;
    adopt(node);
    return appendChild.call(this === document.head ? holder : this, node) as T;
  };
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, child: Node | null): T {
    if (node instanceof HTMLStyleElement) adopt(node);
    return insertBefore.call(this, node, child) as T;
  };
  Node.prototype.removeChild = function <T extends Node>(this: Node, node: T): T {
    drop(node);
    return removeChild.call(this, node) as T;
  };
};
