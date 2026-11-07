// The init script a LaTeX board's scenarios add to the browser context (latex-kanban-timeline, task
// 6.8), apart from the helpers that use its log so that a unit test can run it alone. Not a test file.

import type { BrowserContext } from "playwright";

/**
 * An init script that counts the MathML elements the page creates, which only KaTeX's output
 * makes, the longest gap between two ticks of a 5 ms timer, which a long task stretches, and logs
 * every preview drawn (the wall-clock time and the source KaTeX writes into it) and every `input`
 * event with the time. They live on the frame's `window`, and run in every frame, the view's included; the log
 * is the page's own, since WebKit answers the test's calls only between draws.
 */
export const WATCH = `
  window.__mathml = 0;
  window.__lag = 0;
  const create = Document.prototype.createElementNS;
  Document.prototype.createElementNS = function (namespace, name, options) {
    if (namespace === "http://www.w3.org/1998/Math/MathML") window.__mathml += 1;
    return create.call(this, namespace, name, options);
  };
  window.__events = [];
  window.__inputs = [];
  document.addEventListener("input", (event) => {
    window.__inputs.push({ t: Date.now(), value: String(event.target.value).slice(0, 8) });
  }, true);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        const found = node.matches("annotation") ? [node] : [...node.querySelectorAll("annotation")];
        for (const one of found) {
          const items = [...document.querySelectorAll("[data-latex]")];
          window.__events.push({
            t: Date.now(),
            tex: one.textContent.slice(0, 40),
            at: items.indexOf(one.closest("[data-latex]")),
          });
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    window.__lag = Math.max(window.__lag, now - last - 5);
    last = now;
  }, 5);
`;

export const watching = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(WATCH);
};
