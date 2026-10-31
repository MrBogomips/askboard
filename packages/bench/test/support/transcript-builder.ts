// Builds transcripts in the layout the mod delivery spike observed in Claude Code's JSONL files
// (early-benchmark design decision 8): one entry per content block, each repeating its response's
// usage, chained by `parentUuid`; tool results in user entries. The measurement tests and the
// stand-in `claude` write their transcripts with it.

import { randomUUID } from "node:crypto";

export type UsageSpec = {
  readonly input: number;
  readonly cacheCreation?: number;
  readonly cacheRead?: number;
  readonly output: number;
  readonly thinking?: number;
  readonly ttl?: "5m" | "1h";
};

export type Block =
  | { readonly type: "thinking" }
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "tool_use";
      readonly id?: string;
      readonly name: string;
      readonly input: unknown;
    };

export type BuilderOptions = {
  readonly start: number;
  readonly version?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly sessionId?: string;
  readonly agentId?: string;
  /** Leaves `output_tokens_details` out, as a version that does not report thinking would. */
  readonly withoutThinking?: boolean;
};

export class TranscriptBuilder {
  private readonly rows: Record<string, unknown>[] = [];
  private last: string | null = null;
  private clock: number;
  private requests = 0;

  constructor(private readonly options: BuilderOptions) {
    this.clock = options.start;
  }

  private at(at?: number): string {
    this.clock = at ?? this.clock + 100;
    return new Date(this.clock).toISOString();
  }

  private push(row: Record<string, unknown>): string {
    const uuid = randomUUID();
    this.rows.push({
      parentUuid: this.last,
      isSidechain: this.options.agentId !== undefined,
      ...(this.options.agentId === undefined ? {} : { agentId: this.options.agentId }),
      sessionId: this.options.sessionId ?? "session",
      version: this.options.version ?? "2.1.314",
      uuid,
      ...row,
    });
    this.last = uuid;
    return uuid;
  }

  prompt(text: string, at?: number): this {
    this.push({ type: "user", timestamp: this.at(at), message: { role: "user", content: text } });
    return this;
  }

  /** One model response: one entry per block, all with the same usage; returns its tool-use IDs. */
  request(usage: UsageSpec, blocks: readonly Block[], at?: number): string[] {
    this.requests += 1;
    const n = this.requests;
    const ttl = usage.ttl ?? "5m";
    const creation = usage.cacheCreation ?? 0;
    const shared = {
      input_tokens: usage.input,
      cache_creation_input_tokens: creation,
      cache_read_input_tokens: usage.cacheRead ?? 0,
      cache_creation: {
        ephemeral_5m_input_tokens: ttl === "5m" ? creation : 0,
        ephemeral_1h_input_tokens: ttl === "1h" ? creation : 0,
      },
      output_tokens: usage.output,
      ...(this.options.withoutThinking
        ? {}
        : { output_tokens_details: { thinking_tokens: usage.thinking ?? 0 } }),
    };
    const ids: string[] = [];
    blocks.forEach((block, index) => {
      const content =
        block.type === "tool_use"
          ? {
              type: "tool_use",
              id: block.id ?? `toolu_${n}_${index}`,
              name: block.name,
              input: block.input,
            }
          : block.type === "text"
            ? { type: "text", text: block.text }
            : { type: "thinking", thinking: "", signature: "s" };
      if (content.type === "tool_use") ids.push(String(content.id));
      this.push({
        type: "assistant",
        timestamp: this.at(index === 0 ? at : undefined),
        requestId: `req_${n}`,
        ...(this.options.effort === undefined ? {} : { effort: this.options.effort }),
        message: {
          id: `msg_${n}`,
          model: this.options.model ?? "claude-opus-5-5",
          role: "assistant",
          type: "message",
          content: [content],
          usage: shared,
        },
      });
    });
    return ids;
  }

  toolResult(
    toolUseId: string,
    text: string,
    options: { isError?: boolean; at?: number } = {},
  ): this {
    this.push({
      type: "user",
      timestamp: this.at(options.at),
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: [{ type: "text", text }],
            ...(options.isError ? { is_error: true } : {}),
          },
        ],
      },
    });
    return this;
  }

  /** Something Claude Code adds between requests, such as a system reminder. */
  attachment(at?: number): this {
    this.push({ type: "attachment", timestamp: this.at(at), attachment: { type: "reminder" } });
    return this;
  }

  get now(): number {
    return this.clock;
  }

  text(): string {
    return `${this.rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  }
}
