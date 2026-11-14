// Shared by the diagram chunks (design decision 5; EXPERIENCE.md, Annotation overlay). A
// renderer turns the source into an SVG string; the hit map is taken from that string before it
// becomes a blob; the SVG shows as `<img src="blob:…">`; an SVG overlay the size of the image
// holds the hit regions. The source the user corrects lives in the draft record (AD-20), and
// each render carries a generation number, so only the latest is applied (F-65). A source that
// does not render keeps the last good render.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ItemProps, trace, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

export type Theme = "light" | "dark";
export type Box = { x: number; y: number; width: number; height: number };
export type Anchor = {
  // `<kind>:id:<source id>#<n>`, or `<kind>:label:<label>#<occurrence>` (AD-7, F-62)
  key: string;
  kind: string;
  id: string | null;
  label: string | null;
  occurrence: number;
  box: Box;
};
export type RenderOptions = { theme: Theme; id: string; props: Record<string, unknown> };
export type DiagramEngine = {
  name: string;
  render: (source: string, options: RenderOptions) => Promise<string>;
  anchors: (svg: SVGSVGElement) => Anchor[];
};

// DESIGN.md, Diagram theme: the `diagram` tokens, resolved from the CSS variables, so the `.dark`
// class re-points them. `typography.code` is 12px.
export type DiagramTokens = {
  background: string;
  text: string;
  lifelineHead: string;
  lifelineHeadBorder: string;
  lifeline: string;
  message: string;
  change: string;
  sans: string;
  mono: string;
  codeSize: number;
};

export const diagramTokens = (): DiagramTokens => {
  const css = getComputedStyle(document.documentElement);
  const value = (name: string) => css.getPropertyValue(`--${name}`).trim();
  return {
    background: value("card"),
    text: value("foreground"),
    lifelineHead: value("muted"),
    lifelineHeadBorder: value("border-strong"),
    lifeline: value("border-strong"),
    message: value("foreground-secondary"),
    change: value("change"),
    sans: value("ab-font-sans"),
    mono: value("ab-font-mono"),
    codeSize: 12,
  };
};

const subscribeTheme = (listener: () => void) => {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const currentTheme = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export const useTheme = (): Theme => useSyncExternalStore(subscribeTheme, currentTheme);

const round = (n: number) => Math.round(n * 10) / 10;

// The CSSOM route for script-set styles (`props.probe.shim`, criterion 1): while a diagram
// renders, `setAttribute("style", v)` becomes `style.cssText = v`, a CSSOM write the CSP allows.
// Style attributes in parsed markup stay blocked. Both diagram chunks may render at once, so the
// depth and the original method live on the global under shared symbols.
const DEPTH = Symbol.for("askboard.probe.styleShim.depth");
const ORIGINAL = Symbol.for("askboard.probe.styleShim.original");

export const withCssomStyles = async <T,>(work: () => Promise<T>): Promise<T> => {
  const shared = globalThis as unknown as Record<symbol, unknown>;
  if (!shared[DEPTH]) {
    const original = Element.prototype.setAttribute;
    shared[ORIGINAL] = original;
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      if (name.toLowerCase() === "style" && (this instanceof HTMLElement || this instanceof SVGElement)) {
        this.style.cssText = String(value);
        return;
      }
      original.call(this, name, value);
    };
  }
  shared[DEPTH] = Number(shared[DEPTH] ?? 0) + 1;
  try {
    return await work();
  } finally {
    shared[DEPTH] = Number(shared[DEPTH]) - 1;
    if (!shared[DEPTH]) Element.prototype.setAttribute = shared[ORIGINAL] as Element["setAttribute"];
  }
};

// The element's box in the root SVG's user units. The measured copy has width and height equal
// to its viewBox, so client pixels map one to one.
export const boxIn = (svg: SVGSVGElement, element: Element): Box => {
  const outer = svg.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  return {
    x: round(view.x + inner.left - outer.left),
    y: round(view.y + inner.top - outer.top),
    width: round(inner.width),
    height: round(inner.height),
  };
};

// A hit region at least `size` units across, so a straight edge stays clickable.
export const atLeast = (box: Box, size: number): Box => {
  const width = Math.max(box.width, size);
  const height = Math.max(box.height, size);
  return {
    x: round(box.x - (width - box.width) / 2),
    y: round(box.y - (height - box.height) / 2),
    width: round(width),
    height: round(height),
  };
};

// Gives each anchor its occurrence among anchors of the same kind and the same ID, or the same
// label when it has no ID: `participant:id:API#2` is the participant's second head.
export const withOccurrences = (anchors: Omit<Anchor, "occurrence" | "key">[]): Anchor[] => {
  const seen = new Map<string, number>();
  return anchors.map((anchor) => {
    const name = anchor.id ? `${anchor.kind}:id:${anchor.id}` : `${anchor.kind}:label:${anchor.label ?? ""}`;
    const occurrence = (seen.get(name) ?? 0) + 1;
    seen.set(name, occurrence);
    return { ...anchor, occurrence, key: `${name}#${occurrence}` };
  });
};

type Prepared = { viewBox: Box; anchors: Anchor[] };

// Removed from the text before it is parsed: a document made by DOMParser takes the view's CSP,
// and Chromium reports every `style` attribute and `<style>` element it parses (run `try1`).
const STYLE_ELEMENT = /<style\b[\s\S]*?<\/style\s*>/gi;
const STYLE_ATTRIBUTE = /\sstyle\s*=\s*("[^"]*"|'[^']*')/gi;

// Measures the anchors on a copy of the SVG placed off screen in the view, sized to its viewBox
// so client pixels are user units. The copy carries no style, script, foreign object or image
// source, so measuring it triggers nothing the CSP would report. The image is made from the
// renderer's own text, unchanged.
const prepare = (svg: string, engine: DiagramEngine): Prepared => {
  const stripped = svg.replace(STYLE_ELEMENT, "").replace(STYLE_ATTRIBUTE, "");
  const root = new DOMParser().parseFromString(stripped, "image/svg+xml").documentElement;
  if (root.nodeName !== "svg") throw new Error(`not an SVG: ${root.textContent?.slice(0, 200)}`);
  for (const element of root.querySelectorAll("script, foreignObject")) element.remove();
  for (const element of root.querySelectorAll("image")) {
    element.removeAttribute("href");
    element.removeAttribute("xlink:href");
  }
  const view = (root as unknown as SVGSVGElement).viewBox?.baseVal;
  const width = view?.width || Number.parseFloat(root.getAttribute("width") ?? "0");
  const height = view?.height || Number.parseFloat(root.getAttribute("height") ?? "0");
  if (!view?.width) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  const live = document.importNode(root, true) as unknown as SVGSVGElement;
  const host = document.createElement("div");
  Object.assign(host.style, { position: "absolute", left: "-100000px", top: "0", visibility: "hidden" });
  host.append(live);
  document.body.append(host);
  try {
    const box = live.viewBox.baseVal;
    return {
      viewBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      anchors: engine.anchors(live),
    };
  } finally {
    host.remove();
  }
};

type Shown = {
  generation: number;
  url: string;
  viewBox: Box;
  anchors: Anchor[];
  loaded: boolean | null;
};

export const DiagramView = ({ item, draft, ready, engine }: ItemProps & { engine: DiagramEngine }) => {
  const source = typeof draft === "string" ? draft : text(item.props?.source);
  const theme = useTheme();
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const urls = useRef<string[]>([]);
  const showHits = item.props?.showHits === true;

  useEffect(() => {
    generation.current += 1;
    const current = generation.current;
    const started = performance.now();
    const props = (item.props ?? {}) as Record<string, unknown>;
    const failed = (reason: unknown) => {
      if (current !== generation.current) return;
      const message = reason instanceof Error ? reason.message : String(reason);
      // The renderer's own error image, kept for the probe's search (criterion 5), never shown.
      const svg = (reason as { svg?: unknown } | null)?.svg;
      trace("diagram-error", { id: item.id, engine: engine.name, generation: current, theme, message, svg });
      setError(message);
    };
    engine.render(source, { theme, id: item.id, props }).then((svg) => {
      if (current !== generation.current) return;
      const rendered = performance.now();
      let prepared: Prepared;
      try {
        prepared = prepare(svg, engine);
      } catch (reason) {
        failed(reason);
        return;
      }
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      urls.current.push(url);
      trace("diagram-render", {
        id: item.id,
        engine: engine.name,
        generation: current,
        theme,
        renderMs: round(rendered - started),
        prepareMs: round(performance.now() - rendered),
        svgBytes: svg.length,
        svg,
        anchors: prepared.anchors,
        viewBox: prepared.viewBox,
        t0: performance.timeOrigin + started,
      });
      setError(null);
      setShown({ generation: current, url, viewBox: prepared.viewBox, anchors: prepared.anchors, loaded: null });
    }, failed);
  }, [engine, item.id, item.props, source, theme]);

  // Superseded blob URLs are released once the newer image has loaded.
  useEffect(() => {
    if (!shown || shown.loaded === null) return;
    const stale = urls.current.filter((url) => url !== shown.url);
    for (const url of stale) URL.revokeObjectURL(url);
    urls.current = [shown.url];
  }, [shown]);

  const settled = (shown !== null && shown.loaded !== null) || (shown === null && error !== null);
  useReadyAfterLayout(ready, settled);

  const onImage = (loaded: boolean) => (event: { currentTarget: HTMLImageElement }) => {
    const image = event.currentTarget;
    trace("diagram-image", {
      id: item.id,
      generation: shown?.generation,
      loaded,
      scheme: new URL(image.currentSrc || image.src).protocol,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
    setShown((previous) => (previous ? { ...previous, loaded } : previous));
  };

  const label = text(item.props?.label, "Diagram");
  return (
    <figure className="flex flex-col gap-2" data-diagram-engine={engine.name}>
      {shown ? (
        <div className="relative inline-block max-w-full self-start rounded-md border border-border bg-card">
          <img
            src={shown.url}
            alt={label}
            className="block h-auto max-w-full"
            style={{ width: shown.viewBox.width }}
            data-generation={shown.generation}
            onLoad={onImage(true)}
            onError={onImage(false)}
          />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`${shown.viewBox.x} ${shown.viewBox.y} ${shown.viewBox.width} ${shown.viewBox.height}`}
            role="group"
            aria-label={`${label}: annotation overlay`}
          >
            {shown.anchors.map((anchor) => (
              <rect
                key={anchor.key}
                data-anchor={anchor.key}
                x={anchor.box.x}
                y={anchor.box.y}
                width={anchor.box.width}
                height={anchor.box.height}
                tabIndex={0}
                role="button"
                aria-label={anchor.label ?? anchor.id ?? anchor.kind}
                className={
                  showHits
                    ? "fill-[transparent] stroke-change [stroke-width:1.5] [stroke-dasharray:4_2] focus:outline-none"
                    : "fill-[transparent] stroke-[transparent] focus:stroke-ring focus:outline-none"
                }
              />
            ))}
          </svg>
        </div>
      ) : null}
      {error ? (
        <p className="text-body text-destructive-text" data-diagram-error>
          {error}
        </p>
      ) : null}
    </figure>
  );
};
