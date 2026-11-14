import { registerCustomCSSVariableTheme } from "@pierre/diffs";
import { MultiFileDiff } from "@pierre/diffs/react";
import { useEffect, useRef, useState } from "react";
import { type ItemProps, register, trace, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";
import { shimMarkupIn } from "./_markup-shim.ts";

// Diff review's code view on `@pierre/diffs` (EXPERIENCE.md, Components; task 4.2). It renders
// into an open shadow root of a `diffs-container` element. `props.config` picks the measured
// configuration:
// - `default`: its own themes (`pierre-light`, `pierre-dark`), Shiki's JavaScript regex engine;
// - `css-classes`: the same with `useCSSClasses: true`, which the package declares (D10);
// - `css-variables`: a theme whose token colours are CSS variables, mapped onto DESIGN.md's five
//   `syntax-*` tokens by the chunk's own stylesheet;
// - `plain`: files named `.txt`, so nothing is highlighted;
// - `plain-variables`: the same with the CSS-variables theme, highlighting off (group 5).
// `props.shim` adds the markup shim (`_markup-shim.ts`).

// DESIGN.md, Syntax highlighting: keywords, strings, numbers and constants, function and type
// names, comments; everything else is the foreground.
registerCustomCSSVariableTheme("askboard-syntax", {
  foreground: "var(--foreground)",
  background: "var(--card)",
  "token-keyword": "var(--syntax-keyword)",
  "token-string": "var(--syntax-string)",
  "token-string-expression": "var(--syntax-string)",
  "token-constant": "var(--syntax-number)",
  "token-function": "var(--syntax-function)",
  "token-comment": "var(--syntax-comment)",
  "token-parameter": "var(--foreground)",
  "token-punctuation": "var(--foreground)",
  "token-link": "var(--foreground)",
  "token-inserted": "var(--diff-add-mark)",
  "token-deleted": "var(--diff-del-mark)",
});

type FileText = { name: string; contents: string };

const DiffReview = ({ item, ready }: ItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const config = text(item.props?.config, "default");
  if (item.props?.shim === true) shimMarkupIn("DIFFS-CONTAINER");
  const rename = (file: FileText): FileText =>
    config.startsWith("plain") ? { ...file, name: file.name.replace(/\.[a-z]+$/, ".txt") } : file;
  const oldFile = rename(item.props?.oldFile as FileText);
  const newFile = rename(item.props?.newFile as FileText);
  // Ready once the shadow root holds highlighted or plain lines and the fonts settled.
  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(() => {
      const host = ref.current?.querySelector("diffs-container");
      const lines = host?.shadowRoot?.querySelectorAll("[data-line]").length ?? 0;
      if (lines === 0 && performance.now() - started < 10_000) return;
      clearInterval(timer);
      // No line after 10 s is a failure the verdict rule must see (group 5: a build without the
      // theme or the grammar the configuration asks for renders nothing).
      if (lines === 0) reportError(new Error("diff-review: no line rendered in 10 s"));
      const spans = host?.shadowRoot?.querySelectorAll("[data-line] span") ?? [];
      const classes = new Set<string>();
      const colours = new Set<string>();
      for (const span of spans) {
        for (const name of span.classList) classes.add(name);
        colours.add(getComputedStyle(span).color);
      }
      trace("diff", {
        id: item.id,
        lines,
        spans: spans.length,
        styleAttributes: host?.shadowRoot?.querySelectorAll("[style]").length ?? 0,
        classes: [...classes].slice(0, 40),
        colours: [...colours],
        adopted: host?.shadowRoot?.adoptedStyleSheets.length ?? 0,
        styleElements: host?.shadowRoot?.querySelectorAll("style").length ?? 0,
      });
      document.fonts.ready.then(() => setDone(true));
    }, 50);
    return () => clearInterval(timer);
  }, [item.id]);
  useReadyAfterLayout(ready, done);
  const options = {
    diffStyle: "unified" as const,
    disableWorkerPool: true,
    ...(config === "css-classes" ? { useCSSClasses: true } : {}),
    ...(config === "css-variables" || config === "plain-variables" ? { theme: "askboard-syntax" } : {}),
  };
  return (
    <div ref={ref} className="ab-diff w-[720px] rounded-md border border-border" data-diff={item.id}>
      <MultiFileDiff oldFile={oldFile} newFile={newFile} options={options} disableWorkerPool />
    </div>
  );
};

register("DiffReview", DiffReview);
