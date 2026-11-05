// excerpts: reading a pointer's file read-only and only inside the ask's root, the `SourceFiles`
// port of ask-core (AD-12; excerpts, design decision 3). It imports only ask-core and the contract
// (AD-1), and Node's file system.

export { createSourceFiles, type SourceFilesOptions } from "./files.ts";
export { nodeSourceFs, type SourceFs, type SourceHandle, type SourceStats } from "./fs.ts";
