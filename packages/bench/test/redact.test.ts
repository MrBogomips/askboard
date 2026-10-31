import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { REDACTED, redact, redactTree } from "../src/redact.ts";
import { useScratch } from "./support/scratch.ts";

const scratch = useScratch();

const { token, link } = PLAIN_CHOICE;

describe("redact", () => {
  test("replaces the token of a board link, plain or inside escaped JSON", () => {
    expect(redact(`open ${link} now`)).toBe(`open ${link.replace(token, REDACTED)} now`);
    const escaped = JSON.stringify(JSON.stringify({ board: link }));
    expect(redact(escaped)).not.toContain(token);
    expect(redact(`${link}&x=1`)).toContain(`t=${REDACTED}&x=1`);
  });

  test("replaces a connect message's token, plain or escaped", () => {
    const message = JSON.stringify({ version: "1.0", type: "connect", token });
    expect(redact(message)).toBe(
      JSON.stringify({ version: "1.0", type: "connect", token: REDACTED }),
    );
    expect(redact(JSON.stringify(message))).not.toContain(token);
  });

  test("leaves other text as it was", () => {
    const text =
      '{"output_tokens":12,"tokens":"many","note":"t=short? the=value","at":"2026-10-30"}';
    expect(redact(text)).toBe(text);
  });

  test("redactTree rewrites every file under a folder that held a token", () => {
    const root = scratch("bench-redact-");
    mkdirSync(join(root, "transcripts"));
    writeFileSync(join(root, "transcripts", "main.jsonl"), `{"board":"${link}"}\n`);
    writeFileSync(join(root, "clean.txt"), "nothing here");
    expect(redactTree(root)).toBe(1);
    expect(readFileSync(join(root, "transcripts", "main.jsonl"), "utf8")).not.toContain(token);
    expect(readFileSync(join(root, "clean.txt"), "utf8")).toBe("nothing here");
  });
});
