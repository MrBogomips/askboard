// The `snapshot` unit's stderr lines (Consistency Conventions, Process output; snapshot design
// decision 6): fixed text, the Snapshot folder or the missing variable, and a code. Never the file's
// name, which holds the ask ID, nor anything of the agent's content or a token (AD-11).

import type { SnapshotWriteError } from "@askboard/core";

/** Writes one diagnostics line to stderr. */
export type ReportLine = (line: string) => void;

const PREFIX = "askboard:";
const FILE_SYSTEM_CODE = /^[A-Z0-9_]{1,32}$/;

/** A failed call's code as Node names it (`EACCES`, `EEXIST`); `EIO` when it carries none. */
export const codeOf = (error: unknown): string => {
  const code =
    typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" && FILE_SYSTEM_CODE.test(code) ? code : "EIO";
};

/** The line for a Snapshot not written: its error's message, which names only the folder and the code. */
export const failureLine = (error: SnapshotWriteError): string => `${PREFIX} ${error.message}`;

/** Reports a Snapshot not written, once, and rejects with its error. */
export const refuse = (error: SnapshotWriteError, report: ReportLine): never => {
  report(failureLine(error));
  throw error;
};

/** The line for a written Snapshot whose partial file could not be removed. */
export const leftoverLine = (folder: string, code: string): string =>
  `${PREFIX} a Snapshot's partial file stayed in ${folder}: ${code}`;
