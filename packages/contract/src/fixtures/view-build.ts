// A fixture view build: a manifest and the files of its folder, as the view build writes them to
// `dist/view/` (design decision 7), with each file's real SHA-256 and size. `board-host` serves it
// before the real build exists (Track A, 6.3); the scripts only mark that they ran. Change a file and
// its digest together: the fixture tests compare them.

import { VIEW_MANIFEST_FILE } from "../constants.ts";
import type { ViewManifest } from "../schemas/view-manifest/index.ts";

export const fixtureViewManifest: ViewManifest = {
  version: "1.0",
  boardPage: {
    html: {
      path: "board-page.html",
      sha256: "eb3f451430f89ee407e70cb6b8e333ab4315e962c20d2c89eae62d70eb080afd",
      bytes: 459,
    },
    script: {
      path: "board-page.js",
      sha256: "1c593c363e2185d3d2c81925567bdcd07129690ad4ed88f30c9f44017ee09a3c",
      bytes: 197,
    },
    styles: [
      {
        path: "board-page.css",
        sha256: "c52f7a630f7e6ef453effd2099290f05e0e0e6e986b981234c3cfe40c2913afb",
        bytes: 110,
      },
    ],
    licences: [
      {
        package: "@modelcontextprotocol/ext-apps",
        version: "2.0.4",
        licence: "MIT",
        path: "licences/modelcontextprotocol-ext-apps-2.0.4.txt",
      },
      {
        package: "@modelcontextprotocol/core",
        version: "2.4.0",
        licence: "Apache-2.0",
        path: "licences/modelcontextprotocol-core-2.4.0.txt",
      },
      {
        package: "zod",
        version: "4.6.7",
        licence: "MIT",
        path: "licences/zod-4.6.7.txt",
      },
      {
        package: "ajv",
        version: "8.20.0",
        licence: "MIT",
        path: "licences/ajv-8.20.0.txt",
      },
    ],
  },
  chunks: {
    shell: {
      kind: "shell",
      script: {
        path: "chunks/shell.js",
        sha256: "99708a9b5143f29beb3bcd7056bc6870c28f43bb76f933c7ecab9320ea75dd86",
        bytes: 167,
      },
      styles: [
        {
          path: "chunks/shell.css",
          sha256: "34bf761779baa15c65520b50a4253189e3b9fda0b8e5c68e3776e637f246bbdd",
          bytes: 85,
        },
      ],
      needs: ["react", "ext-apps"],
      licences: [],
    },
    react: {
      kind: "library",
      script: {
        path: "chunks/react.js",
        sha256: "745155309991f3e3ec5a68d7f90b819978e8a44c88227f835bc210d0194decd3",
        bytes: 212,
      },
      styles: [],
      needs: [],
      licences: [
        {
          package: "react",
          version: "19.3.1",
          licence: "MIT",
          path: "licences/react-19.3.1.txt",
        },
        {
          package: "react-dom",
          version: "19.3.1",
          licence: "MIT",
          path: "licences/react-dom-19.3.1.txt",
        },
        {
          package: "scheduler",
          version: "0.28.0",
          licence: "MIT",
          path: "licences/scheduler-0.28.0.txt",
        },
      ],
    },
    radix: {
      kind: "library",
      script: {
        path: "chunks/radix.js",
        sha256: "0a842cf6ae72dcbc52d3d96d19ae28cd7317bc1ffabfe8fa6dc1ad853737d0c9",
        bytes: 168,
      },
      styles: [],
      needs: ["react"],
      licences: [
        {
          package: "radix-ui",
          version: "1.8.1",
          licence: "MIT",
          path: "licences/radix-ui-1.8.1.txt",
        },
      ],
    },
    "ext-apps": {
      kind: "library",
      script: {
        path: "chunks/ext-apps.js",
        sha256: "9798ec637cc3075de3219b576e60adb6fd1c56f1dc09cae7957528e2173a8443",
        bytes: 176,
      },
      styles: [],
      needs: [],
      licences: [
        {
          package: "@modelcontextprotocol/ext-apps",
          version: "2.0.4",
          licence: "MIT",
          path: "licences/modelcontextprotocol-ext-apps-2.0.4.txt",
        },
        {
          package: "@modelcontextprotocol/core",
          version: "2.4.0",
          licence: "Apache-2.0",
          path: "licences/modelcontextprotocol-core-2.4.0.txt",
        },
        {
          package: "zod",
          version: "4.6.7",
          licence: "MIT",
          path: "licences/zod-4.6.7.txt",
        },
      ],
    },
    choice: {
      kind: "component",
      script: {
        path: "chunks/choice.js",
        sha256: "9a1379aee91f15c253f00938e7c79a387f9c1692fa809e6d467ef6c9b63618f1",
        bytes: 181,
      },
      styles: [
        {
          path: "chunks/choice.css",
          sha256: "f5d178a12c8c0799615b47fdc7dfa693cfc5b79ca3476fdc7a86f8bb84cf3608",
          bytes: 89,
        },
      ],
      needs: ["react", "radix"],
      components: ["choice"],
      licences: [],
    },
  },
};

const sources: Readonly<Record<string, string>> = {
  "board-page.html":
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>AskBoard</title>\n<style>/* AskBoard view fixture: the board page\'s styles. */\nbody { margin: 0; font-family: system-ui, sans-serif; }\n</style>\n</head>\n<body>\n<script>/* AskBoard view fixture: the board page script. The view build writes the real one. */\n(function () {\n  "use strict";\n  document.documentElement.setAttribute("data-askboard", "board-page");\n})();\n</script>\n</body>\n</html>\n',
  "board-page.js":
    '/* AskBoard view fixture: the board page script. The view build writes the real one. */\n(function () {\n  "use strict";\n  document.documentElement.setAttribute("data-askboard", "board-page");\n})();\n',
  "board-page.css":
    "/* AskBoard view fixture: the board page's styles. */\nbody { margin: 0; font-family: system-ui, sans-serif; }\n",
  "chunks/shell.js":
    '/* AskBoard view fixture: the view shell. The view build writes the real one. */\n(function () {\n  "use strict";\n  globalThis.askboardShell = { chunk: "shell" };\n})();\n',
  "chunks/shell.css":
    "/* AskBoard view fixture: the shell's styles. */\n:root { color-scheme: light dark; }\n",
  "chunks/react.js":
    '/* AskBoard view fixture: the React library chunk. The view build writes the real one. */\n(function () {\n  "use strict";\n  globalThis.React = { chunk: "react" };\n  globalThis.ReactDOM = { chunk: "react" };\n})();\n',
  "chunks/radix.js":
    '/* AskBoard view fixture: the Radix library chunk. The view build writes the real one. */\n(function () {\n  "use strict";\n  globalThis.Radix = { chunk: "radix" };\n})();\n',
  "chunks/ext-apps.js":
    '/* AskBoard view fixture: the ext-apps library chunk. The view build writes the real one. */\n(function () {\n  "use strict";\n  globalThis.ExtApps = { chunk: "ext-apps" };\n})();\n',
  "chunks/choice.js":
    '/* AskBoard view fixture: the Choice component chunk. The view build writes the real one. */\n(function () {\n  "use strict";\n  globalThis.askboardChoice = { chunk: "choice" };\n})();\n',
  "chunks/choice.css":
    "/* AskBoard view fixture: Choice's styles. */\n.ab-choice { display: grid; gap: 0.5rem; }\n",
  "licences/modelcontextprotocol-ext-apps-2.0.4.txt":
    "@modelcontextprotocol/ext-apps 2.0.4: MIT. Fixture notice; the view build copies the package's licence file.\n",
  "licences/modelcontextprotocol-core-2.4.0.txt":
    "@modelcontextprotocol/core 2.4.0: Apache-2.0. Fixture notice; the view build copies the package's licence file.\n",
  "licences/zod-4.6.7.txt":
    "zod 4.6.7: MIT. Fixture notice; the view build copies the package's licence file.\n",
  "licences/ajv-8.20.0.txt":
    "ajv 8.20.0: MIT. Fixture notice; the view build copies the package's licence file.\n",
  "licences/react-19.3.1.txt":
    "react 19.3.1: MIT. Fixture notice; the view build copies the package's licence file.\n",
  "licences/react-dom-19.3.1.txt":
    "react-dom 19.3.1: MIT. Fixture notice; the view build copies the package's licence file.\n",
  "licences/scheduler-0.28.0.txt":
    "scheduler 0.28.0: MIT. Fixture notice; the view build copies the package's licence file.\n",
  "licences/radix-ui-1.8.1.txt":
    "radix-ui 1.8.1: MIT. Fixture notice; the view build copies the package's licence file.\n",
};

/** Every file of the fixture build by its path in the folder, the manifest file included. */
export const fixtureViewFiles: Readonly<Record<string, string>> = {
  ...sources,
  [VIEW_MANIFEST_FILE]: `${JSON.stringify(fixtureViewManifest, null, 2)}\n`,
};
