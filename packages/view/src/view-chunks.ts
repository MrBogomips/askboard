// Only sources from the trusted view manifest cross this seam. The live view's CSP authorizes
// their exact hashes; neither a URL nor agent content can become a script or stylesheet.

export type InlineSource = { readonly text: string; readonly sha256: string };
export type ViewChunk = {
  readonly name: string;
  readonly script: InlineSource;
  readonly styles: readonly InlineSource[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSource = (value: unknown): value is InlineSource =>
  isRecord(value) &&
  typeof value.text === "string" &&
  typeof value.sha256 === "string" &&
  /^[0-9a-f]{64}$/.test(value.sha256);

export const isViewChunks = (value: unknown): value is readonly ViewChunk[] =>
  Array.isArray(value) &&
  value.every(
    (chunk) =>
      isRecord(chunk) &&
      typeof chunk.name === "string" &&
      isSource(chunk.script) &&
      Array.isArray(chunk.styles) &&
      chunk.styles.every(isSource),
  );
