// Where the view build reads and writes (design decision 7). The build reads the view's sources by
// path, as entry points, and never imports `@askboard/view`.

import { join } from "node:path";
import { VIEW_DIRECTORY } from "@askboard/contract";

export const ROOT = join(import.meta.dir, "../..");
export const VIEW_DIR = join(ROOT, "packages/view");
export const VIEW_SRC = join(VIEW_DIR, "src");

/** `dist/view/`, beside the session process's bundle `dist/askboard.mjs`. */
export const DIST_VIEW = join(ROOT, "dist", VIEW_DIRECTORY);

/** Each chunk's recorded size in bytes, its script and styles together. */
export const SIZES_FILE = join(VIEW_DIR, "chunk-sizes.json");

/** DESIGN.md, whose front matter holds the tokens. */
export const DESIGN_FILE = join(ROOT, "docs/ux-askboard-2026-10-27/DESIGN.md");

export const BOARD_PAGE_ENTRY = join(VIEW_SRC, "board-page/index.ts");
export const SHELL_ENTRY = join(VIEW_SRC, "shell/index.tsx");
/** One folder per catalog component, named as the component, holding its chunk's entry. */
export const CATALOG_DIR = join(VIEW_SRC, "catalog");
export const PORT_FILE = join(CATALOG_DIR, "port.ts");
/** The shared Markdown renderer's entry, the library chunk `markdown` (document-review, design decision 6). */
export const MARKDOWN_FILE = join(VIEW_SRC, "markdown/index.ts");
export const SHARED_MODULES_FILE = join(VIEW_SRC, "shared-modules.ts");
export const ZOD_JITLESS_FILE = join(VIEW_SRC, "zod-jitless.ts");
export const VALIDATORS_FILE = join(VIEW_SRC, "board-page/validators.ts");
export const BASE_CSS = join(VIEW_SRC, "styles/base.css");
/**
 * The widgets' sources: like the catalog, one folder per widget holding its chunk's entry, beside
 * folders such as `shared/` that hold none (design decision 8).
 */
export const WIDGETS_SRC = join(ROOT, "packages/widgets/src");
/** The board graph's entry, the library chunk `board-graph` (molecules, design decision 13). */
export const GRAPH_FILE = join(WIDGETS_SRC, "board-graph/index.ts");

/** Packages the build resolves as the view does, from its folder (isolated linker). */
export const resolveFromView = (specifier: string): string => Bun.resolveSync(specifier, VIEW_DIR);

/** Packages the build resolves as the widgets do, from their folder (a chunk's package stylesheet). */
export const resolveFromWidgets = (specifier: string): string =>
  Bun.resolveSync(specifier, join(ROOT, "packages/widgets"));
