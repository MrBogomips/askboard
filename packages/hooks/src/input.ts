// The hook input (design decision 6): Claude Code writes one JSON object on the hook's stdin and
// closes it. The hooks read it to its end, bounded at 1 MiB, and stop reading as soon as it passes.

import { HookFailure } from "./failure.ts";

/** The largest hook input a hook reads: more is refused, unread. */
export const HOOK_INPUT_MAX_BYTES = 1024 * 1024;

/** The hook input: Claude Code's fields keep Claude Code's names. */
export type HookInput = Readonly<Record<string, unknown>>;

const TOO_LARGE = `the hook input is over ${HOOK_INPUT_MAX_BYTES / (1024 * 1024)} MiB`;

/** Reads `stdin` to its end; past the limit it stops and throws, leaving the rest unread. */
export const readInput = async (
  stdin: AsyncIterable<Uint8Array | string>,
  max: number = HOOK_INPUT_MAX_BYTES,
): Promise<string> => {
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stdin) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    size += bytes.byteLength;
    if (size > max) throw new HookFailure(TOO_LARGE);
    parts.push(bytes);
  }
  const whole = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    whole.set(part, at);
    at += part.byteLength;
  }
  return new TextDecoder().decode(whole);
};

/** The input as a JSON object; anything else is refused without quoting it. */
export const parseInput = (text: string): HookInput => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HookFailure("the hook input is not a JSON object");
  }
  return value as HookInput;
};
