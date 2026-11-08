import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  CONTEXT_TITLE_MAX_CHARS,
  IMAGE_ALT_MAX_CHARS,
  INPUT_FORMAT_VERSION,
  POINTER_MAX_CHARS,
  SCHEMA_IDS,
  URL_MAX_CHARS,
  WIDGET_TYPES,
} from "../src/index.ts";
import excerptProps from "../src/schemas/input/excerpt-props.json" with { type: "json" };
import imageProps from "../src/schemas/input/image-props.json" with { type: "json" };
import pointerSchema from "../src/schemas/input/pointer.json" with { type: "json" };
import referenceProps from "../src/schemas/input/reference-props.json" with { type: "json" };
import {
  type RequestProblem,
  validateAgainst,
  validateAskRequest,
  validateUpdateRequest,
} from "../src/validate.ts";

// Context items in a question (excerpts, task 1.2; contract spec: Context items in a question, Web
// reference URLs): `excerpt`, `reference` and `image` in a question's `items`, picked by `type`; the
// checks a schema cannot express; every problem names the context item and its field.
type Item = { type: string; id: string; props: Record<string, unknown> };

const FIXTURES = join(import.meta.dir, "fixtures");
const read = async (path: string) => (await Bun.file(join(FIXTURES, path)).json()) as unknown;

const UJ1_EXCERPT: Item = {
  type: "excerpt",
  id: "retry-adr",
  props: { pointer: "docs/adr/0012-payment-retries.md#Decision" },
};

const item = (type: string, id: string, props: Record<string, unknown>): Item => ({
  type,
  id,
  props,
});
const question = (id: string, items: Item[], extra: Record<string, unknown> = {}): Item => ({
  type: "question",
  id,
  props: { text: `Question ${id}?`, options: [{ label: "Yes" }, { label: "No" }], items, ...extra },
});
const ask = (items: Item[]) => ({ askId: "payment-retry-fix-q4m8", items });
const withContext = (...items: Item[]) => ask([question("fix", items)]);

const problemsOf = (value: unknown): readonly RequestProblem[] => {
  const checked = validateAskRequest(value);
  return checked.ok ? [] : checked.problems;
};
const only = (value: unknown): RequestProblem => {
  const problems = problemsOf(value);
  expect(problems).toHaveLength(1);
  return problems[0] as RequestProblem;
};
const passes = (value: unknown) =>
  expect(validateAskRequest(value)).toEqual({ ok: true, value: value as never });

describe("the input format's version (design decision 2)", () => {
  test("is the minor after main's 1.1", () => {
    expect(INPUT_FORMAT_VERSION).toMatch(/^1\.([2-9]|[1-9][0-9]+)$/);
  });

  test("names the four new schemas", () => {
    expect(SCHEMA_IDS).toMatchObject({
      pointer: "urn:askboard:input:pointer",
      excerptProps: "urn:askboard:input:excerpt-props",
      referenceProps: "urn:askboard:input:reference-props",
      imageProps: "urn:askboard:input:image-props",
    });
  });

  test("the schemas' lengths are the contract's limits", () => {
    expect(pointerSchema).toMatchObject({ minLength: 1, maxLength: POINTER_MAX_CHARS });
    expect(excerptProps.properties.title.maxLength).toBe(CONTEXT_TITLE_MAX_CHARS);
    expect(referenceProps.properties.title.maxLength).toBe(CONTEXT_TITLE_MAX_CHARS);
    expect(referenceProps.properties.url.maxLength).toBe(URL_MAX_CHARS);
    expect(imageProps.properties.alt.maxLength).toBe(IMAGE_ALT_MAX_CHARS);
  });
});

describe("excerpts", () => {
  test("the approved UJ-1 excerpt passes inside a question's items", () => {
    passes(withContext(UJ1_EXCERPT));
    expect(validateAgainst(SCHEMA_IDS.excerptProps, UJ1_EXCERPT.props)).toMatchObject({ ok: true });
  });

  test("an agent-written excerpt with a title passes", () => {
    passes(withContext(item("excerpt", "note", { text: "retries: 3\n", title: "Settings" })));
  });

  test("a pointer the grammar refuses is no request error: it becomes a warning at resolution", () => {
    passes(withContext(item("excerpt", "up", { pointer: "../secret.md#A" })));
  });

  test.each([
    ["both forms", { pointer: "a.md#A", text: "x" }],
    ["neither form", { title: "Settings" }],
  ])(
    "an excerpt with %s is refused, naming the item and saying it takes exactly one",
    (_, props) => {
      const problem = only(withContext(item("excerpt", "retry-adr", props)));
      expect(problem).toMatchObject({ itemId: "retry-adr", field: "props" });
      expect(problem.message).toStartWith('item "retry-adr", props');
      expect(problem.message).toContain("exactly one of pointer and text");
    },
  );

  test.each([
    ["an empty pointer", { pointer: "" }, "props.pointer"],
    [
      "a pointer one character too long",
      { pointer: "a".repeat(POINTER_MAX_CHARS + 1) },
      "props.pointer",
    ],
    ["an empty text", { text: "" }, "props.text"],
    [
      "a title too long",
      { text: "x", title: "t".repeat(CONTEXT_TITLE_MAX_CHARS + 1) },
      "props.title",
    ],
  ])("%s is refused, naming the item and the field", (_, props, field) => {
    const problem = only(withContext(item("excerpt", "retry-adr", props)));
    expect(problem).toMatchObject({ itemId: "retry-adr", field });
  });

  test("a pointer at the limit passes", () => {
    passes(
      withContext(
        item("excerpt", "long", {
          pointer: `${"a".repeat(POINTER_MAX_CHARS - 4)}#L1-L1`.slice(0, POINTER_MAX_CHARS),
        }),
      ),
    );
  });

  test("an unknown field is refused, saying what an excerpt's props hold", () => {
    const problem = only(
      withContext(item("excerpt", "retry-adr", { pointer: "a.md#A", lines: 3 })),
    );
    expect(problem).toMatchObject({ itemId: "retry-adr", field: "props.lines" });
    expect(problem.expected).toContain("pointer, text and title");
  });
});

describe("references", () => {
  test.each([
    ["a pointer", { pointer: "src/retry.ts#L1-L5" }],
    ["a pointer without an anchor", { pointer: "src/retry.ts" }],
    ["an https URL with a title", { url: "https://github.com/acme/pay/pull/12", title: "PR 12" }],
    ["an http URL with a port, a query and a fragment", { url: "http://example.com:8080/a?b=c#d" }],
    ["a scheme in capitals", { url: "HTTPS://Example.com/" }],
    ["an IPv6 host with a port", { url: "http://[::1]:8080/x" }],
    ["a URL at the limit", { url: `https://example.com/${"a".repeat(URL_MAX_CHARS - 20)}` }],
  ])("%s passes", (_, props) => {
    passes(withContext(item("reference", "ref", props)));
  });

  test.each([
    ["both forms", { pointer: "a.md", url: "https://example.com/" }],
    ["neither form", { title: "Docs" }],
  ])("a reference with %s is refused, saying it takes exactly one", (_, props) => {
    const problem = only(withContext(item("reference", "ref", props)));
    expect(problem).toMatchObject({ itemId: "ref", field: "props" });
    expect(problem.message).toContain("exactly one of pointer and url");
  });

  test.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "ftp://example.com/x",
  ])("the URL %s is refused, saying only http and https URLs are accepted", (url) => {
    const problem = only(withContext(item("reference", "ref", { url })));
    expect(problem).toMatchObject({ itemId: "ref", field: "props.url" });
    expect(problem.message).toStartWith('item "ref", props.url');
    expect(problem.message).toContain("only http and https URLs are accepted");
  });

  test.each([
    "https://user:secret@example.com/",
    "https://user@example.com/",
    "https://@example.com/",
  ])("the URL %s, with credentials, is refused, naming the item", (url) => {
    const problem = only(withContext(item("reference", "ref", { url })));
    expect(problem).toMatchObject({ itemId: "ref", field: "props.url" });
    expect(problem.message).toContain("user name or password");
  });

  test.each([
    ["no host", "https://"],
    ["no host before the path", "https:///x"],
    ["only a port", "https://:443/"],
    ["empty brackets", "https://[]/"],
    ["a colon in the host", "https://a:b:c/"],
    ["no slashes", "https:example.com"],
    ["no scheme", "example.com/x"],
    ["a relative path", "/docs/x"],
    ["a space", "https://exa mple.com/"],
    ["a backslash", "https:\\\\example.com\\x"],
    ["a control character", "https://example.com/\u0000"],
    ["a line break", "https://example.com/\nx"],
  ])("a URL with %s is refused as no absolute URL", (_, url) => {
    const problem = only(withContext(item("reference", "ref", { url })));
    expect(problem).toMatchObject({ itemId: "ref", field: "props.url" });
    expect(problem.expected).toContain("absolute http or https URL");
  });

  test("a URL one character over the limit is refused by its length", () => {
    const url = `https://example.com/${"a".repeat(URL_MAX_CHARS - 19)}`;
    expect(url.length).toBe(URL_MAX_CHARS + 1);
    const problem = only(withContext(item("reference", "ref", { url })));
    expect(problem).toMatchObject({ itemId: "ref", field: "props.url" });
  });
});

describe("images", () => {
  test("an image with its pointer and alt text passes", () => {
    passes(
      withContext(
        item("image", "shot", { pointer: ".askboard/media/shot.png", alt: "The retry log" }),
      ),
    );
  });

  test.each(["data", "src", "url"])(
    "an image sent as data in %s is refused, naming the item and field",
    (field) => {
      const props = { pointer: ".askboard/media/shot.png", alt: "Log", [field]: "iVBORw0KGgo=" };
      const problem = only(withContext(item("image", "shot", props)));
      expect(problem).toMatchObject({ itemId: "shot", field: `props.${field}` });
      expect(problem.message).toContain("an image's props hold only pointer and alt");
    },
  );

  test.each([
    ["alt", { pointer: ".askboard/media/shot.png" }],
    ["pointer", { alt: "The retry log" }],
  ])("an image without %s is refused, naming the item and the field", (field, props) => {
    const problem = only(withContext(item("image", "shot", props)));
    expect(problem).toMatchObject({ itemId: "shot", field: `props.${field}` });
    expect(problem.message).toStartWith(`item "shot", props.${field} is required`);
  });

  test("alt text one character over the limit is refused", () => {
    const props = { pointer: "a.png", alt: "a".repeat(IMAGE_ALT_MAX_CHARS + 1) };
    expect(only(withContext(item("image", "shot", props)))).toMatchObject({ field: "props.alt" });
  });
});

describe("items in a question", () => {
  test("every type together passes, in a question inside an area too", () => {
    const items = [
      UJ1_EXCERPT,
      item("reference", "pr", { url: "https://github.com/acme/pay/pull/12" }),
      item("image", "shot", { pointer: ".askboard/media/shot.png", alt: "Log" }),
    ];
    passes(withContext(...items));
    passes(
      ask([{ type: "area", id: "a", props: { title: "Fix", items: [question("fix", items)] } }]),
    );
  });

  test("a problem inside a question in an area names the context item", () => {
    const inner = question("fix", [item("excerpt", "adr", { pointer: "a.md#A", text: "x" })]);
    const problem = only(ask([{ type: "area", id: "a", props: { title: "Fix", items: [inner] } }]));
    expect(problem).toMatchObject({
      path: "/items/0/props/items/0/props/items/0/props",
      itemId: "adr",
    });
  });

  test("an empty list of items is refused, naming the question", () => {
    expect(only(withContext())).toMatchObject({ itemId: "fix", field: "props.items" });
  });

  test("a type the input format does not define is refused for its type alone", () => {
    const problem = only(withContext(item("spreadsheet", "rates", { rows: [] })));
    expect(problem).toMatchObject({
      path: "/items/0/props/items/0/type",
      itemId: "rates",
      field: "type",
    });
    const quoted = ["excerpt", "reference", "image", ...WIDGET_TYPES.map(({ type }) => type)]
      .concat("molecule")
      .map((type) => `"${type}"`);
    expect(problem.expected).toContain(`${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`);
  });

  test("an item type named after an inherited property is refused at its type alone", () => {
    for (const type of ["constructor", "toString", "__proto__"]) {
      const problem = only(withContext(item(type, "inner", { pointer: "a.md", text: "x" })));
      expect(problem).toMatchObject({ path: "/items/0/props/items/0/type", field: "type" });
    }
  });

  test("an area or a question inside a question's items is refused at its type", () => {
    for (const type of ["area", "question"]) {
      const problem = only(withContext(item(type, "inner", { title: "x" })));
      expect(problem).toMatchObject({ path: "/items/0/props/items/0/type", field: "type" });
    }
  });

  test("an unknown field of an item is refused, saying what an item holds", () => {
    const problem = only(withContext({ ...UJ1_EXCERPT, rev: 1 } as Item));
    expect(problem).toMatchObject({ itemId: "retry-adr", field: "rev" });
    expect(problem.expected).toBe("an item holds only type, id and props");
  });

  test("a context item's ID is unique in the ask and never takes the reserved prefix", () => {
    const repeated = only(withContext(item("excerpt", "fix", { text: "x" })));
    expect(repeated).toMatchObject({
      path: "/items/0/props/items/0/id",
      itemId: "fix",
      field: "id",
    });
    expect(repeated.message).toContain("unique in the ask");
    const reserved = only(withContext(item("excerpt", "u-1", { text: "x" })));
    expect(reserved).toMatchObject({ itemId: "u-1", field: "id" });
  });

  test("the approved uj1 ask's excerpt passes while its diff-review and graph are refused by type", async () => {
    const problems = problemsOf(await read("asks/uj1-diff-graph.json"));
    expect(problems.map(({ itemId, field }) => ({ itemId, field }))).toEqual([
      { itemId: "fix-diff", field: "type" },
      { itemId: "retry-states", field: "type" },
    ]);
    expect(problems[0]?.message).toStartWith('item "fix-diff", type');
  });
});

describe("update", () => {
  const add = (item: Item) => ({
    askId: "payment-retry-fix-q4m8",
    actions: [{ action: "add", item }],
  });

  test("an added question with context passes", () => {
    const value = add(question("more", [UJ1_EXCERPT]));
    expect(validateUpdateRequest(value)).toEqual({ ok: true, value: value as never });
  });

  test("an added question's excerpt with both forms is refused, naming the action", () => {
    const checked = validateUpdateRequest(
      add(question("more", [item("excerpt", "x", { pointer: "a.md#A", text: "x" })])),
    );
    expect(checked).toMatchObject({
      ok: false,
      problems: [
        {
          path: "/actions/0/item/props/items/0/props",
          field: "actions[0].item.props.items[0].props",
        },
      ],
    });
  });

  test("an added question's reference with a script URL is refused", () => {
    const checked = validateUpdateRequest(
      add(question("more", [item("reference", "r", { url: "javascript:alert(1)" })])),
    );
    expect(checked).toMatchObject({
      ok: false,
      problems: [{ path: "/actions/0/item/props/items/0/props/url" }],
    });
  });
});
