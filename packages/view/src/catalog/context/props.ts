// The context items' props as the components read them (excerpts, design decision 6): the view
// hands an item's props over unchecked, and the board page has already validated the board
// document, so each reader checks only the fields its component shows and throws on props that
// are no board document's, which fails the item (AD-10). Every string stays data (AD-8).

/** The image media types the contract resolves (`IMAGE_MEDIA_TYPES`), and the only ones shown. */
export const SHOWN_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export type ShownImageType = (typeof SHOWN_IMAGE_TYPES)[number];

/** An excerpt as its component shows it. */
export type ExcerptView =
  | {
      readonly kind: "resolved";
      readonly pointer: string;
      readonly title?: string;
      readonly text: string;
      /** Markdown soft-wraps; anything else keeps its lines. */
      readonly wraps: boolean;
      readonly start: number;
      readonly end: number;
    }
  | { readonly kind: "unresolved"; readonly pointer: string; readonly title?: string }
  | {
      readonly kind: "written";
      readonly title?: string;
      readonly text: string;
      readonly wraps: false;
      readonly start: 1;
    };

/** An excerpt's caption: its title, then its source line, the pointer and the line range. */
export type Caption = {
  readonly title?: string;
  readonly source?: string;
  readonly range?: string;
};

export type ReferenceView = {
  readonly label: "FILE" | "GITHUB" | "WEB";
  /** Its title, else its pointer or URL. */
  readonly shown: string;
  /** Its pointer or URL. */
  readonly target: string;
  /** It opens in the browser, so it carries the external-link mark. */
  readonly external: boolean;
};

export type ImageView =
  | {
      readonly kind: "resolved";
      readonly pointer: string;
      readonly alt: string;
      readonly mediaType: ShownImageType;
      readonly bytes: string;
    }
  | { readonly kind: "unresolved"; readonly pointer: string; readonly alt: string };

/** One line of an excerpt's body, numbered as in its file. */
export type ExcerptLine = { readonly number: number; readonly text: string };

type Fields = Readonly<Record<string, unknown>>;

const fieldsOf = (props: unknown): Fields | undefined =>
  typeof props === "object" && props !== null && !Array.isArray(props)
    ? (props as Fields)
    : undefined;

const stringOf = (fields: Fields, name: string): string | undefined => {
  const value = Object.hasOwn(fields, name) ? fields[name] : undefined;
  return typeof value === "string" ? value : undefined;
};

/** The optional title: absent, or a string; anything else is no board document's. */
const titleOf = (fields: Fields, fail: () => never): { readonly title?: string } => {
  if (!Object.hasOwn(fields, "title")) return {};
  const title = stringOf(fields, "title");
  return title === undefined ? fail() : { title };
};

const isLine = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;

const linesFieldOf = (fields: Fields): { start: number; end: number } | undefined => {
  const lines = fieldsOf(fields.lines);
  return lines !== undefined && isLine(lines.start) && isLine(lines.end)
    ? { start: lines.start, end: lines.end }
    : undefined;
};

/** The excerpt in `props`, or a throw. */
export const excerptOf = (props: unknown): ExcerptView => {
  const fail = (): never => {
    throw new Error("the item's props are not an excerpt of a board document");
  };
  const fields = fieldsOf(props) ?? fail();
  const title = titleOf(fields, fail);
  const text = stringOf(fields, "text");
  if (!Object.hasOwn(fields, "pointer")) {
    return text === undefined
      ? fail()
      : { kind: "written", ...title, text, wraps: false, start: 1 };
  }
  const pointer = stringOf(fields, "pointer") ?? fail();
  if (fields.status === "unresolved") return { kind: "unresolved", pointer, ...title };
  const lines = linesFieldOf(fields);
  const mediaType = stringOf(fields, "mediaType");
  if (fields.status !== "resolved" || text === undefined || lines === undefined || !mediaType) {
    return fail();
  }
  return {
    kind: "resolved",
    pointer,
    ...title,
    text,
    wraps: mediaType === "text/markdown",
    ...lines,
  };
};

// The contract's line range, `L<start>-L<end>` with start <= end (`readPointer`); any other
// anchor is a name.
const LINE_RANGE = /^L([1-9]\d*)-L([1-9]\d*)$/;

const anchorNameOf = (pointer: string): string | undefined => {
  const at = pointer.indexOf("#");
  if (at < 0) return undefined;
  const anchor = pointer.slice(at + 1);
  const range = LINE_RANGE.exec(anchor);
  return range !== null && Number(range[1]) <= Number(range[2]) ? undefined : anchor;
};

const fileNameOf = (pointer: string): string => {
  const at = pointer.indexOf("#");
  const path = at < 0 ? pointer : pointer.slice(0, at);
  return path.slice(path.lastIndexOf("/") + 1);
};

const rangeOf = (start: number, end: number): string =>
  start === end ? `line ${start}` : `lines ${start}–${end}`;

/** The caption: the title, else the anchor's text, else the file name; then the source line. */
export const captionOf = (excerpt: ExcerptView): Caption => {
  if (excerpt.kind === "written")
    return excerpt.title === undefined ? {} : { title: excerpt.title };
  const title = excerpt.title ?? anchorNameOf(excerpt.pointer) ?? fileNameOf(excerpt.pointer);
  if (excerpt.kind === "unresolved") return { title };
  return { title, source: excerpt.pointer, range: rangeOf(excerpt.start, excerpt.end) };
};

/** The body's lines, split on LF and numbered from `start`, whatever the range's end says. */
export const linesOf = (text: string, start: number): ExcerptLine[] =>
  text.split("\n").map((line, at) => ({ number: start + at, text: line }));

const LABELS = { file: "FILE", github: "GITHUB", web: "WEB" } as const;

/** The reference in `props`, or a throw. */
export const referenceOf = (props: unknown): ReferenceView => {
  const fail = (): never => {
    throw new Error("the item's props are not a reference of a board document");
  };
  const fields = fieldsOf(props) ?? fail();
  const { title } = titleOf(fields, fail);
  const kind = fields.kind;
  const target =
    kind === "file"
      ? stringOf(fields, "pointer")
      : kind === "github" || kind === "web"
        ? stringOf(fields, "url")
        : undefined;
  if (target === undefined || (kind !== "file" && kind !== "github" && kind !== "web")) {
    return fail();
  }
  return { label: LABELS[kind], shown: title ?? target, target, external: kind !== "file" };
};

const isShownType = (value: unknown): value is ShownImageType =>
  (SHOWN_IMAGE_TYPES as readonly unknown[]).includes(value);

/** The image in `props`, or a throw. */
export const imageOf = (props: unknown): ImageView => {
  const fail = (): never => {
    throw new Error("the item's props are not an image of a board document");
  };
  const fields = fieldsOf(props) ?? fail();
  const pointer = stringOf(fields, "pointer") ?? fail();
  const alt = stringOf(fields, "alt") ?? fail();
  if (fields.status === "unresolved") return { kind: "unresolved", pointer, alt };
  const bytes = stringOf(fields, "bytes");
  const mediaType = fields.mediaType;
  if (fields.status !== "resolved" || bytes === undefined || !isShownType(mediaType)) return fail();
  return { kind: "resolved", pointer, alt, mediaType, bytes };
};
