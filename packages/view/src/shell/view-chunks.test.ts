import { describe, expect, test } from "bun:test";
import { cspHashSource } from "@askboard/contract";
import { sourceHash } from "../chunk-integrity.ts";
import type { ViewChunk } from "../view-chunks.ts";
import { createChunkInstaller } from "./view-chunks.ts";

const source = async (text: string) => ({ text, sha256: await sourceHash(text) });
const chunk = async (name: string): Promise<ViewChunk> => ({
  name,
  script: await source(`${name}();`),
  styles: [await source(`.${name}{color:red}`)],
});
const setup = (allowed: readonly ViewChunk[]) => {
  const appended: { tag: string; textContent: string }[] = [];
  const document = {
    createElement: (tag: string) => ({ tag, textContent: "" }),
    head: { append: (element: (typeof appended)[number]) => appended.push(element) },
  };
  const policy = `script-src ${allowed.map((chunk) => cspHashSource(chunk.script.sha256)).join(" ")}; style-src ${allowed.flatMap((chunk) => chunk.styles.map((source) => cspHashSource(source.sha256))).join(" ")}`;
  return { appended, install: createChunkInstaller(document as unknown as Document, policy) };
};

describe("installing the components of an updated board", () => {
  test("installs styles and scripts in dependency order without reexecuting earlier chunks", async () => {
    const library = await chunk("library");
    const component = await chunk("component");
    const { install, appended } = setup([library, component]);
    await install([library, component]);
    await install([library, component]);
    expect(appended.map(({ tag, textContent }) => [tag, textContent])).toEqual([
      ["style", ".library{color:red}"],
      ["script", "library();"],
      ["style", ".component{color:red}"],
      ["script", "component();"],
    ]);
  });

  test("a changed script or stylesheet refuses the batch before any source is installed", async () => {
    for (const field of ["script", "style"] as const) {
      const good = await chunk("good");
      const bad = await chunk("bad");
      const { install, appended } = setup([good, bad]);
      const changed =
        field === "script"
          ? { ...bad, script: { ...bad.script, text: "hostile();" } }
          : {
              ...bad,
              styles: bad.styles.map((source) => ({ ...source, text: "body{display:none}" })),
            };
      await expect(install([good, changed])).rejects.toThrow("hash");
      expect(appended).toEqual([]);
      await install([good, bad]);
      expect(appended).toHaveLength(4);
    }
  });

  test("even a source with a correct hash is refused unless the boot manifest authorized it", async () => {
    const { install, appended } = setup([]);
    await expect(install([await chunk("unlisted")])).rejects.toThrow("not authorized");
    expect(appended).toEqual([]);
  });
});
