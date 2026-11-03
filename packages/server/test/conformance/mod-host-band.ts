// The band above the prompt in the stand-in mod host (push delivery, task 15.2), declared after
// `packages/mod/src/mod-api.ts`: the input a `ui.render` hook on `AbovePrompt` receives, and the
// element constructors `$.ui.resolve` gives, each building a plain record. A drawing is read back as
// the rows a terminal shows, as the mod's own fake reads it (`packages/mod/test/fake-band.ts`): a
// column's children one under the other, a row's or a text's children on one line, a link as its
// address, or `[text](address)` when it has children or a label. What the plugins beneath draw, the host's
// `next`, reads as one row, `BENEATH_ROW`. An element these constructors did not build is a
// problem, never read as a row.

/** The band's props, as the engine gives them to a `ui.render` hook on `AbovePrompt`. */
export type BandProps = {
  /** True while a survey holds the band. */
  readonly hasSurvey: boolean;
  /** True while a model turn is running. */
  readonly isWorking: boolean;
  /** Rows the band may take. */
  readonly maxRows: number;
  /** Cells the band's tree is laid out in. */
  readonly bodyColumns: number;
};

/** The band above the prompt as a `ui.render` hook receives it. */
export type AbovePromptInput = {
  /** Where the tree is drawn: `terminal` or `desktop`. */
  readonly surface: string;
  readonly component: "AbovePrompt";
  readonly requestId: string;
  readonly props: BandProps;
};

/** What the band's constructors build, and the host's `next` gives for the plugins beneath. */
export type BandElement = {
  readonly type: "Box" | "Text" | "Link" | "Beneath";
  readonly props: {
    readonly children?: BandChildren;
    readonly flexDirection?: "row" | "column";
    readonly color?: string;
    readonly dimColor?: boolean;
    readonly wrap?: "truncate-end";
    readonly href?: string;
    readonly label?: string;
  };
};

export type BandChildren = BandElement | string | undefined | readonly BandChildren[];

type Children = { readonly children?: BandChildren };

/** The elements the band draws with, each a constructor from its props, children included. */
export type BandElements = {
  readonly Box: (props: { readonly flexDirection?: "row" | "column" } & Children) => BandElement;
  readonly Text: (
    props: {
      readonly color?: string;
      readonly dimColor?: boolean;
      readonly wrap?: "truncate-end";
    } & Children,
  ) => BandElement;
  /** A link: its children are its text; with none, its label; with neither, its address. */
  readonly Link: (
    props: { readonly href: string; readonly label?: string } & Children,
  ) => BandElement;
};

/** The band on a terminal 200 cells wide, with no survey and no turn running. */
export const BAND_PROPS: BandProps = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 20,
  bodyColumns: 200,
};

/** The row that stands for what the plugins beneath draw. */
export const BENEATH_ROW = "<beneath>";

/** Every element the constructors below built: no other is read as a row. */
const built = new WeakSet<object>();

const element =
  (type: BandElement["type"]) =>
  (props: BandElement["props"]): BandElement => {
    const made: BandElement = { type, props };
    built.add(made);
    return made;
  };

/** The constructors `$.ui.resolve` gives, on every surface. */
export const BAND_ELEMENTS: BandElements = {
  Box: element("Box"),
  Text: element("Text"),
  Link: element("Link"),
};

/** What the plugins beneath draw, as the host's `next` gives it. */
export const BENEATH: BandElement = element("Beneath")({});

const shown = (node: unknown): string => {
  try {
    return JSON.stringify(node) ?? String(node);
  } catch {
    return String(node);
  }
};

const drawnOf = (node: unknown): BandElement => {
  if (typeof node === "object" && node !== null && built.has(node)) return node as BandElement;
  throw new Error(`the band holds ${shown(node)}, which no constructor of $.ui.resolve built`);
};

const childrenOf = (children: unknown): readonly unknown[] =>
  Array.isArray(children) ? children : [children];

const inline = (children: unknown): string =>
  childrenOf(children)
    .map((child) => {
      if (child === undefined) return "";
      if (typeof child === "string") return child;
      if (Array.isArray(child)) return inline(child);
      const { type, props } = drawnOf(child);
      if (type === "Link") {
        const text = props.children === undefined ? props.label : inline(props.children);
        return text === undefined ? props.href : `[${text}](${props.href})`;
      }
      return type === "Beneath" ? BENEATH_ROW : inline(props.children);
    })
    .join("");

/** A drawing's rows, as a terminal shows them; throws on an element the constructors did not build. */
export const rowsOf = (node: unknown): string[] => {
  const { type, props } = drawnOf(node);
  if (type === "Beneath") return [BENEATH_ROW];
  if (type !== "Box" || props.flexDirection !== "column") return [inline(node)];
  return childrenOf(props.children).flatMap((child) =>
    child === undefined || typeof child === "string" || Array.isArray(child)
      ? [inline(child)]
      : rowsOf(child),
  );
};
