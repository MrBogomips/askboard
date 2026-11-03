// Fake ports for ask-core's tests: each records how it was called.

import type { AskInput } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  AskCore,
  type Clock,
  type Config,
  type CoreEvent,
  type CorePorts,
  type FileRead,
  type FolderResult,
  type Showing,
  type WriteResult,
} from "../src/index.ts";

export type Calls = string[];

export type FakeOptions = {
  readonly bytes?: readonly number[];
  readonly showing?: Showing;
  readonly git?: string;
  readonly login?: string;
  readonly linkFails?: boolean;
  readonly clock?: FakeClock;
  /** The configuration's port and where its diagnostics go (settings-languages). */
  readonly config?: Config;
  readonly diagnose?: (text: string) => void;
};

let seed = 0;

/** A clock the test moves by hand: `advance` runs the timers that fall due, in time order. */
export type FakeClock = Clock & {
  advance(ms: number): void;
  /** The timers not yet run or cancelled. */
  readonly pending: number;
};

/** The core's time in the tests: 2026-10-31T14:20:03Z. */
export const CLOCK_START = Date.parse("2026-10-31T14:20:03Z");

export const fakeClock = (start = CLOCK_START): FakeClock => {
  let now = start;
  let next = 0;
  const timers = new Map<number, { readonly at: number; readonly run: () => void }>();
  const due = (until: number) =>
    [...timers]
      .filter(([, timer]) => timer.at <= until)
      .sort(([a, x], [b, y]) => x.at - y.at || a - b)[0];
  return {
    now: () => now,
    after: (ms, run) => {
      next += 1;
      const id = next;
      timers.set(id, { at: now + ms, run });
      return () => timers.delete(id);
    },
    advance: (ms) => {
      const until = now + ms;
      for (let timer = due(until); timer !== undefined; timer = due(until)) {
        const [id, { at, run }] = timer;
        timers.delete(id);
        now = at;
        run();
      }
      now = until;
    },
    get pending() {
      return timers.size;
    },
  };
};

export const fakePorts = (options: FakeOptions = {}) => {
  const calls: Calls = [];
  const opened: string[] = [];
  const reported: unknown[] = [];
  seed += 1;
  const source = options.bytes ?? Array.from({ length: 8 }, (_, i) => (seed * 8 + i) % 252);
  let position = 0;
  const clock = options.clock ?? fakeClock();
  const ports: CorePorts = {
    randomness: {
      bytes: (count) => {
        calls.push(`bytes ${count}`);
        return Uint8Array.from({ length: count }, () => source[position++ % source.length] ?? 0);
      },
    },
    showing: {
      check: async () => {
        calls.push("check");
        return options.showing ?? { showable: true };
      },
      open: (link) => {
        calls.push("open");
        opened.push(link);
      },
    },
    address: {
      link: async (askId) => {
        calls.push(`link ${askId}`);
        if (options.linkFails) throw new Error("no free port in 47200-47299");
        return `http://127.0.0.1:47213/b/${askId}?t=pV3xK9qLmT2wR7nB4cYh8A`;
      },
    },
    identity: {
      gitUserName: async () => {
        calls.push("git");
        return options.git;
      },
      loginName: async () => {
        calls.push("login");
        return options.login;
      },
    },
    report: (error) => reported.push(error),
    clock,
    ...(options.config === undefined ? {} : { config: options.config }),
    ...(options.diagnose === undefined ? {} : { diagnose: options.diagnose }),
  };
  return { ports, calls, opened, reported, clock };
};

export const coreWith = (options: FakeOptions = {}) => {
  const fakes = fakePorts(options);
  const core = new AskCore(fakes.ports);
  const heard: CoreEvent[] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard, ...fakes };
};

const [question] = plainChoiceBoardDocument.items;

/** The approved plain-choice ask (`asks/plain-choice.json`), as a fresh object. */
export const plainChoiceAsk = (): AskInput =>
  JSON.parse(
    JSON.stringify({
      askId: plainChoiceBoardDocument.askId,
      items: [{ type: question.type, id: question.id, props: question.props }],
    }),
  );

export const askWith = (fields: Partial<AskInput>): AskInput => ({
  ...plainChoiceAsk(),
  ...fields,
});

export const answer = (fields: Partial<Parameters<AskCore["answer"]>[1]> = {}) => ({
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: "2026-10-29T09:41:27Z",
  ...fields,
});

// settings-languages (design decision 3): a fake `Config`, each file given as its text, an object
// written as JSON, a `FileRead` as it is, or nothing for an absent file. `replaceUserFile` hands the
// transform the user file and keeps what it writes; `calls` records each method called.
export type FakeFile = string | Readonly<Record<string, unknown>> | FileRead | undefined;

export type FakeConfigOptions = {
  readonly user?: FakeFile;
  readonly project?: FakeFile;
  readonly othersCanWrite?: boolean;
  readonly paths?: Config["paths"];
  readonly write?: (text: string) => WriteResult;
  readonly folders?: FolderResult;
};

const isRead = (file: FakeFile): file is FileRead =>
  typeof file === "object" && file !== null && "kind" in file && typeof file.kind === "string";

const readOf = (file: FakeFile, othersCanWrite = false): FileRead => {
  if (file === undefined) return { kind: "absent" };
  if (isRead(file)) return file;
  const text = typeof file === "string" ? file : JSON.stringify(file);
  return { kind: "read", text, othersCanWrite };
};

export const fakeConfig = (options: FakeConfigOptions = {}) => {
  const calls: Calls = [];
  let user = options.user;
  const written: string[] = [];
  const diagnosed: string[] = [];
  const config: Config = {
    userFile: async () => {
      calls.push("user");
      return readOf(user, options.othersCanWrite);
    },
    projectFile: async () => {
      calls.push("project");
      return readOf(options.project);
    },
    replaceUserFile: async (change) => {
      calls.push("replace");
      const replace = change(readOf(user, options.othersCanWrite));
      if (replace.kind === "refuse") return { kind: "refused", reason: replace.reason };
      const result = options.write?.(replace.text) ?? {
        kind: "written",
        path: "/home/u/.config/askboard/config.json",
      };
      if (result.kind === "written") {
        user = replace.text;
        written.push(replace.text);
      }
      return result;
    },
    ensureProjectFolders: async () => {
      calls.push("folders");
      return options.folders ?? { kind: "ready", created: [] };
    },
    paths: options.paths ?? {
      user: "~/.config/askboard/config.json",
      project: ".askboard/config.json",
    },
  };
  return {
    config,
    calls,
    written,
    diagnosed,
    diagnose: (text: string) => {
      diagnosed.push(text);
    },
    /** The user file changes, as another session or a hand edit would. */
    setUser: (file: FakeFile) => {
      user = file;
    },
  };
};

/** The language and locale ask-core names on a board document when nothing sets them (task 3.6). */
export const EN_US = { language: "en-US", locale: "en-US" } as const;
