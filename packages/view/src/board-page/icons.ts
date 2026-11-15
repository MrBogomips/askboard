// The board page's one icon (icon-set design decision 10): Lucide's close icon, drawn from the
// package's documented `createElement`. The board page has no React, so it does not use the view's
// icon module. Nothing here builds SVG from a string, scans the page (`createIcons`,
// `data-lucide`) or takes a name or attribute from agent content: the attributes are constants.
import { createElement, X } from "lucide";

/** The close icon, hidden from assistive technology: the button that holds it keeps its name. */
export const closeIcon = (document: Document): SVGElement => {
  const icon = createElement(X, { "aria-hidden": "true", class: "size-4" });
  return icon.ownerDocument === document ? icon : (document.importNode(icon, true) as SVGElement);
};
