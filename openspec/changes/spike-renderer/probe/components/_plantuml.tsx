// The Diagram widget on `@plantuml/core` 1.2026.9, from its npm tarball (design decision 5),
// shared by the two PlantUML chunks: `plantuml` hands the engine Viz.js (Graphviz in
// WebAssembly) through `PLANTUML_VIZ`; `plantuml-smetana` does not, so diagrams that need
// Graphviz fall back to the Smetana layout engine.
//
// The theme is DESIGN.md's diagram tokens as skinparams, after the `@start…` line. A library,
// theme, emoji or icon the source asks for would load by a script tag with a relative URL (D7):
// `PLANTUML_STDLIB_LOADER` refuses every such load instead, so nothing is requested.

import { renderToString } from "@plantuml/core";
import {
  type Anchor,
  atLeast,
  boxIn,
  type DiagramEngine,
  type DiagramTokens,
  diagramTokens,
  withCssomStyles,
  withOccurrences,
} from "./_diagram.tsx";

type Global = typeof globalThis & {
  PLANTUML_STDLIB_LOADER?: (url: string, ok: () => void, err: (message: string) => void) => unknown;
  PLANTUML_VIZ?: unknown;
};

const refuse = (url: string, _ok: () => void, err: (message: string) => void): void => {
  err(`AskBoard loads no PlantUML library or resource (${url})`);
};

const skinparams = (tokens: DiagramTokens): string[] => [
  `skinparam BackgroundColor ${tokens.background}`,
  `skinparam DefaultFontColor ${tokens.text}`,
  "skinparam DefaultFontName sans-serif",
  `skinparam ParticipantBackgroundColor ${tokens.lifelineHead}`,
  `skinparam ActorBackgroundColor ${tokens.lifelineHead}`,
  `skinparam ParticipantBorderColor ${tokens.lifelineHeadBorder}`,
  `skinparam ActorBorderColor ${tokens.lifelineHeadBorder}`,
  `skinparam SequenceLifeLineBorderColor ${tokens.lifeline}`,
  `skinparam ArrowColor ${tokens.message}`,
  "skinparam ArrowFontName monospace",
  `skinparam ArrowFontSize ${tokens.codeSize}`,
];

// The skinparams go right after the first `@start…` line; a source without one is left as is.
export const themed = (source: string, tokens: DiagramTokens): string[] => {
  const lines = source.split(/\r\n|\r|\n/);
  const start = lines.findIndex((line) => /^\s*@start\w+/.test(line));
  if (start < 0) return lines;
  return [...lines.slice(0, start + 1), ...skinparams(tokens), ...lines.slice(start + 1)];
};

const textOf = (element: Element | null): string | null =>
  element?.textContent?.replace(/\s+/g, " ").trim() || null;

// PlantUML marks participants and entities with their source name (`data-qualified-name`), and
// messages and links with the element IDs of their two ends. Messages are keyed by label and
// occurrence: their IDs (`msg1`, `msg2`) number them by position, so the golden flow's reordered
// source would move a pin keyed to `msg3` onto another message. Each message is drawn twice, an
// empty group first, then the drawn one; only the drawn one is an anchor.
const anchors = (svg: SVGSVGElement): Anchor[] => {
  const found: Omit<Anchor, "occurrence" | "key">[] = [];
  const names = new Map<string, string>();
  for (const named of svg.querySelectorAll("[data-qualified-name]")) {
    const name = named.getAttribute("data-qualified-name") as string;
    for (const id of [named.getAttribute("data-entity-uid"), named.id]) if (id) names.set(id, name);
  }
  const ends = (element: Element): string | null => {
    const [from, to] = [element.getAttribute("data-entity-1"), element.getAttribute("data-entity-2")];
    return from && to ? `${names.get(from) ?? from}->${names.get(to) ?? to}` : null;
  };
  for (const head of svg.querySelectorAll("g.participant")) {
    const id = head.getAttribute("data-qualified-name");
    found.push({ kind: "participant", id, label: textOf(head), box: boxIn(svg, head) });
  }
  for (const entity of svg.querySelectorAll("g.entity, g.start_entity, g.end_entity")) {
    const id = entity.getAttribute("data-qualified-name") ?? entity.id;
    found.push({ kind: "entity", id, label: textOf(entity), box: boxIn(svg, entity) });
  }
  for (const message of svg.querySelectorAll("g.message")) {
    if (message.childElementCount === 0) continue;
    found.push({ kind: "message", id: null, label: textOf(message), box: atLeast(boxIn(svg, message), 8) });
  }
  for (const link of svg.querySelectorAll("g.link")) {
    found.push({ kind: "link", id: ends(link) ?? link.id, label: textOf(link), box: atLeast(boxIn(svg, link), 8) });
  }
  return withOccurrences(found);
};

// Criterion 5: PlantUML answers an empty source, a syntax error or a crash with an image of its
// own, through the success callback (run `sponsor`). The image is never shown: its text becomes
// the renderer's message, with the line PlantUML names, and the Diagram keeps its last good
// render (F-07). Error images start "PlantUML version …" (empty or syntax error, green on black);
// crash images start "An error has occurred!" and add a quote and a request to mail the diagram.
const ERROR_IMAGE = /^(PlantUML version |An error has occurred)/;

const linesOf = (svg: string): string[] =>
  [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((match) =>
    (match[1] ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim(),
  );

export const errorImage = (svg: string): { message: string; line: number | null } | null => {
  const lines = linesOf(svg).filter(Boolean);
  if (!ERROR_IMAGE.test(lines[0] ?? "")) return null;
  const line = /\(line (\d+)\)/.exec(lines.join(" "))?.[1];
  const crash = lines[0]?.startsWith("An error has occurred");
  const message = crash
    ? (lines.find((l) => l.startsWith("For some reason") || l.startsWith("RootCause")) ?? lines[0] ?? "")
    : (lines.at(-1) ?? "");
  return { message, line: line ? Number(line) : null };
};

export class RendererError extends Error {
  constructor(
    message: string,
    readonly svg: string,
  ) {
    super(message);
  }
}

export const plantumlEngine = (name: string, viz: unknown): DiagramEngine => ({
  name,
  anchors,
  render: (source, { theme, props }) => {
    const global = globalThis as Global;
    const probe = (props.probe ?? {}) as Record<string, unknown>;
    // Runs only: `probe.loader: "default"` lets the engine's own script-tag loader act.
    global.PLANTUML_STDLIB_LOADER = probe.loader === "default" ? undefined : refuse;
    if (viz) global.PLANTUML_VIZ = viz;
    const lines = probe.raw === true ? source.split(/\r\n|\r|\n/) : themed(source, diagramTokens());
    const render = () =>
      new Promise<string>((resolve, reject) => {
        const done = (svg: string) => {
          const error = errorImage(svg);
          if (!error) resolve(svg);
          else reject(new RendererError(`${error.message}${error.line ? ` (line ${error.line})` : ""}`, svg));
        };
        renderToString(lines, done, (message: string) => reject(new Error(message)), {
          dark: theme === "dark",
        });
      });
    // `probe.shim`: PlantUML sets `style` attributes from script while it builds the SVG.
    return probe.shim === true ? withCssomStyles(render) : render();
  },
});
