// Images, step 6 of design decision 3 (proposal B6): recognised by their first bytes, never by a
// name, so an SVG, or HTML named `.png`, is no image. A pure function over bytes.

import type { ImageMediaType } from "@askboard/contract";

const ascii = (text: string): readonly number[] => [...text].map((char) => char.charCodeAt(0));

// The bytes each type starts with.
const SIGNATURES: readonly (readonly [readonly number[], ImageMediaType])[] = [
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"],
  [[0xff, 0xd8, 0xff], "image/jpeg"],
  [ascii("GIF87a"), "image/gif"],
  [ascii("GIF89a"), "image/gif"],
];

const holds = (bytes: Uint8Array, signature: readonly number[], at: number): boolean =>
  bytes.length >= at + signature.length &&
  signature.every((byte, index) => bytes[at + index] === byte);

// WebP is a RIFF file whose form type, at byte 8, is `WEBP`.
const isWebp = (bytes: Uint8Array): boolean =>
  holds(bytes, ascii("RIFF"), 0) && holds(bytes, ascii("WEBP"), 8);

/** The image type the bytes start with, or undefined when they start no PNG, JPEG, GIF or WebP. */
export const imageMediaTypeOf = (bytes: Uint8Array): ImageMediaType | undefined => {
  if (isWebp(bytes)) return "image/webp";
  return SIGNATURES.find(([signature]) => holds(bytes, signature, 0))?.[1];
};
