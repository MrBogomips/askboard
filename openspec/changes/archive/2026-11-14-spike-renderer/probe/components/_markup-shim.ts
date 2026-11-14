// The markup shim (group 4, measured as the smallest code change for libraries that write markup
// with `style` attributes into a shadow root: `@pierre/diffs`, MathLive). In scope (inside the
// shadow root of a listed host element, or in a detached element, where `@pierre/diffs` builds
// rows before it attaches them):
// - markup written with `innerHTML` or `insertAdjacentHTML` has its `style` attributes renamed
//   before the parser sees them and applied through the CSSOM after;
// - `setAttribute("style", v)` becomes `style.cssText = v`;
// - a `<style>` appended to a listed shadow root becomes a constructed stylesheet.
// The CSP allows both routes. Elsewhere the DOM methods behave as before.

const STYLE_ATTRIBUTE = /\sstyle="([^"]*)"/g;
const hosts = new Set<string>();

const decode = (value: string) =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const inScope = (node: Node) => {
  if (!(node instanceof ShadowRoot) && !node.isConnected) return true;
  const root = node instanceof ShadowRoot ? node : node.getRootNode();
  return root instanceof ShadowRoot && hosts.has(root.host.tagName);
};

const applyStyles = (scope: ParentNode) => {
  for (const element of scope.querySelectorAll<HTMLElement | SVGElement>("[data-ab-style]")) {
    element.style.cssText = decode(element.getAttribute("data-ab-style") ?? "");
    element.removeAttribute("data-ab-style");
  }
};

let installed = false;
const install = () => {
  installed = true;
  for (const proto of [Element.prototype, ShadowRoot.prototype]) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, "innerHTML");
    if (!descriptor?.set) continue;
    Object.defineProperty(proto, "innerHTML", {
      ...descriptor,
      set(this: Element | ShadowRoot, html: string) {
        if (!inScope(this)) return descriptor.set?.call(this, html);
        descriptor.set?.call(this, String(html).replace(STYLE_ATTRIBUTE, ' data-ab-style="$1"'));
        applyStyles(this);
      },
    });
  }
  const insert = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (this: Element, position: InsertPosition, html: string) {
    if (!inScope(this)) return insert.call(this, position, html);
    insert.call(this, position, String(html).replace(STYLE_ATTRIBUTE, ' data-ab-style="$1"'));
    applyStyles(this.parentNode ?? this);
  };
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    if (name.toLowerCase() === "style" && (this instanceof HTMLElement || this instanceof SVGElement) && inScope(this)) {
      this.style.cssText = String(value);
      return;
    }
    setAttribute.call(this, name, value);
  };
  const append = ShadowRoot.prototype.appendChild;
  ShadowRoot.prototype.appendChild = function <T extends Node>(this: ShadowRoot, node: T): T {
    if (node instanceof HTMLStyleElement && hosts.has(this.host.tagName)) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(node.textContent ?? "");
      this.adoptedStyleSheets = [...this.adoptedStyleSheets, sheet];
      return node;
    }
    return append.call(this, node) as T;
  };
};

// `hostTag` in upper case, as `tagName` gives it.
export const shimMarkupIn = (hostTag: string): void => {
  hosts.add(hostTag);
  if (!installed) install();
};
