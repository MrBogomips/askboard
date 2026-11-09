// The tagged JSON blocks of the generated skill (askboard-skills, design decision 5): a fenced
// block whose info string is `json ask`, `json item`, `json result` or `json update`. Markdown renders the first
// word; the second tells the examples test what the block is.

export const EXAMPLE_KINDS = ["ask", "item", "result", "update"] as const;

export type ExampleKind = (typeof EXAMPLE_KINDS)[number];

/** One example as the generator writes it, before it is placed in a file. */
export type ExampleBody = { readonly kind: ExampleKind; readonly value: unknown };

const FENCE = "```";

/** The fenced block of an example: its JSON, two spaces to a level, in the order written. */
export const exampleBlock = ({ kind, value }: ExampleBody): string =>
  `${FENCE}json ${kind}\n${JSON.stringify(value, null, 2)}\n${FENCE}`;

const BLOCK = /^```json (ask|item|result|update)\n([\s\S]*?)\n```$/gm;

/** The tagged blocks of a Markdown text, in order. Throws, naming the block, on invalid JSON. */
export const taggedBlocks = (markdown: string): ExampleBody[] =>
  [...markdown.matchAll(BLOCK)].map((match, index) => {
    const kind = match[1] as ExampleKind;
    try {
      return { kind, value: JSON.parse(match[2] ?? "") as unknown };
    } catch {
      throw new Error(`the json ${kind} block ${index + 1} is not JSON`);
    }
  });
