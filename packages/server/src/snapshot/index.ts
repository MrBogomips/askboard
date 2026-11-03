// snapshot (snapshot design decision 6): writes each Snapshot of an ask into the session project's
// Snapshot folder as one self-contained page, never outside the project and never over a file. It
// imports only ask-core, the contract and `view/assemble` (AD-1); the entry point wires it.

export type { FolderResult, PrepareFolders } from "./files.ts";
export { type LoadedViewBuild, SnapshotBuildError, type ViewBuild } from "./page.ts";
export { createSnapshotWriter, type SnapshotWriterOptions } from "./writer.ts";
