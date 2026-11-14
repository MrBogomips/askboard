import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { useMemo } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

// Agent Markdown (EXPERIENCE.md, Atoms): markdown-it with raw HTML off, then DOMPurify, set as
// markup. `alignClasses` is a probe prop: markdown-it writes a table column's alignment as a
// `style` attribute, which the view CSP blocks; the rule below writes a class instead.
const renderer = (alignClasses: boolean): MarkdownIt => {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  if (alignClasses) {
    for (const name of ["th_open", "td_open"] as const) {
      md.renderer.rules[name] = (tokens, index, options, _env, self) => {
        const token = tokens[index];
        const style = token?.attrGet("style");
        if (token && style) {
          token.attrs = (token.attrs ?? []).filter(([key]) => key !== "style");
          token.attrJoin("class", `md-${style.replace(/^text-align:/, "align-")}`);
        }
        return self.renderToken(tokens, index, options);
      };
    }
  }
  return md;
};

const Markdown = ({ item, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const source = text(item.props?.source);
  const alignClasses = item.props?.alignClasses === true;
  const html = useMemo(
    () => DOMPurify.sanitize(renderer(alignClasses).render(source), { USE_PROFILES: { html: true } }),
    [source, alignClasses],
  );
  return (
    <div
      className="ab-markdown text-body text-foreground"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify above
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

register("Markdown", Markdown);
