// The view's style-element shim (renderer spike, rows 5 and 7: S-6; AD-8): Radix's modal Alert
// Dialog locks the page's scroll with a `<style>` it adds at run time (react-remove-scroll-bar,
// through react-style-singleton, appended to `document.head`), which the view's hash-only
// `style-src` blocks. With the shim, a `<style>` added at run time gets a `type` that is not CSS,
// so the browser builds no stylesheet from it, and its rules apply as a constructed stylesheet in
// `document.adoptedStyleSheets`, which the policy allows (F40). One added to `document.head`, by
// `appendChild`, `insertBefore`, `append`, `prepend` or `replaceChildren`, goes into a detached
// holder instead, since Chromium checks the policy when a `<style>` is connected, whatever its
// type (F41); a `<style>` the head holds already, the srcdoc's own, moves as before. Removing the
// element removes its sheet, and so does `replaceChildren` on the head for those in the holder.
// Other nodes are inserted and removed as before. Installed once, when the shell boots
// (ask-lifecycle, task 6.6: the mode-switch confirmation).

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

// A `<style>` added at run time: any but one the head holds already, which moves as before.
const isAdded = (node: unknown): node is HTMLStyleElement =>
  node instanceof HTMLStyleElement && node.parentNode !== document.head;

let installed = false;

/** Routes every `<style>` the view's libraries add at run time through constructed stylesheets. */
export const shimStyleElements = (): void => {
  if (installed) return;
  installed = true;
  const { appendChild, insertBefore, removeChild } = Node.prototype;
  const { append, prepend, replaceChildren } = Element.prototype;
  const holder = document.createElement("div");
  type Nodes = (Node | string)[];
  // Into the head, the nodes go in as asked and the added `<style>`s into the holder; elsewhere
  // the added `<style>`s go in adopted.
  const into = (parent: Element, nodes: Nodes, insert: (nodes: Nodes) => void): void => {
    const styles = nodes.filter(isAdded);
    for (const style of styles) adopt(style);
    if (parent !== document.head) {
      insert(nodes);
      return;
    }
    insert(nodes.filter((node) => !isAdded(node)));
    append.apply(holder, styles);
  };
  Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
    if (!isAdded(node)) return appendChild.call(this, node) as T;
    adopt(node);
    return appendChild.call(this === document.head ? holder : this, node) as T;
  };
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    child: Node | null,
  ): T {
    if (!isAdded(node)) return insertBefore.call(this, node, child) as T;
    adopt(node);
    // The child is the head's, not the holder's: there the `<style>` goes last.
    if (this === document.head) return appendChild.call(holder, node) as T;
    return insertBefore.call(this, node, child) as T;
  };
  Node.prototype.removeChild = function <T extends Node>(this: Node, node: T): T {
    drop(node);
    // A `<style>` moved into the holder is removed from there.
    const parent = node.parentNode === holder ? holder : this;
    return removeChild.call(parent, node) as T;
  };
  Element.prototype.append = function (this: Element, ...nodes: Nodes): void {
    into(this, nodes, (rest) => append.apply(this, rest));
  };
  Element.prototype.prepend = function (this: Element, ...nodes: Nodes): void {
    into(this, nodes, (rest) => prepend.apply(this, rest));
  };
  Element.prototype.replaceChildren = function (this: Element, ...nodes: Nodes): void {
    // The children replaced go with their sheets; on the head, so do the holder's `<style>`s.
    const kept = new Set<Node | string>(nodes);
    for (const child of Array.from(this.childNodes)) if (!kept.has(child)) drop(child);
    if (this === document.head) {
      for (const style of Array.from(holder.childNodes)) {
        drop(style);
        removeChild.call(holder, style);
      }
    }
    into(this, nodes, (rest) => replaceChildren.apply(this, rest));
  };
};
