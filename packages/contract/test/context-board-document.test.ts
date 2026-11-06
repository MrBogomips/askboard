import { describe, expect, test } from "bun:test";
import { contextBoardDocument, plainChoiceBoardDocument } from "../src/fixtures/index.ts";
import {
  BOARD_DOCUMENT_VERSION,
  IMAGE_MEDIA_TYPES,
  SCHEMA_IDS,
  TEXT_MEDIA_TYPES,
  UNRESOLVED_REASONS,
  webReferenceKind,
} from "../src/index.ts";
import boardDocumentSchema from "../src/schemas/board-document/board-document.json" with {
  type: "json",
};
import boardExcerpt from "../src/schemas/board-document/excerpt-props.json" with { type: "json" };
import boardImage from "../src/schemas/board-document/image-props.json" with { type: "json" };
import inputQuestionProps from "../src/schemas/input/question-props.json" with { type: "json" };
import {
  contextDocumentProblems,
  validateAgainst,
  validateBoardDocument,
} from "../src/validate.ts";

// The board document's resolved context (excerpts, task 1.3; contract spec: Resolved context in the
// board document; proposal B8): each item's props carry what ask-core resolved, by status.
type Props = Record<string, unknown>;

const LINES = { start: 7, end: 9 };
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const excerpt = (props: Props) => validateAgainst(SCHEMA_IDS.boardExcerptProps, props);
const reference = (props: Props) => validateAgainst(SCHEMA_IDS.boardReferenceProps, props);
const image = (props: Props) => validateAgainst(SCHEMA_IDS.boardImageProps, props);

const withItems = (items: readonly unknown[]) => {
  const [question] = plainChoiceBoardDocument.items;
  return {
    ...plainChoiceBoardDocument,
    items: [{ ...question, props: { ...question.props, items } }],
  };
};

describe("the board document's version and schemas", () => {
  test("is the minor after main's 1.1", () => {
    expect(BOARD_DOCUMENT_VERSION).toMatch(/^1\.([2-9]|[1-9][0-9]+)$/);
  });

  test("names the three resolved item schemas", () => {
    expect(SCHEMA_IDS).toMatchObject({
      boardExcerptProps: "urn:askboard:board-document:excerpt-props",
      boardReferenceProps: "urn:askboard:board-document:reference-props",
      boardImageProps: "urn:askboard:board-document:image-props",
    });
  });

  test("its enums are the contract's lists", () => {
    const { reason, textMediaType, imageMediaType } = boardExcerpt.$defs;
    expect(reason.enum).toEqual([...UNRESOLVED_REASONS]);
    expect(textMediaType.enum).toEqual([...TEXT_MEDIA_TYPES]);
    expect(imageMediaType.enum).toEqual([...IMAGE_MEDIA_TYPES]);
    expect(boardImage.properties.bytes.maxLength).toBe(Math.ceil((4 * 1024 * 1024) / 3) * 4);
  });

  test("a question's props hold the input format's fields, its items resolved", () => {
    const props = boardDocumentSchema.$defs.questionProps;
    expect(Object.keys(props.properties)).toEqual(Object.keys(inputQuestionProps.properties));
    expect(props.required).toEqual(inputQuestionProps.required);
  });
});

describe("the fixture", () => {
  test("validates, with every status of every item type", () => {
    expect(validateBoardDocument(contextBoardDocument)).toEqual({
      ok: true,
      value: contextBoardDocument as never,
    });
    const items = contextBoardDocument.items.flatMap((question) => question.props.items ?? []);
    const cases = new Set(
      items.map(
        ({ type, props }: { type: string; props: Props }) =>
          `${type} ${props.status ?? (props.url === undefined ? "written" : props.kind)}`,
      ),
    );
    expect([...cases].sort()).toEqual([
      "excerpt resolved",
      "excerpt unresolved",
      "excerpt written",
      "image resolved",
      "image unresolved",
      "reference github",
      "reference resolved",
      "reference unresolved",
      "reference web",
    ]);
  });

  test("E1's and E3's board documents still validate", () => {
    expect(validateBoardDocument(plainChoiceBoardDocument).ok).toBe(true);
  });
});

describe("excerpts", () => {
  const pointer = "docs/adr/0012-payment-retries.md#Decision";

  test.each([
    [
      "resolved Markdown",
      {
        pointer,
        status: "resolved",
        text: "Retry three times.",
        mediaType: "text/markdown",
        lines: LINES,
      },
    ],
    [
      "resolved plain text, an empty line",
      {
        pointer,
        status: "resolved",
        text: "",
        mediaType: "text/plain",
        lines: { start: 3, end: 3 },
      },
    ],
    [
      "resolved with a title",
      {
        pointer,
        title: "The decision",
        status: "resolved",
        text: "x",
        mediaType: "text/plain",
        lines: LINES,
      },
    ],
    ...UNRESOLVED_REASONS.map(
      (reason) => [`unresolved, ${reason}`, { pointer, status: "unresolved", reason }] as const,
    ),
    ["written by the agent", { text: "retries: 3", title: "Settings" }],
  ])("%s passes", (_, props) => {
    expect(excerpt(props)).toMatchObject({ ok: true });
  });

  test.each([
    [
      "resolved without text",
      { pointer, status: "resolved", mediaType: "text/plain", lines: LINES },
    ],
    ["resolved without a media type", { pointer, status: "resolved", text: "x", lines: LINES }],
    ["resolved without lines", { pointer, status: "resolved", text: "x", mediaType: "text/plain" }],
    [
      "resolved with a reason",
      {
        pointer,
        status: "resolved",
        text: "x",
        mediaType: "text/plain",
        lines: LINES,
        reason: "timeout",
      },
    ],
    [
      "resolved as an image",
      { pointer, status: "resolved", text: "x", mediaType: "image/png", lines: LINES },
    ],
    ["unresolved without a reason", { pointer, status: "unresolved" }],
    ["unresolved with text", { pointer, status: "unresolved", reason: "not-found", text: "x" }],
    ["unresolved with lines", { pointer, status: "unresolved", reason: "not-found", lines: LINES }],
    ["of an unknown reason", { pointer, status: "unresolved", reason: "gone" }],
    ["by pointer without a status", { pointer }],
    ["of another status", { pointer, status: "pending", reason: "timeout" }],
    ["written with a status", { text: "x", status: "resolved" }],
    ["written with lines", { text: "x", lines: LINES }],
    ["with neither form", { title: "x" }],
    [
      "with lines of zero",
      {
        pointer,
        status: "resolved",
        text: "x",
        mediaType: "text/plain",
        lines: { start: 0, end: 2 },
      },
    ],
    [
      "with lines missing their end",
      { pointer, status: "resolved", text: "x", mediaType: "text/plain", lines: { start: 1 } },
    ],
  ])("%s is refused", (_, props) => {
    expect(excerpt(props)).toMatchObject({ ok: false });
  });

  test("a resolved excerpt whose range starts after it ends is refused in the board document", () => {
    const props = {
      pointer,
      status: "resolved",
      text: "x",
      mediaType: "text/plain",
      lines: { start: 9, end: 7 },
    };
    const checked = validateBoardDocument(withItems([{ type: "excerpt", id: "adr", props }]));
    expect(checked).toMatchObject({
      ok: false,
      reason: "schema",
      problems: [{ path: "/items/0/props/items/0/props/lines" }],
    });
  });
});

describe("references", () => {
  const pointer = "src/retry.ts#L1-L5";

  test.each([
    [
      "a resolved file with lines",
      { pointer, kind: "file", status: "resolved", lines: { start: 1, end: 5 } },
    ],
    [
      "a resolved file without an anchor",
      { pointer: "src/retry.ts", kind: "file", status: "resolved" },
    ],
    ...UNRESOLVED_REASONS.map(
      (reason) =>
        [
          `an unresolved file, ${reason}`,
          { pointer, kind: "file", status: "unresolved", reason },
        ] as const,
    ),
    [
      "a GitHub page",
      { url: "https://github.com/acme/pay/pull/12", kind: "github", title: "PR 12" },
    ],
    ["a web page", { url: "https://acme.atlassian.net/wiki/x", kind: "web" }],
  ])("%s passes", (_, props) => {
    expect(reference(props)).toMatchObject({ ok: true });
  });

  test.each([
    ["a file of kind web", { pointer, kind: "web", status: "resolved" }],
    ["a URL of kind file", { url: "https://example.com/", kind: "file" }],
    ["a URL of another kind", { url: "https://example.com/", kind: "atlassian" }],
    ["without a kind", { url: "https://example.com/" }],
    ["a file without a status", { pointer, kind: "file" }],
    ["an unresolved file without a reason", { pointer, kind: "file", status: "unresolved" }],
    [
      "an unresolved file with lines",
      {
        pointer,
        kind: "file",
        status: "unresolved",
        reason: "not-found",
        lines: { start: 1, end: 5 },
      },
    ],
    [
      "a resolved file with a reason",
      { pointer, kind: "file", status: "resolved", reason: "timeout" },
    ],
    ["a URL with a status", { url: "https://example.com/", kind: "web", status: "resolved" }],
    ["both forms", { pointer, url: "https://example.com/", kind: "file", status: "resolved" }],
    ["neither form", { kind: "web" }],
  ])("%s is refused", (_, props) => {
    expect(reference(props)).toMatchObject({ ok: false });
  });

  test("a resolved file whose range starts after it ends is refused in the board document", () => {
    const props = { pointer, kind: "file", status: "resolved", lines: { start: 5, end: 1 } };
    const checked = validateBoardDocument(withItems([{ type: "reference", id: "src", props }]));
    expect(checked).toMatchObject({
      ok: false,
      problems: [{ path: "/items/0/props/items/0/props/lines" }],
    });
  });

  test.each([
    ["https://github.com/acme/pay/pull/12", "github"],
    ["https://GitHub.com/acme", "github"],
    ["https://gist.github.com/acme/1", "github"],
    ["http://github.com:443/x", "github"],
    ["https://www.github.com/x", "web"],
    ["https://github.com.evil.example/x", "web"],
    ["https://evil.example/github.com", "web"],
    ["https://acme.atlassian.net/wiki", "web"],
    ["https://[::1]/x", "web"],
  ])("the URL %s is of kind %s", (url, kind) => {
    expect(webReferenceKind(url)).toBe(kind as never);
  });
});

describe("images", () => {
  const pointer = ".askboard/media/shot.png";

  test.each([
    ["resolved", { pointer, alt: "Log", status: "resolved", mediaType: "image/png", bytes: PNG }],
    ...UNRESOLVED_REASONS.map(
      (reason) =>
        [`unresolved, ${reason}`, { pointer, alt: "Log", status: "unresolved", reason }] as const,
    ),
  ])("%s passes", (_, props) => {
    expect(image(props)).toMatchObject({ ok: true });
  });

  test.each([
    [
      "unresolved with bytes",
      { pointer, alt: "Log", status: "unresolved", reason: "not-image", bytes: PNG },
    ],
    [
      "unresolved with a media type",
      { pointer, alt: "Log", status: "unresolved", reason: "not-image", mediaType: "image/png" },
    ],
    ["resolved without bytes", { pointer, alt: "Log", status: "resolved", mediaType: "image/png" }],
    ["resolved without a media type", { pointer, alt: "Log", status: "resolved", bytes: PNG }],
    [
      "resolved as SVG",
      { pointer, alt: "Log", status: "resolved", mediaType: "image/svg+xml", bytes: PNG },
    ],
    [
      "resolved with bytes that are no base64",
      { pointer, alt: "Log", status: "resolved", mediaType: "image/png", bytes: "<svg/>" },
    ],
    ["without alt text", { pointer, status: "unresolved", reason: "not-found" }],
    ["without a status", { pointer, alt: "Log" }],
    [
      "with a URL",
      {
        pointer,
        alt: "Log",
        status: "unresolved",
        reason: "not-found",
        url: "https://x.example/a.png",
      },
    ],
  ])("%s is refused", (_, props) => {
    expect(image(props)).toMatchObject({ ok: false });
  });
});

describe("items in a board document's question", () => {
  test("an input-shaped pointer excerpt, unresolved, is refused", () => {
    const item = { type: "excerpt", id: "adr", props: { pointer: "a.md#A" } };
    expect(validateBoardDocument(withItems([item]))).toMatchObject({ ok: false });
  });

  test("a molecule reference is refused at its type (a Tree and a Gantt are taken)", () => {
    const props = { molecule: "wbs-pert", data: {} };
    const checked = validateBoardDocument(withItems([{ type: "molecule", id: "wbs", props }]));
    expect(checked).toMatchObject({
      ok: false,
      problems: [{ path: "/items/0/props/items/0/type" }],
    });
  });
});

describe("the line-order check, for the board page", () => {
  test("is exported from the validate entry, finding a reversed range in an area's question", () => {
    const props = {
      pointer: "a.md#L9-L3",
      kind: "file",
      status: "resolved",
      lines: { start: 9, end: 3 },
    };
    const [question] = plainChoiceBoardDocument.items;
    const area = {
      type: "area",
      id: "scope",
      props: {
        title: "Scope",
        items: [
          {
            ...question,
            props: { ...question.props, items: [{ type: "reference", id: "r", props }] },
          },
        ],
      },
    };
    expect(contextDocumentProblems({ ...plainChoiceBoardDocument, items: [area] })).toEqual([
      {
        path: "/items/0/props/items/0/props/items/0/props/lines",
        message: "the line range starts after it ends",
      },
    ]);
    expect(contextDocumentProblems(contextBoardDocument)).toEqual([]);
    expect(contextDocumentProblems(null)).toEqual([]);
  });
});
