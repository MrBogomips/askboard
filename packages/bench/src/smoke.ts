// The smoke check (early-benchmark design decision 4): no model. It starts the selected session
// process from its plugin, asks S1's first question as a scripted MCP client, lets the board
// answerer answer through BROWSER, and collects the answer, so the PO can check the pipeline on
// E1 before any model run.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./agent.ts";
import type { BoardRecord } from "./answerer/board.ts";
import { writeBrowserLauncher } from "./answerer/launcher.ts";
import { cleanEnv } from "./command.ts";
import { pluginDirOf, preflightPlugin, readPluginServer } from "./plugin.ts";
import { redact } from "./redact.ts";
import { answerPlan, CASES } from "./scenarios.ts";
import type { Session } from "./settings.ts";

export type SmokeOptions = {
  readonly session: Session;
  readonly pluginDir?: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  /** How long the waiting collect may take before the check fails. */
  readonly waitMs?: number;
};

const WAIT_MS = 60_000;
const RECORD_WAIT_MS = 5_000;
const ITEM = "database";

const timeout = <T>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([
    promise,
    new Promise<undefined>((settle) => setTimeout(() => settle(undefined), ms)),
  ]);

const recordOf = async (path: string, askId: string): Promise<BoardRecord | undefined> => {
  for (let waited = 0; waited <= RECORD_WAIT_MS; waited += 50) {
    const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean) : [];
    const found = lines
      .map((line) => JSON.parse(line) as BoardRecord)
      .find((record) => record.askId === askId);
    if (found !== undefined) return found;
    await new Promise((settle) => setTimeout(settle, 50));
  }
  return undefined;
};

/** Resolves 0 when the scripted answer came back through `collect`; removes its folder either way. */
export const smoke = async (options: SmokeOptions): Promise<number> => {
  const pluginDir = pluginDirOf(options.session, options.pluginDir);
  preflightPlugin(options.session, pluginDir);
  const dir = mkdtempSync(join(tmpdir(), "askboard-bench-smoke-"));
  try {
    return await check(options, pluginDir, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const check = async (options: SmokeOptions, pluginDir: string, dir: string): Promise<number> => {
  const project = join(dir, "project");
  mkdirSync(project);
  const plan = answerPlan(CASES.S1).slice(0, 1);
  const paths = { plan: join(dir, "plan.json"), records: join(dir, "answerer.jsonl") };
  writeFileSync(paths.plan, JSON.stringify(plan));
  const browser = writeBrowserLauncher(dir, paths);
  const server = readPluginServer(pluginDir, project);
  const session = await startServer({
    ...server,
    env: { ...cleanEnv(options.env), ...server.env, BROWSER: browser },
    cwd: project,
  });
  const askId = `smoke-${randomBytes(3).toString("hex")}`;
  const question = CASES.S1.asks[0]?.question;
  let choice: unknown;
  try {
    options.out(`session process: ${server.command} ${server.args.join(" ")} (${options.session})`);
    const props = { text: question?.text, header: question?.header, options: question?.options };
    const asked = await session.call("ask", {
      askId,
      items: [{ type: "question", id: ITEM, props }],
    });
    const result = asked.isError ? undefined : JSON.parse(asked.text);
    if (result === undefined || result.outcome === "unavailable") {
      options.err(`ask failed: ${redact(asked.text)}`);
      return 1;
    }
    const wait = { askId, itemId: ITEM };
    const collect = session.call("collect", { asks: [{ askId, after: result.cursor }], wait });
    const collected = await timeout(collect, options.waitMs ?? WAIT_MS);
    if (collected === undefined) {
      options.err(`no answer came back within ${(options.waitMs ?? WAIT_MS) / 1_000} s`);
      return 1;
    }
    choice = JSON.parse(collected.text).asks?.[0]?.events?.find(
      (event: { type: string }) => event.type === "answer",
    )?.choice;
  } finally {
    await session.close();
  }
  const record = await recordOf(paths.records, askId);
  const expected = plan[0]?.choice ?? [];
  options.out(`answer: ${Array.isArray(choice) ? choice.join(", ") : "none"}`);
  if (record?.shown !== undefined) {
    options.out(
      `board shown ${record.shown - record.started} ms after the answerer started; answered ${(record.answered ?? record.shown) - record.shown} ms later; outcome ${record.outcome}`,
    );
  } else {
    options.err(
      `the answerer did not see the board: ${record?.outcome ?? "no record"} ${record?.problem ?? ""}`.trim(),
    );
  }
  return JSON.stringify(choice) === JSON.stringify(expected) && record?.shown !== undefined ? 0 : 1;
};
