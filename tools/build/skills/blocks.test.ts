// The tagged JSON blocks (askboard-skills, design decision 5): written and read back.

import { describe, expect, test } from "bun:test";
import { exampleBlock, taggedBlocks } from "./blocks.ts";

describe("tagged blocks", () => {
  test("a written block reads back as the example it holds, and others are left", () => {
    const text = `Some prose.\n\n${exampleBlock({ kind: "item", value: { id: "a" } })}\n\n\`\`\`json\n{"plain": true}\n\`\`\`\n\n${exampleBlock({ kind: "result", value: [1] })}\n`;
    expect(taggedBlocks(text)).toEqual([
      { kind: "item", value: { id: "a" } },
      { kind: "result", value: [1] },
    ]);
  });

  test("a block that is not JSON throws, naming its kind and place", () => {
    expect(() => taggedBlocks("```json ask\n{nope\n```")).toThrow("the json ask block 1");
  });
});
