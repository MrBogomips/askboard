// The Snapshot constants (snapshot design decision 2; contract spec, Snapshot constants): the file's
// name and the IDs of a Snapshot's two JSON blocks. The Snapshot folder and the lines of
// `.askboard/.gitignore` are the `.askboard/` constants that E8 (`settings-languages`) defines; E7
// reuses them rather than defining its own.

import { ID_PATTERN } from "../constants.ts";

/** The random part of a Snapshot's name: 6 characters from `[a-z0-9]` (AD-15, open question A4). */
export const SNAPSHOT_RANDOM = {
  length: 6,
  alphabet: "0123456789abcdefghijklmnopqrstuvwxyz",
} as const;

/** How many names a Snapshot tries, each with a new random part, before it fails (B10). */
export const SNAPSHOT_NAME_TRIES = 5;

/**
 * A Snapshot's file name, `<ask-id>-<YYYYMMDDTHHMMSSZ>-<random>.html`: the basic ISO 8601 form in
 * UTC, with no colon, so the name is valid on macOS, Linux and Windows drives under WSL (NFR-7).
 */
export const SNAPSHOT_NAME_PATTERN = `^${ID_PATTERN.slice(1, -1)}-[0-9]{8}T[0-9]{6}Z-[a-z0-9]{${SNAPSHOT_RANDOM.length}}\\.html$`;

/** The `<script type="application/json">` element holding the data the view boots from (AD-9). */
export const SNAPSHOT_DATA_ELEMENT = "askboard-data";

/** The JSON block after the scripts listing the licence notices of the inlined code (B4, NFR-6). */
export const SNAPSHOT_LICENCES_ELEMENT = "askboard-licences";
