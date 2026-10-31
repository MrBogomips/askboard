// A session process that misbehaves on purpose, for the smoke check's failure paths:
// --mode error (ask fails), hang (collect never returns), empty (collect returns no answer).
// Its board link points at a port nobody serves.

import { RpcPeer, serveMcp } from "../../src/mcp/jsonrpc.ts";

const mode = process.argv[process.argv.indexOf("--mode") + 1];
const text = (value: unknown, isError = false) => ({
  content: [
    { type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) },
  ],
  ...(isError ? { isError: true } : {}),
});

serveMcp(new RpcPeer(process.stdin, process.stdout), {
  name: "askboard",
  version: "0.0.0-fake",
  tools: [
    { name: "ask", description: "d", inputSchema: { type: "object" } },
    { name: "collect", description: "d", inputSchema: { type: "object" } },
  ],
  call: async (name, args) => {
    const askId = (args as { askId?: string }).askId ?? "x";
    if (name === "ask") {
      if (mode === "error") return text("items: expected one question", true);
      const board = `http://127.0.0.1:1/b/${askId}?t=${"x".repeat(22)}`;
      return text({
        versions: { result: "1.0", output: "1.0" },
        epoch: "fakeepoch",
        askId,
        state: "waiting",
        cursor: "fakeepoch.0",
        board,
      });
    }
    if (mode === "hang") return new Promise(() => undefined);
    return text({
      versions: { result: "1.0", output: "1.0" },
      epoch: "fakeepoch",
      asks: [{ askId, state: "waiting", cursor: "fakeepoch.0", events: [] }],
    });
  },
});
process.stdin.on("end", () => process.exit(0));
