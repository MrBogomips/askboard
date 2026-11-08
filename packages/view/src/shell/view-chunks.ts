// Installs only hash-checked, manifest-authorized code from the parent. Scripts are appended as
// DOM text (never HTML or eval); the srcdoc's CSP independently admits each exact source hash.

import { cspHashSource } from "@askboard/contract";
import { checkSource } from "../chunk-integrity.ts";
import type { ViewChunk } from "../view-chunks.ts";

export const createChunkInstaller = (
  document: Pick<Document, "head" | "createElement">,
  policy: string,
) => {
  const allowed = (directive: string) =>
    new Set(
      (
        policy
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith(`${directive} `)) ?? ""
      )
        .split(/\s+/)
        .slice(1),
    );
  const scripts = allowed("script-src");
  const styles = allowed("style-src");
  const installed = new Set<string>();
  return async (chunks: readonly ViewChunk[]): Promise<void> => {
    const fresh = chunks.filter(({ name }) => !installed.has(name));
    // Styles pass through the existing adopted-stylesheet shim, so check their allow-list here
    // as well as their bytes. A caller cannot authorize a new source by supplying its own hash.
    for (const chunk of fresh) {
      if (
        !scripts.has(cspHashSource(chunk.script.sha256)) ||
        chunk.styles.some((source) => !styles.has(cspHashSource(source.sha256)))
      )
        throw new Error("a view chunk's hash is not authorized by the manifest policy");
    }
    // Check the entire batch before installing anything. Libraries precede their components.
    await Promise.all(fresh.flatMap(({ script, styles }) => [script, ...styles]).map(checkSource));
    for (const chunk of fresh) {
      for (const source of chunk.styles) {
        const style = document.createElement("style");
        style.textContent = source.text;
        document.head.append(style);
      }
      const script = document.createElement("script");
      script.textContent = chunk.script.text;
      document.head.append(script);
      installed.add(chunk.name);
    }
  };
};
