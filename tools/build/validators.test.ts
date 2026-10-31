import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_PROTOCOL_MESSAGES } from "@askboard/contract";
import {
  boardProtocolExamples,
  lifecycleProtocolExamples,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { HOST_VALIDATORS_RUNTIME, hostValidatorsCode } from "./validators.ts";

type Check = ((value: unknown) => boolean) & { errors?: unknown[] | null };

const code = hostValidatorsCode();
let dir = "";
let generated: Record<string, Check> = {};

// The generated module needs Ajv's run-time helper by its package name, which resolves from the
// board page's folder in the build; here it is pointed at this folder's resolution instead.
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "askboard-validators-"));
  const runtime = Bun.resolveSync(HOST_VALIDATORS_RUNTIME, import.meta.dir);
  const file = join(dir, "validators.mjs");
  await Bun.write(file, code.replaceAll(`"${HOST_VALIDATORS_RUNTIME}"`, JSON.stringify(runtime)));
  ({ hostMessageSchemas: generated } = await import(file));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("the board page's standalone validators (AD-7, design decision 7)", () => {
  test("need nothing at run time but Ajv's ucs2length helper", () => {
    const required = [...code.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);
    expect([...new Set(required)]).toEqual([HOST_VALIDATORS_RUNTIME]);
    expect(code).not.toMatch(/\bimport\s*[{*\w]/);
  });

  test("hold no eval and no Function constructor, which the board page's CSP blocks", () => {
    expect(code).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/);
  });

  test("export one validator for each message board-host sends", () => {
    expect(Object.keys(generated).sort()).toEqual(
      Object.keys(BOARD_PROTOCOL_MESSAGES.toPage).sort(),
    );
  });

  const valid = boardProtocolExamples.toPage as readonly { type: string }[];
  const invalid: readonly { type: string }[] = [
    { version: "1.0", type: "board", document: { ...plainChoiceBoardDocument, extra: 1 } },
    { version: "1.0", type: "state", state: { ask: "waiting", questions: [] } },
    { version: "1.0", type: "receipt", itemId: "database", receipt: "sent" },
    { version: "1.0", type: "discarded", reason: "agent-finished" },
    { version: "1.0", type: "moved", why: "x" },
    { version: "1.0", type: "refused", reason: "token" },
  ] as never;

  test.each([...valid, ...invalid].map((message) => [message.type, message] as const))(
    "agree with the contract's validation on a %s message",
    (type, message) => {
      const check = generated[type];
      if (check === undefined) throw new Error(`no generated validator for ${type}`);
      expect(check(message)).toBe(validateBoardMessage("toPage", message).ok);
    },
  );

  test("each valid example passes and each invalid one fails", () => {
    expect(valid.every((message) => generated[message.type]?.(message))).toBe(true);
    expect(invalid.some((message) => generated[message.type]?.(message))).toBe(false);
  });

  test("accept what board protocol 1.1 adds, as the contract does (ask-lifecycle, task 1.4)", () => {
    const added = lifecycleProtocolExamples.toPage as readonly { type: string }[];
    expect(new Set(added.map((message) => message.type))).toEqual(
      new Set(["board", "state", "done", "draft", "closed", "refused", "discarded"]),
    );
    for (const message of added) {
      const check = generated[message.type];
      expect({ message, ok: check?.(message) }).toEqual({ message, ok: true });
      expect(validateBoardMessage("toPage", message).ok).toBe(true);
    }
  });
});
