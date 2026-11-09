import { describe, expect, test } from "bun:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../catalog/port.ts";
import { DEFAULT_PRESENTATION, type PresentationControls } from "./presentation-controls.ts";
import { QuickToggles } from "./quick-toggles.tsx";
import { Segmented } from "./segmented.tsx";
import { createStore } from "./store.ts";

// One toolbar in a Snapshot (snapshot-toolbar, design decisions 1 and 5; view spec, The Snapshot
// view's chrome and Density in a Snapshot). The header draws its toggles through `QuickToggles`
// alone, which the source guard below pins, so the header's one Theme group is the one rendered
// here.

type Setting = Parameters<PresentationControls["set"]>[0];

const controlsOf = (
  hosted: boolean,
  locked: readonly ("theme" | "density")[] = [],
  set: (setting: Setting) => void = () => undefined,
) =>
  ({
    presentation: createStore({ ...DEFAULT_PRESENTATION, locked }),
    hosted,
    set,
    openSettings: () => undefined,
  }) as PresentationControls;

const toggles = (language: "en-US" | "it-IT", controls: PresentationControls) =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: language },
      createElement(QuickToggles, { controls }),
    ),
  );

const count = (html: string, needle: string) => html.split(needle).length - 1;

let captured: ReactNode;

/** Renders `make` inside a component's render, so that hooks run, and keeps the element it gave. */
const Capture = ({ make }: { readonly make: () => ReactNode }) => {
  captured = make();
  return null;
};

const elementsOf = (make: () => ReactNode, type: unknown): ReactElement<never>[] => {
  renderToStaticMarkup(createElement(Capture, { make }));
  const found: ReactElement<never>[] = [];
  const walk = (node: ReactNode): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!isValidElement<{ children?: ReactNode }>(node)) return;
    if (node.type === type) found.push(node as ReactElement<never>);
    walk(node.props.children);
  };
  walk(captured);
  return found;
};

/** The Segmented elements a component's own render gives, found by walking its element tree. */
const segmentedOf = (controls: PresentationControls): ReactElement<SegmentedProps>[] =>
  elementsOf(() => QuickToggles({ controls }), Segmented);

type SegmentedProps = {
  readonly label: string;
  readonly onChange: (value: never) => void;
  readonly segments: readonly { readonly value: string }[];
};

describe("a Snapshot's toolbar", () => {
  test("holds one Theme group, one density group and no Settings (en-US)", () => {
    const html = toggles("en-US", controlsOf(false));
    expect(count(html, 'aria-label="Theme"')).toBe(1);
    expect(count(html, 'aria-label="Density"')).toBe(1);
    expect(count(html, 'role="radiogroup"')).toBe(2);
    expect(html).toContain(">Comfortable<");
    expect(html).not.toContain("Settings");
    expect(html).not.toContain("aria-pressed");
  });

  test("says it in Italian too", () => {
    const html = toggles("it-IT", controlsOf(false));
    expect(count(html, 'aria-label="Tema"')).toBe(1);
    expect(count(html, 'role="radiogroup"')).toBe(2);
    expect(html).not.toContain("Impostazioni");
  });

  test("a locked key's description is not shown in a Snapshot", () => {
    const html = toggles("en-US", controlsOf(false, ["theme", "density"]));
    expect(html).not.toContain("config.json");
    expect(html).not.toContain("disabled");
  });

  test("a hosted board keeps Settings and its lock descriptions", () => {
    const html = toggles("en-US", controlsOf(true, ["density"]));
    expect(html).toContain("Settings");
    expect(html).toContain("config.json");
  });

  test("each group asks for its own key", () => {
    const asked: Setting[] = [];
    const [theme, density] = segmentedOf(controlsOf(false, [], (setting) => asked.push(setting)));
    theme?.props.onChange("light" as never);
    density?.props.onChange("comfortable" as never);
    expect(asked).toEqual([
      { key: "theme", value: "light" },
      { key: "density", value: "comfortable" },
    ]);
  });
});

describe("a toggle's segments", () => {
  type ButtonProps = {
    readonly ref: (element: { focus: () => void } | null) => void;
    readonly onClick: () => void;
    readonly onKeyDown: (event: { key: string; preventDefault: () => void }) => void;
  };

  const buttonsOf = (onChange: (value: string) => void): ReactElement<ButtonProps>[] =>
    elementsOf(
      () =>
        Segmented({
          label: "Density",
          segments: [
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
          ],
          value: "compact",
          onChange,
        }),
      "button",
    );

  test("a click chooses it, and an arrow key moves focus and chooses the next", () => {
    const chosen: string[] = [];
    const focused: string[] = [];
    const [first, second] = buttonsOf((value) => chosen.push(value));
    first?.props.ref({ focus: () => focused.push("first") });
    second?.props.ref({ focus: () => focused.push("second") });
    second?.props.onClick();
    let prevented = 0;
    first?.props.onKeyDown({ key: "ArrowRight", preventDefault: () => prevented++ });
    first?.props.onKeyDown({ key: "x", preventDefault: () => prevented++ });
    expect(chosen).toEqual(["comfortable", "comfortable"]);
    expect(focused).toEqual(["second"]);
    expect(prevented).toBe(1);
  });
});

describe("the header", () => {
  test("draws the toggles through QuickToggles once and keeps no Theme control of its own", async () => {
    const source = await Bun.file(new URL("./board-header.tsx", import.meta.url)).text();
    expect(source.match(/<QuickToggles /g)).toHaveLength(1);
    expect(source).not.toContain("ThemeControl");
    expect(source).not.toContain("theme-control");
  });
});
