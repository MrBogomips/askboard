// The view manifest (owner `view`, AD-7 as amended by E1): what the view build publishes and
// `board-host` reads at run time to serve the chunks and to build the board page's CSP.

import type { SchemaSet } from "../../versions.ts";
import viewManifest from "./view-manifest.json" with { type: "json" };

export const VIEW_MANIFEST_VERSION = "1.1";

export const viewManifestSet: SchemaSet = {
  name: "view-manifest",
  title: "view manifest",
  owner: "view",
  version: VIEW_MANIFEST_VERSION,
  schemas: [viewManifest],
};

/** A built file, with its path relative to the manifest's folder. */
export type ManifestFile = {
  readonly path: string;
  /** The SHA-256 of the file's bytes, lowercase hex: the chunk route's key. */
  readonly sha256: string;
  readonly bytes: number;
};

export type LicenceNotice = {
  readonly package: string;
  readonly version: string;
  /** SPDX expression. */
  readonly licence: string;
  /** The licence text, relative to the manifest's folder. */
  readonly path: string;
};

export type ManifestChunk = {
  readonly kind: "shell" | "library" | "component";
  readonly script: ManifestFile;
  readonly styles: readonly ManifestFile[];
  /** The chunks this one needs, by name. */
  readonly needs: readonly string[];
  /** The catalog components a component chunk registers. */
  readonly components?: readonly string[];
  readonly licences: readonly LicenceNotice[];
  /** Needed only with a parent host: a board selects it, a Snapshot never does (1.1). */
  readonly hostOnly?: true;
  /** A component chunk's kept-render chunk, by name (1.1). */
  readonly keptRender?: string;
};

export type ViewManifest = {
  readonly version: string;
  readonly boardPage: {
    /** The page as served, with `script` and `styles` inline. */
    readonly html: ManifestFile;
    readonly script: ManifestFile;
    readonly styles: readonly ManifestFile[];
    readonly licences: readonly LicenceNotice[];
  };
  readonly chunks: Readonly<Record<string, ManifestChunk>>;
};
