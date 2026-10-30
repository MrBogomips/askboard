// The board answerer's entry. A run's BROWSER is `browser.sh`, which execs this file with the case's
// plan and record paths and the board link, so it starts once per board (design decision 5). It
// prints nothing: its only output is one record line, without the token.

import { appendFileSync, readFileSync } from "node:fs";
import { entryArgs } from "./args.ts";
import type { BoardRecord } from "./board.ts";

// t2′: the process's start, before any module of bench loads.
const started = Math.round(performance.timeOrigin);

/** Answers the board at the link and appends its record; resolves 0 once it answered. */
export const main = async (argv: readonly string[], start = started): Promise<number> => {
  const { plan, records, positional } = entryArgs(argv);
  const [link] = positional;
  if (plan === undefined || records === undefined || link === undefined || positional.length > 1) {
    return 2;
  }
  let record: BoardRecord;
  try {
    const { answerBoard } = await import("./board.ts");
    record = await answerBoard({
      link,
      plan: JSON.parse(readFileSync(plan, "utf8")),
      started: start,
    });
  } catch (error) {
    record = {
      kind: "board",
      started: start,
      outcome: "error",
      problem: error instanceof Error ? error.name : "error",
    };
  }
  appendFileSync(records, `${JSON.stringify(record)}\n`);
  return record.outcome === "answered" ? 0 : 1;
};

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
