// The view's style-element shim (renderer spike, rows 5 and 7: S-6; AD-8): Radix's modal Alert
// Dialog locks the page's scroll with a `<style>` it adds at run time (react-remove-scroll-bar,
// through react-style-singleton, appended to `document.head`), which the view's hash-only
// `style-src` blocks. With the shim, a `<style>` added at run time gets a `type` that is not CSS,
// so the browser builds no stylesheet from it, and its rules apply as a constructed stylesheet in
// `document.adoptedStyleSheets`, which the policy allows (F40). One appended to `document.head` goes
// into a detached holder instead, since Chromium checks the policy when a `<style>` is connected,
// whatever its type (F41). Removing the element removes its sheet. Other nodes are inserted and
// removed as before. Installed once, when the shell boots (ask-lifecycle, task 6.6: the mode-switch
// confirmation).

const INERT_TYPE = "text/x-askboard-adopted";

const sheets = new WeakMap<HTMLStyleElement, CSSStyleSheet>();

const adopt = (style: HTMLStyleElement): void => {
  if (sheets.has(style)) return;
  style.type = INERT_TYPE;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(style.textContent ?? "");
  sheets.set(style, sheet);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
};

const drop = (node: Node): void => {
  if (!(node instanceof HTMLStyleElement)) return;
  const sheet = sheets.get(node);
  if (sheet !== undefined) {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((each) => each !== sheet);
  }
  sheets.delete(node);
};

let installed = false;

/** Routes every `<style>` the view's libraries add at run time through constructed stylesheets. */
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
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    child: Node | null,
  ): T {
    if (node instanceof HTMLStyleElement) adopt(node);
    return insertBefore.call(this, node, child) as T;
  };
  Node.prototype.removeChild = function <T extends Node>(this: Node, node: T): T {
    drop(node);
    // A `<style>` moved into the holder is removed from there.
    const parent = node.parentNode === holder ? holder : this;
    return removeChild.call(parent, node) as T;
  };
};
