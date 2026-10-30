import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chunkInputs, collectNotices, licencePath } from "./licences.ts";

let root = "";
const write = (path: string, text: string) => Bun.write(join(root, path), text);
const json = (value: unknown) => JSON.stringify(value);
const store = (name: string, version: string) =>
  `node_modules/.bun/${name.replace("/", "+")}@${version}/node_modules/${name}`;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "askboard-licences-"));
  await write("LICENSE", "MIT License\n\nCopyright (c) AskBoard\n");
  await write(
    "packages/view/package.json",
    json({ name: "@askboard/view", version: "0.0.0", license: "MIT" }),
  );
  await write("packages/view/src/shell/index.tsx", "");
  await write(
    "packages/contract/package.json",
    json({ name: "@askboard/contract", version: "0.0.0", license: "MIT" }),
  );
  await write("packages/contract/src/routes.ts", "");
  const react = store("react", "19.3.1");
  await write(`${react}/package.json`, json({ name: "react", version: "19.3.1", license: "MIT" }));
  await write(`${react}/LICENSE`, "MIT License\n\nCopyright (c) Meta\n");
  await write(`${react}/cjs/react.production.js`, "");
  await write(`${react}/index.js`, "");
  const core = store("@modelcontextprotocol/core", "2.4.0");
  await write(
    `${core}/package.json`,
    json({ name: "@modelcontextprotocol/core", version: "2.4.0", license: { type: "Apache-2.0" } }),
  );
  await write(`${core}/LICENSE.md`, "Apache License 2.0\n");
  await write(`${core}/NOTICE`, "Notice text\n");
  await write(`${core}/dist/index.js`, "");
  const bare = store("bare", "1.0.0");
  await write(`${bare}/package.json`, json({ name: "bare", version: "1.0.0", license: "MIT" }));
  await write(`${bare}/index.js`, "");
  const unlicensed = store("unlicensed", "1.0.0");
  await write(`${unlicensed}/package.json`, json({ name: "unlicensed", version: "1.0.0" }));
  await write(`${unlicensed}/LICENSE`, "text\n");
  await write(`${unlicensed}/index.js`, "");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const at = (path: string) => join(root, path);

describe("the inputs a chunk holds, from the bundler's metafile", () => {
  test("are the files the output lists, as absolute paths, without plugin modules", () => {
    const metafile = {
      inputs: {},
      outputs: {
        "./shell.js": {
          inputs: {
            "packages/view/src/shell/index.tsx": { bytesInOutput: 120 },
            "node_modules/.bun/react@19.3.1/node_modules/react/index.js": { bytesInOutput: 0 },
            "askboard-shared:react": { bytesInOutput: 40 },
          },
        },
      },
    };
    expect(chunkInputs(metafile, root)).toEqual([
      at("node_modules/.bun/react@19.3.1/node_modules/react/index.js"),
      at("packages/view/src/shell/index.tsx"),
    ]);
  });
});

describe("licence notices per chunk", () => {
  test("name each package once, with its version, SPDX licence and licence text", async () => {
    const notices = await collectNotices(
      "ext-apps",
      [
        at(`${store("@modelcontextprotocol/core", "2.4.0")}/dist/index.js`),
        at(`${store("react", "19.3.1")}/index.js`),
        at(`${store("react", "19.3.1")}/cjs/react.production.js`),
      ],
      root,
    );
    expect(notices.map(({ notice }) => notice)).toEqual([
      {
        package: "@modelcontextprotocol/core",
        version: "2.4.0",
        licence: "Apache-2.0",
        path: "licences/modelcontextprotocol-core-2.4.0.txt",
      },
      { package: "react", version: "19.3.1", licence: "MIT", path: "licences/react-19.3.1.txt" },
    ]);
    expect(notices[0]?.text).toContain("Apache License 2.0");
    expect(notices[0]?.text).toContain("Notice text");
    expect(notices[1]?.text).toContain("Copyright (c) Meta");
  });

  test("AskBoard's own code carries AskBoard's MIT notice from the repository's licence", async () => {
    const notices = await collectNotices(
      "shell",
      [at("packages/view/src/shell/index.tsx"), at("packages/contract/src/routes.ts")],
      root,
    );
    expect(notices.map(({ notice }) => notice.package)).toEqual([
      "@askboard/contract",
      "@askboard/view",
    ]);
    expect(notices[1]?.notice.path).toBe("licences/askboard-view-0.0.0.txt");
    expect(notices[1]?.text).toContain("Copyright (c) AskBoard");
  });

  test("files outside any package, such as generated entries, carry no notice", async () => {
    expect(await collectNotices("react", [at("generated/react.ts")], root)).toEqual([]);
  });

  test("a package without a licence file fails, naming the package and the chunk", async () => {
    const input = at(`${store("bare", "1.0.0")}/index.js`);
    await expect(collectNotices("radix", [input], root)).rejects.toThrow(
      'bare 1.0.0 in the chunk "radix" has no licence file',
    );
  });

  test("a package without a licence field fails, naming it", async () => {
    const input = at(`${store("unlicensed", "1.0.0")}/index.js`);
    await expect(collectNotices("radix", [input], root)).rejects.toThrow("unlicensed 1.0.0");
  });

  test("a notice's file name is the package name and version, without the scope's @", () => {
    expect(licencePath("@radix-ui/react-radio-group", "1.5.1")).toBe(
      "licences/radix-ui-react-radio-group-1.5.1.txt",
    );
  });
});
