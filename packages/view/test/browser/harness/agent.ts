// The agent's side of the session-process target: `@modelcontextprotocol/client` 2.4.0 calls `ask`
// and `collect`, with `wait` too (push delivery), as an agent does (design decision 11), and reads the JSON each result carries in
// its one text block (AD-6). It reads only what the target needs; the conformance suite (task 9.2)
// checks the envelopes in full.

import { Client, type Transport } from "@modelcontextprotocol/client";

export type AskResult = {
  readonly epoch: string;
  readonly askId: string;
  readonly state: string;
  readonly cursor: string;
  readonly board: string;
};

export type CollectedEvent = { readonly type: string } & Readonly<Record<string, unknown>>;

export type CollectedAsk = {
  readonly askId: string;
  readonly state: string;
  readonly cursor: string;
  readonly events: readonly CollectedEvent[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The JSON in a tool result's one text block; fails on an error result, quoting it. */
export const toolJson = (tool: string, result: unknown): unknown => {
  const content = isRecord(result) && Array.isArray(result.content) ? result.content : [];
  const block: unknown = content[0];
  const text = isRecord(block) && block.type === "text" ? block.text : undefined;
  if (typeof text !== "string") throw new Error(`${tool} returned no text block`);
  if (isRecord(result) && result.isError === true) {
    throw new Error(`${tool} returned an error: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${tool} returned no JSON: ${text.slice(0, 200)}`);
  }
};

const strings = <K extends string>(
  what: string,
  value: Record<string, unknown>,
  keys: readonly K[],
): Record<K, string> => {
  const read = {} as Record<K, string>;
  for (const key of keys) {
    const field = value[key];
    if (typeof field !== "string") throw new Error(`${what} has no "${key}"`);
    read[key] = field;
  }
  return read;
};

/** The `ask` result's fields the target uses; `unavailable` fails, naming the reason. */
export const askResultOf = (json: unknown): AskResult => {
  const result = isRecord(json) ? json : {};
  if (result.outcome === "unavailable") {
    throw new Error(
      `ask says no board can be shown (${String(result.reason)}: ${String(result.message)}). ` +
        "The session-process target runs where a board can be shown: not in a container, " +
        "and with BROWSER set, which it does (AD-18).",
    );
  }
  return strings("the ask result", result, ["epoch", "askId", "state", "cursor", "board"]);
};

/** The entry for one ask in a `collect` result. */
export const collectedAskOf = (json: unknown, askId: string): CollectedAsk => {
  const asks = isRecord(json) && Array.isArray(json.asks) ? json.asks : [];
  const entry: unknown = asks.find((item: unknown) => isRecord(item) && item.askId === askId);
  if (!isRecord(entry)) throw new Error(`the collect result has no entry for ${askId}`);
  const what = `the collect result for ${askId}`;
  const fields = strings(what, entry, ["askId", "state", "cursor"]);
  if (!Array.isArray(entry.events)) throw new Error(`${what} has no "events"`);
  return { ...fields, events: entry.events as CollectedEvent[] };
};

/** An MCP client connected to a session process, calling its tools. */
export class Agent {
  readonly #client: Client;

  private constructor(client: Client) {
    this.#client = client;
  }

  /** Connects over the transport: the `initialize` handshake, as Claude Code's client does. */
  static async connect(transport: Transport): Promise<Agent> {
    const client = new Client({ name: "askboard-browser-tests", version: "0.0.0" });
    await client.connect(transport);
    return new Agent(client);
  }

  async ask(input: Readonly<Record<string, unknown>>): Promise<AskResult> {
    const result = await this.#client.callTool({ name: "ask", arguments: { ...input } });
    return askResultOf(toolJson("ask", result));
  }

  /** The agent's `snapshot` (snapshot task 9.1): its result's JSON, the absolute path included. */
  async snapshot(askId: string): Promise<{ readonly path: string; readonly state: string }> {
    const result = await this.#client.callTool({ name: "snapshot", arguments: { askId } });
    const json = toolJson("snapshot", result) as { path?: unknown; state?: unknown };
    if (typeof json.path !== "string" || typeof json.state !== "string") {
      throw new Error(`the snapshot result holds no path and state: ${JSON.stringify(json)}`);
    }
    return { path: json.path, state: json.state };
  }

  /** The agent's `update` (ask-lifecycle): its result's JSON, or a failure quoting the error. */
  async update(askId: string, actions: readonly unknown[]): Promise<unknown> {
    const result = await this.#client.callTool({ name: "update", arguments: { askId, actions } });
    return toolJson("update", result);
  }

  async collect(askId: string, after: string): Promise<CollectedAsk> {
    return collectedAskOf(await this.collectJson(askId, after), askId);
  }

  /** The whole JSON of a `collect` result, for a test that validates it against the schema. */
  async collectJson(askId: string, after: string): Promise<unknown> {
    const result = await this.#client.callTool({
      name: "collect",
      arguments: { asks: [{ askId, after }] },
    });
    return toolJson("collect", result);
  }

  /** The agent's `fetch` of one item (widget-answers): the whole JSON of its result. */
  async fetch(askId: string, itemId: string): Promise<unknown> {
    const result = await this.#client.callTool({ name: "fetch", arguments: { askId, itemId } });
    return toolJson("fetch", result);
  }

  /** Lists the tools: a first request, which starts the session process's local API (AD-2). */
  async listTools(): Promise<readonly string[]> {
    const listed = await this.#client.listTools();
    return listed.tools.map((tool) => tool.name);
  }

  /** `collect` with `wait` on the ask's question: returns when the user answers it. */
  async collectWaiting(askId: string, after: string, itemId: string): Promise<CollectedAsk> {
    const result = await this.#client.callTool({
      name: "collect",
      arguments: { asks: [{ askId, after }], wait: { askId, itemId } },
    });
    return collectedAskOf(toolJson("collect", result), askId);
  }

  /** Closes the connection, which ends the session process's input. */
  close(): Promise<void> {
    return this.#client.close();
  }
}
