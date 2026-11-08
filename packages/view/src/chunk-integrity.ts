import type { InlineSource } from "./view-chunks.ts";

export const sourceHash = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const checkSource = async (source: InlineSource): Promise<void> => {
  if ((await sourceHash(source.text)) !== source.sha256)
    throw new Error("a view chunk's hash does not match its source");
};
