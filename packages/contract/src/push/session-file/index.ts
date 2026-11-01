// The session file (owner `board-host`, AD-5; design decision 3): the one place where the hooks
// and the mod learn the session process's local API and token. It names its format's version in
// `format`, since it is a file, not a message.

import type { SchemaSet } from "../../versions.ts";
import sessionFile from "./session-file.json" with { type: "json" };

export const SESSION_FILE_FORMAT = "1.0";

/** The session file's schema, at its format; in no set until the follow-up of design decision 1. */
export const sessionFileSchemas: SchemaSet = {
  name: "session-file",
  title: "session file",
  owner: "board-host",
  version: SESSION_FILE_FORMAT,
  schemas: [sessionFile],
};

export type SessionFile = {
  readonly format: string;
  /** The Claude Code process's PID, which names the file. */
  readonly key: number;
  /** The session process's PID. */
  readonly pid: number;
  readonly epoch: string;
  /** The local API's socket path. */
  readonly apiAddress: string;
  readonly sessionToken: string;
  /** The session project root, the real path of `CLAUDE_PROJECT_DIR`; absent without one (AD-12). */
  readonly projectDir?: string;
  /** RFC 3339 UTC. */
  readonly startedAt: string;
};
