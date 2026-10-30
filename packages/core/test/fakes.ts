// Fake ports for ask-core's tests: each records how it was called.

import type { AskInput } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { AskCore, type CoreEvent, type CorePorts, type Showing } from "../src/index.ts";

export type Calls = string[];

export type FakeOptions = {
  readonly bytes?: readonly number[];
  readonly showing?: Showing;
  readonly git?: string;
  readonly login?: string;
  readonly linkFails?: boolean;
};

let seed = 0;

export const fakePorts = (options: FakeOptions = {}) => {
  const calls: Calls = [];
  const opened: string[] = [];
  const reported: unknown[] = [];
  seed += 1;
  const source = options.bytes ?? Array.from({ length: 8 }, (_, i) => (seed * 8 + i) % 252);
  let position = 0;
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
  };
  return { ports, calls, opened, reported };
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
