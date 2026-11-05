// The `.askboard/` folder under the session project root (AD-14, Project folders; settings-languages
// design decision 13). E7 (`snapshot`) names the same constants: whichever change lands first
// defines them, and the other reuses them.

/** AskBoard's folder under the session project root. */
export const ASKBOARD_FOLDER = ".askboard";

/**
 * The subfolders the session process creates at its first ask, when missing. `bench/` is the
 * benchmark's, which creates it with its own `.gitignore`.
 */
export const ASKBOARD_SUBFOLDERS = ["snapshots", "media", "patches"] as const;

/** The default Snapshot folder, relative to the session project root (FR-27). */
export const SNAPSHOT_FOLDER = ".askboard/snapshots";

/**
 * The lines of `.askboard/.gitignore`, written only when that file is created, so a user who
 * commits Snapshots keeps their own.
 */
export const ASKBOARD_GITIGNORE = ["snapshots/", "media/", "patches/", "bench/"] as const;
