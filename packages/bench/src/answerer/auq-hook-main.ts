// The PreToolUse hook's entry, as the run's settings register it for AskUserQuestion (design
// decision 6). It exits 0 with no decision on input it cannot read, as AskBoard's hooks do (AD-19).

import { appendFileSync, readFileSync } from "node:fs";
import { entryArgs } from "./args.ts";
import { hookOutput } from "./auq.ts";

const at = Math.round(performance.timeOrigin);

export const main = async (
  argv: readonly string[],
  stdin: string,
  write: (text: string) => void,
): Promise<number> => {
  const { plan, records } = entryArgs(argv);
  if (plan === undefined || records === undefined) return 2;
  let input: unknown;
  try {
    input = JSON.parse(stdin);
  } catch {
    return 0;
  }
  const { output, record } = hookOutput(input, JSON.parse(readFileSync(plan, "utf8")));
  if (record !== undefined) appendFileSync(records, `${JSON.stringify({ ...record, at })}\n`);
  if (output !== undefined) write(JSON.stringify(output));
  return 0;
};

const readAll = async (stream: AsyncIterable<Buffer | string>): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

/** Reads the hook input from `input` and prints the decision to `output`. */
export const run = async (
  argv: readonly string[],
  input: AsyncIterable<Buffer | string>,
  output: { write: (text: string) => unknown },
): Promise<number> => main(argv, await readAll(input), (text) => output.write(text));

if (import.meta.main) {
  process.exitCode = await run(process.argv.slice(2), process.stdin, process.stdout);
}
