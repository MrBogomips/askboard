import katex from "katex";
import "katex/dist/katex.min.css";
import { useLayoutEffect, useRef, useState } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

// LaTeX through KaTeX's DOM API (EXPERIENCE.md, Atoms): `katex.render` builds nodes and sets
// their styles through the CSSOM. Its fonts are inlined as `data:` URLs in the chunk stylesheet.
const MathBlock = ({ item, ready }: ItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const source = text(item.props?.source);
  useLayoutEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(source, ref.current, { displayMode: true, throwOnError: true, trust: false });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    // KaTeX measures nothing; the fonts must load before the box is final.
    document.fonts.ready.then(() => setDone(true));
  }, [source]);
  useReadyAfterLayout(ready, done);
  return (
    <div className="text-foreground">
      <div ref={ref} />
      {error ? <p className="text-destructive-text">{error}</p> : null}
    </div>
  );
};

// Negative control: `renderToString` set as markup. Its `style` attributes are parsed markup,
// which the CSP blocks.
const MathString = ({ item, ready }: ItemProps) => {
  const [done, setDone] = useState(false);
  useLayoutEffect(() => {
    document.fonts.ready.then(() => setDone(true));
  }, []);
  useReadyAfterLayout(ready, done);
  const html = katex.renderToString(text(item.props?.source), { displayMode: true, throwOnError: false });
  return (
    <div
      className="text-foreground"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the negative control of task 4.1
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

register("Math", MathBlock);
register("MathString", MathString);
