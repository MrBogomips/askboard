// The Diagram widget on Mermaid 12.2.0 (design decision 5): `securityLevel: 'strict'`,
// `htmlLabels: false`, the `base` theme with DESIGN.md's diagram tokens, and `layout: 'dagre'`,
// because ELK is Mermaid's default layout and the build replaces elkjs with an empty module (S-1).
// The keys a diagram's own front matter or init directive could use to change these are added to
// `secure` (D3).
//
// `props.measure` picks how labels are measured while the CSP blocks Mermaid's injected
// `<style>` (task 3.5): "none", "shell-rule" (a rule in the hashed shell stylesheet on Mermaid's
// temporary container), "cssom" (the same font set through the CSSOM) or "config" (Mermaid's
// font aligned with the page font the measurement inherits). `props.probe` is for runs only;
// `props.probe.shim` routes Mermaid's style writes around the CSP (criterion 1, below).

import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { type ItemProps, register } from "../port/index.ts";
import {
  type Anchor,
  atLeast,
  boxIn,
  type DiagramEngine,
  DiagramView,
  diagramTokens,
  withCssomStyles,
  withOccurrences,
} from "./_diagram.tsx";

const SECURE = [
  "secure",
  "securityLevel",
  "startOnLoad",
  "maxTextSize",
  "suppressErrorRendering",
  "maxEdges",
  "htmlLabels",
  "layout",
  "theme",
  "themeVariables",
  "themeCSS",
  "fontFamily",
  "fontSize",
  "darkMode",
  "look",
];
// Mermaid's default diagram font, used unless a mitigation aligns it with the page.
const MERMAID_FONT = '"trebuchet ms", verdana, arial, sans-serif';
const MERMAID_SIZE = 16;
const MEASURE_RULE = (font: string) => `font-family:${font};font-size:${MERMAID_SIZE}px`;

let inserted = false;
// Mitigation "cssom": the container rule, inserted through the CSSOM into a hashed stylesheet.
const insertMeasureRule = (font: string): void => {
  if (inserted) return;
  const sheet = document.styleSheets[0];
  if (!sheet) return;
  sheet.insertRule(`div[id^="dmermaid-cssom-"]{${MEASURE_RULE(font)}}`, sheet.cssRules.length);
  inserted = true;
};

const configFor = (theme: "light" | "dark", measure: string, probe: Record<string, unknown>) => {
  const tokens = diagramTokens();
  const page = getComputedStyle(document.body);
  const aligned = measure === "config";
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    htmlLabels: false,
    layout: "dagre",
    theme: "base" as const,
    darkMode: theme === "dark",
    suppressErrorRendering: true,
    deterministicIds: true,
    fontFamily: aligned ? page.fontFamily : MERMAID_FONT,
    themeVariables: {
      darkMode: theme === "dark",
      fontFamily: aligned ? page.fontFamily : MERMAID_FONT,
      fontSize: aligned ? page.fontSize : `${MERMAID_SIZE}px`,
      background: tokens.background,
      textColor: tokens.text,
      primaryTextColor: tokens.text,
      actorTextColor: tokens.text,
      signalTextColor: tokens.text,
      actorBkg: tokens.lifelineHead,
      primaryColor: tokens.lifelineHead,
      mainBkg: tokens.lifelineHead,
      actorBorder: tokens.lifelineHeadBorder,
      primaryBorderColor: tokens.lifelineHeadBorder,
      nodeBorder: tokens.lifelineHeadBorder,
      actorLineColor: tokens.lifeline,
      signalColor: tokens.message,
      lineColor: tokens.message,
    },
    sequence: { messageFontFamily: tokens.mono, messageFontSize: tokens.codeSize },
    secure: probe.secure === false ? ["secure"] : SECURE,
    ...(probe.config as object | undefined),
  };
};

let renders = 0;
// `initialize` sets one global configuration, so each initialize-and-render pair runs alone.
let queue: Promise<unknown> = Promise.resolve();

const textOf = (element: Element | null): string | null =>
  element?.textContent?.replace(/\s+/g, " ").trim() || null;

const union = (a: Anchor["box"], b: Anchor["box"]): Anchor["box"] => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

// A node's element ID is `<render id>-<diagram>-<source id>-<counter>` (`…-flowchart-A-0`,
// `…-classId-Ask-0`, `…-state-Open-2`).
const sourceId = (svg: SVGSVGElement, element: Element): string | null => {
  const local = element.id.startsWith(`${svg.id}-`) ? element.id.slice(svg.id.length + 1) : element.id;
  return /^[A-Za-z]+-(.+)-\d+$/.exec(local)?.[1] ?? (local || null);
};

// Nodes and edges by their source ID; sequence participants by name (`data-et`, and the bottom
// heads by `name`); messages and notes by label and occurrence, since Mermaid numbers them by
// position (`i0`, `i1`), and a reordered source would move a pin keyed to that number. A
// message's box joins its line and its label.
const anchors = (svg: SVGSVGElement): Anchor[] => {
  const found: Omit<Anchor, "occurrence" | "key">[] = [];
  for (const node of svg.querySelectorAll("g.node[id], g[data-et=cluster][data-id]")) {
    const id = node.getAttribute("data-id") ?? sourceId(svg, node);
    found.push({ kind: "node", id, label: textOf(node), box: boxIn(svg, node) });
  }
  const edgeLabels = new Map(
    [...svg.querySelectorAll(".edgeLabel [data-id]")].map((label) => [label.getAttribute("data-id"), label]),
  );
  for (const edge of svg.querySelectorAll("[data-edge=true]")) {
    const id = edge.getAttribute("data-id");
    const label = edgeLabels.get(id) ?? null;
    const box = label && textOf(label) ? union(boxIn(svg, edge), boxIn(svg, label)) : boxIn(svg, edge);
    found.push({ kind: "edge", id, label: textOf(label), box: atLeast(box, 8) });
  }
  for (const participant of svg.querySelectorAll("[data-et=participant]")) {
    found.push({
      kind: "participant",
      id: participant.getAttribute("data-id") ?? participant.getAttribute("name"),
      label: textOf(participant),
      box: boxIn(svg, participant),
    });
  }
  for (const head of svg.querySelectorAll("rect.actor-bottom[name]")) {
    found.push({ kind: "participant", id: head.getAttribute("name"), label: head.getAttribute("name"), box: boxIn(svg, head) });
  }
  const texts = [...svg.querySelectorAll("text.messageText")];
  [...svg.querySelectorAll("[data-et=message]")].forEach((line, index) => {
    const label = texts[index] ?? null;
    const box = label ? union(boxIn(svg, line), boxIn(svg, label)) : boxIn(svg, line);
    found.push({ kind: "message", id: null, label: textOf(label), box: atLeast(box, 8) });
  });
  for (const note of svg.querySelectorAll("[data-et=note]")) {
    found.push({ kind: "note", id: null, label: textOf(note), box: boxIn(svg, note) });
  }
  return withOccurrences(found);
};

// The shim, for a render under `props.probe.shim`, does three things, each for one source of
// violations seen in run `try2`:
// - script-set `style` attributes go through the CSSOM (`withCssomStyles`, in `_diagram.tsx`);
// - the `<style>` Mermaid inserts into its temporary SVG is applied as a constructed stylesheet
//   instead, so the labels are measured with the theme's fonts, and goes back into the SVG text;
// - before DOMPurify parses the SVG text, `style` attributes are renamed to `data-ab-style`
//   (Chromium reports each style attribute a parsed document holds), and renamed back after.
let hideStyleAttributes = false;
const sanitize = DOMPurify.sanitize.bind(DOMPurify);
DOMPurify.sanitize = ((dirty: string, config: object) => {
  if (!hideStyleAttributes || typeof dirty !== "string") return sanitize(dirty, config);
  const clean = String(sanitize(dirty.replace(/ style="/g, ' data-ab-style="'), config));
  return clean.replace(/ data-ab-style="/g, ' style="');
}) as typeof DOMPurify.sanitize;

const captureStyles = (renderId: string, captured: string[]): (() => void) => {
  const { insertBefore, appendChild } = Node.prototype;
  const adopted: CSSStyleSheet[] = [];
  const take = (parent: Node, node: Node): boolean => {
    if (!(node instanceof HTMLStyleElement || node instanceof SVGStyleElement)) return false;
    if (!(parent instanceof Element) || parent.closest(`[id="${renderId}"]`) === null) return false;
    const css = node.textContent ?? "";
    captured.push(css);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    adopted.push(sheet);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return true;
  };
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, child: Node | null): T {
    return take(this, node) ? node : (insertBefore.call(this, node, child) as T);
  };
  Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
    return take(this, node) ? node : (appendChild.call(this, node) as T);
  };
  return () => {
    Node.prototype.insertBefore = insertBefore;
    Node.prototype.appendChild = appendChild;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => !adopted.includes(sheet));
  };
};

const renderShimmed = (renderId: string, source: string): Promise<string> =>
  withCssomStyles(async () => {
    const captured: string[] = [];
    const restore = captureStyles(renderId, captured);
    hideStyleAttributes = true;
    try {
      const { svg } = await mermaid.render(renderId, source);
      const css = captured.join("\n");
      return svg.replace(/^<svg\b[^>]*>/, (open) => `${open}<style>${css}</style>`);
    } finally {
      hideStyleAttributes = false;
      restore();
    }
  });

const engine: DiagramEngine = {
  name: "mermaid",
  anchors,
  render: (source, { theme, id, props }) => {
    const measure = typeof props.measure === "string" ? props.measure : "none";
    const probe = (props.probe ?? {}) as Record<string, unknown>;
    const run = async () => {
      if (measure === "cssom") insertMeasureRule(MERMAID_FONT);
      mermaid.initialize(configFor(theme, measure, probe));
      renders += 1;
      const renderId = `mermaid-${measure}-${id}-${renders}`;
      if (probe.shim === true) return renderShimmed(renderId, source);
      const { svg } = await mermaid.render(renderId, source);
      return svg;
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  },
};

const Mermaid = (props: ItemProps) => <DiagramView {...props} engine={engine} />;

register("Mermaid", Mermaid);
