// zrender as the chart tests read it (chart-widget task 4.1). `widgets` declares `echarts` alone, and
// under the isolated linker `zrender` is not in its `node_modules`, so it is found where `echarts`
// itself finds it: in the folder beside the real `echarts` one. No dependency is added; a version
// of `echarts` with another `zrender` is read as its own.

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// The real folder of `echarts`: the entry's folder walked up to the package's own.
const echartsFolder = (): string => {
  const entry = realpathSync(createRequire(import.meta.url).resolve("echarts"));
  let folder = dirname(entry);
  while (!folder.endsWith("/echarts")) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error(`no echarts folder above ${entry}`);
    folder = parent;
  }
  return folder;
};

/** A file of `echarts` by its path under the package (`package.json`). */
export const echartsFile = (path: string): string => join(echartsFolder(), path);

/** The real folder of `zrender`, the one `echarts` resolves, beside `echarts`' own. */
export const zrenderDir = (): string => realpathSync(join(dirname(echartsFolder()), "zrender"));

/** A file of `zrender` by its path under the package (`lib/graphic/helper/parseText.js`). */
export const zrenderFile = (path: string): string => join(zrenderDir(), path);

/** A module of `zrender` by its path, imported from that file so every import shares one copy. */
export const importZrender = (path: string): Promise<Record<string, unknown>> =>
  import(pathToFileURL(zrenderFile(path)).href);
