// The bundle's hook and client modes in the conformance suite (task 6.6): each run as a process
// of this suite, which stands for Claude Code as the parent of the session process and of every
// hook, in empty folders of its own, with a guard preloaded that refuses any listening socket.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { request } from "node:http";
import { basename, join } from "node:path";
import {
  LOCAL_API_HOST,
  SESSION_TOKEN_HEADER,
  type SessionFile,
  sessionFilePath,
  sessionFolder,
} from "@askboard/contract";
import { bundleWith, RUNTIME } from "./session.ts";

/** Preloaded into every hook or client run: it ends a process that opens a listening socket. */
export const GUARD = join(import.meta.dir, "no-listen.mjs");
const UID = process.getuid?.() ?? 0;

const made: string[] = [];

/** A temporary folder under `/tmp`, short enough for a socket path. */
export const shortFolder = (): string => {
  const folder = mkdtempSync("/tmp/abc-");
  made.push(folder);
  return folder;
};

/** Removes the folders `shortFolder` made. */
export const removeShortFolders = (): void => {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true });
};

/** Every path under `folder`, sorted, folders marked with a trailing slash. */
export const treeOf = (folder: string): string[] =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .map((entry) => {
      const path = join(entry.parentPath, entry.name).slice(folder.length + 1);
      return entry.isDirectory() ? `${path}/` : path;
    })
    .sort();

/** The runtime's flag that loads a module before the bundle. */
export const preloadFlag = (): string =>
  basename(RUNTIME).startsWith("node") ? "--import" : "--preload";

export type ModeRun = { readonly code: number; readonly stdout: string; readonly stderr: string };

export type ModeOptions = {
  /** The session folder's runtime folder, `XDG_RUNTIME_DIR`. */
  readonly runtime: string;
  /** The process's own home, temporary folder and working folder, which it must leave empty. */
  readonly home: string;
  readonly stdin?: string;
  /** A script to run in place of the bundle, to check the guard. */
  readonly script?: string;
};

/** Runs the bundle in one mode, as a child of this suite, with the guard preloaded. */
export const runMode = async (args: readonly string[], options: ModeOptions): Promise<ModeRun> => {
  const child = Bun.spawn(
    [RUNTIME, preloadFlag(), GUARD, options.script ?? bundleWith(), ...args],
    {
      cwd: options.home,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: options.home,
        TMPDIR: options.home,
        XDG_RUNTIME_DIR: options.runtime,
        BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
      },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  child.stdin.write(options.stdin ?? "");
  child.stdin.end();
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
};

/** The session file this suite's session process wrote in `runtime`, waiting for it to appear. */
export const sessionFileIn = async (runtime: string): Promise<SessionFile> => {
  const file = sessionFilePath(
    sessionFolder({ env: { XDG_RUNTIME_DIR: runtime }, uid: UID }),
    process.pid,
  );
  const until = Date.now() + 5_000;
  for (;;) {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as SessionFile;
    } catch (error) {
      if (Date.now() > until) throw error;
      await Bun.sleep(10);
    }
  }
};

/** A GET over the local API's socket with the session token, as the mod sends it. */
export const getOverSocket = (
  session: SessionFile,
  path: string,
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const sent = request(
      {
        socketPath: session.apiAddress,
        path,
        headers: { Host: LOCAL_API_HOST, [SESSION_TOKEN_HEADER]: session.sessionToken },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", reject);
      },
    );
    sent.on("error", reject);
    sent.end();
  });
