// Board stand-in and client: lists sessions, reads a session's state, appends an answer, reads events.
// Usage: bun driver.ts sessions | state [--key K] | answer <askId> [--text T] [--key K] | events --key K [--after N]
import { api, findSessionFile, readSessionFiles, type SessionFile } from "./lib.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function pickSession(): SessionFile {
  const key = option("key");
  if (key) {
    const { file, candidates } = findSessionFile(key);
    if (!file) throw new Error(`no single session file for key ${key} (${candidates} candidates)`);
    return file;
  }
  const all = readSessionFiles();
  if (all.length !== 1) throw new Error(`${all.length} session files; pass --key`);
  return all[0] as SessionFile;
}

type State = { asks: { askId: string; owner: string | null; createdAt: number }[] };

// auto: answer every new ask --count times, first after --delay ms, then every --interval ms.
// Stops after --idle ms with no session file. Prints one line per answer.
async function auto(): Promise<void> {
  const delay = Number(option("delay") ?? "8000");
  const interval = Number(option("interval") ?? "15000");
  const count = Number(option("count") ?? "1");
  const idle = Number(option("idle") ?? "20000");
  const sent = new Map<string, number>();
  let lastSeen = Date.now();
  for (;;) {
    const sessions = readSessionFiles();
    if (sessions.length > 0) lastSeen = Date.now();
    if (Date.now() - lastSeen > idle) return;
    for (const session of sessions) {
      const state = (await api(session, "GET", "/state").catch(() => ({ asks: [] }))) as State;
      for (const ask of state.asks) {
        const done = sent.get(ask.askId) ?? 0;
        const due = ask.createdAt + delay + done * interval;
        if (done < count && Date.now() >= due) {
          const event = await api(session, "POST", "/answer", { askId: ask.askId, text: `answer ${done + 1}` });
          sent.set(ask.askId, done + 1);
          process.stdout.write(`${JSON.stringify({ session: session.key, ...(event as object) })}\n`);
        }
      }
    }
    await Bun.sleep(500);
  }
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  switch (command) {
    case "sessions":
      print(readSessionFiles().map(({ sessionToken: _, ...rest }) => rest));
      return;
    case "state":
      print(await api(pickSession(), "GET", "/state"));
      return;
    case "answer":
      if (!argument) throw new Error("answer needs an askId");
      print(await api(pickSession(), "POST", "/answer", { askId: argument, text: option("text") }));
      return;
    case "events":
      print(await api(pickSession(), "GET", `/events?after=${option("after") ?? "0"}`));
      return;
    case "delivered":
      print(await api(pickSession(), "POST", "/delivered", JSON.parse(option("body") ?? "{}")));
      return;
    case "auto":
      await auto();
      return;
    default:
      throw new Error(`unknown command ${command ?? "(none)"}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`driver: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
