// Who asked and where (FR-24; design decision 12): the context header's first row as the board
// protocol's origin message, from the ask's origin, its agent's name, the expected answerer and the
// session project. Pure, with no Node or browser API, so that board-host sends it and ask-core can
// build the same row (AD-1). A field the contract cannot take is left out, and the board shows it
// as unknown.

import { BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import type { OriginMessage } from "./messages.ts";

/** Who asked and for whom, as the origin message reads it: ask-core's `WhoAsked` fits it. */
export type WhoAskedFields = {
  /** The owner's origin; absent for an unchecked ask. */
  readonly origin?: {
    readonly label: string;
    readonly ordinal?: number;
    /** The owner's `cwd` relative to the ask's root, worked out when the origin was bound. */
    readonly directory?: string;
    readonly branch?: string;
    readonly worktree?: string;
  };
  readonly agentName?: string;
  /** The expected answerer, only when the header shows "For:". */
  readonly forUser?: string;
};

/** Who asked an ask with no agent record (view spec, "Who asked, and where"). */
const UNCHECKED_LABEL = "Agent";

// The origin message's limits, in characters, on the fields it bounds (`origin.json`).
const MAX = { label: 512, directory: 4_096, branch: 1_024, folder: 255 } as const;

// The value when it is text the contract takes, else nothing.
const fitting = (value: string | undefined, max: number): string | undefined =>
  value !== undefined && value !== "" && value.length <= max ? value : undefined;

const field = <K extends string>(key: K, value: string | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, string>>;

// The last name of a POSIX path; none for the file system's root.
const folderName = (path: string): string | undefined =>
  path
    .split("/")
    .filter((name) => name !== "")
    .at(-1);

/** Who asked and where, for an ask of the session whose project is the folder `projectDir`. */
export const originMessage = (projectDir: string, asked: WhoAskedFields): OriginMessage => {
  const { origin, agentName, forUser } = asked;
  const label = fitting(origin?.label, MAX.label) ?? UNCHECKED_LABEL;
  const ordinal = origin?.ordinal;
  return {
    version: BOARD_PROTOCOL_VERSION,
    type: "origin",
    who: {
      label,
      ...field("name", agentName),
      ...(ordinal === undefined ? {} : { ordinal }),
    },
    ...field("forUser", forUser),
    ...field("project", fitting(folderName(projectDir), MAX.folder)),
    ...(origin === undefined
      ? {}
      : {
          ...field("directory", fitting(origin.directory, MAX.directory)),
          ...field("branch", fitting(origin.branch, MAX.branch)),
          ...field("worktree", fitting(origin.worktree, MAX.folder)),
        }),
  };
};
