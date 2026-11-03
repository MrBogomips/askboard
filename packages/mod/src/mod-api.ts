// The subset of Claude Code's mod API that AskBoard's mod uses (design decision 7), declared here
// from the engine's own declarations (`claude-code`, 2.1.311 to 2.1.314) and the mod delivery
// spike's probe, so that `mod` compiles with ECMAScript libraries alone. Only what the mod calls is
// declared: a submit `asUser` and any variable but the session folder's two are left out, so the
// compiler refuses them (AD-4, AD-5). The pending-asks band (PO decision of 2026-11-03) adds the
// `ui.render` hook on `AbovePrompt`, the elements it draws with, which the mod calls as
// constructors rather than through JSX, and `$.ui.resolve`, `$.ui.invalidate` and
// `$.session.surfaces`. The idle-teammate wake (PO decision of 2026-11-03, G2) adds, from the
// 2.1.317 declarations, `$.session.send`, declared for that wake alone and only with an agent ID as
// its recipient, and the agents' `teammateId` and `name`.

/** The engine interface a hook receives as `$`, reduced to what the mod calls. */
export type ModApi = {
  /** This plugin, as loaded: its manifest name and its directory (the one holding plugin.json). */
  readonly plugin: { readonly name: string; readonly root: string };
  readonly ui: {
    /** One line to the transcript, or with `{ to: "debug" }` to the debug log alone. */
    log(text: string, options?: { readonly to?: "transcript" | "debug" }): void;
    /** Shows `text` for a few seconds under the plugin's name. */
    toast(text: string, options?: { readonly timeoutMs?: number }): void;
    /** Pins `text` as this plugin's status line until the next call; `undefined` removes it. */
    status(text: string | undefined): void;
    /**
     * Re-runs this plugin's `ui.render` hooks, so the band is drawn again; ten a second at most,
     * sooner calls folded.
     */
    invalidate(event: "ui.render"): void;
    /** The element constructors of the surface a `ui.render` input is drawn on. */
    resolve(e: AbovePromptInput): BandElements;
  };
  readonly session: {
    /** The engine's version: `version` as `claude --version` prints it. */
    version(): Promise<SessionVersion>;
    /** Adds a row to the main conversation, or to the running subagent `agentId` names. */
    append(args: SessionAppendArgs): Promise<SessionAppendResult>;
    /**
     * Every surface the session draws on, each once: `terminal` under the REPL first, then the
     * remote ones (`desktop`, `vscode`, `mobile`). Empty in a plain `-p` run; never rejects.
     */
    surfaces(): Promise<readonly string[]>;
    /**
     * Sends a plain-text message to an agent of the session, framed at the receiver as a peer's,
     * attributed to the plugin; resolves once queued in its inbox, which wakes an idle teammate.
     * For an idle in-process teammate alone (G2): auto mode refuses a mod's send (finding D13).
     */
    send(args: SessionSendArgs): Promise<SessionSendResult>;
  };
  readonly prompt: {
    /**
     * Waits until the session is idle, starts a turn with `text`, attributed to the plugin, and
     * resolves when that turn starts; `{ drop }` when it did not enter (after a user interruption,
     * until the user's next input; finding D6).
     */
    submit(args: PromptSubmitArgs): Promise<PromptSubmitResult>;
  };
  readonly agent: {
    /** The session's agents so far, until the engine drops a finished one. */
    list(): Promise<readonly AgentInfo[]>;
  };
  readonly fs: {
    /** A file's text; rejects when it is missing. */
    read(path: string): Promise<string>;
    /** What the path leads to, and whether it is itself a symbolic link; rejects when missing. */
    stat(path: string): Promise<FsStat>;
  };
  readonly clock: {
    /** Milliseconds since the epoch, now. */
    now(): Promise<number>;
    /** Calls `fn` every `ms` milliseconds until `cancel()`; a module reload drops it. */
    every(ms: number, fn: () => void): Timer;
  };
  readonly http: {
    /** Fetches through the host; `socketPath` sends the request over a Unix socket. */
    fetch(url: string, init?: HttpInit): Promise<HttpResponse>;
  };
  readonly process: {
    /** Runs a command by its argument vector, no shell, and resolves once it exits. */
    run(argv: readonly string[], init?: ProcessRunInit): Promise<ProcessRunResult>;
  };
  readonly env: {
    /**
     * A variable of the engine's environment. The name must be a string literal, and the mod reads
     * only the two the session folder depends on: never `CLAUDE_CODE_SESSION_ID`, which holds the
     * launching session's ID when Claude Code runs inside another session (finding O5).
     */
    get(name: "XDG_RUNTIME_DIR" | "TMPDIR"): Promise<string | undefined>;
  };
};

export type SessionVersion = {
  readonly version: string;
  readonly base?: string;
  readonly builtAt?: string;
};

/** A text block, the only content a mod's appended row may carry. */
export type TextBlock = { readonly type: "text"; readonly text: string };

export type SessionAppendArgs = {
  /** A user-role row the person does not see as typed; the model reads it at its next request. */
  readonly message: { readonly type: "user"; readonly content: readonly TextBlock[] };
  /** The running subagent whose conversation the row joins; absent for the main conversation. */
  readonly agentId?: string;
};

export type SessionAppendResult =
  | { readonly uuid: string; readonly deny?: undefined }
  | { readonly deny: string; readonly uuid?: undefined };

/** A message to an agent: `session.send`'s input as the mod gives it. */
export type SessionSendArgs = {
  /**
   * The recipient, by the agent ID `$.agent.list()` lists; the engine takes a name, an address or
   * a session ID too, which the mod never uses.
   */
  readonly to: { readonly agentId: string };
  /** The message's text, non-empty. */
  readonly text: string;
};

/**
 * Whether the message was delivered: queued in the recipient's inbox, never read yet. When not,
 * `reason` says why, as the SendMessage tool words it.
 */
export type SessionSendResult =
  | { readonly isDelivered: true; readonly reason?: undefined }
  | { readonly isDelivered: false; readonly reason: string };

/** The prompt's text alone: the mod never submits as the user (AD-4). */
export type PromptSubmitArgs = { readonly text: string };

export type PromptSubmitResult =
  | { readonly text: string; readonly drop?: undefined }
  | { readonly drop: string; readonly text?: undefined };

export type AgentStatus =
  | "pending"
  | "running"
  | "waiting"
  | "idle"
  | "completed"
  | "failed"
  | "killed";

export type AgentInfo = {
  /** The agent's one ID: a hook's `agent_id`, a turn event's `agentId`. */
  readonly id: string;
  /** A teammate's address in its team, `<name>@<team>`; absent for any other agent. */
  readonly teammateId?: string;
  /** What SendMessage addresses it by, when it has one: a teammate's name in its team. */
  readonly name?: string;
  readonly type: string;
  readonly description: string;
  /** Where its loop stands: a teammate that waits for a message is `idle`, not `running`. */
  readonly status: AgentStatus;
};

export type FsStat = {
  /** What the path leads to, a link followed. */
  readonly kind: "file" | "dir" | "other";
  readonly size: number;
  readonly mtimeMs: number;
  /** Whether the path itself is a symbolic link. */
  readonly isLink: boolean;
};

export type Timer = { cancel(): void };

export type HttpInit = {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** The absolute path of a Unix socket the request goes over instead of TCP. */
  readonly socketPath?: string;
};

export type HttpResponse = {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: string;
};

export type ProcessRunInit = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly stdin?: string;
  /** 30 s when absent. */
  readonly timeoutMs?: number;
};

export type ProcessRunResult = {
  /** A child ended by a signal reads as 1. */
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type SessionStartInput = {
  readonly cwd: string;
  readonly isInteractive: boolean;
};
export type SessionStartResult = { readonly cwd: string };

export type TurnStartInput = {
  readonly text: string;
  readonly turnId: string;
  /** A subagent's ID; absent on the main conversation. */
  readonly agentId?: string;
};
export type TurnStartResult = { readonly turnId: string };

/** One model request of a turn. */
export type TurnStepInput = {
  readonly turnId: string;
  /** The step's position in the turn, from 0. */
  readonly index: number;
  readonly agentId?: string;
};
/** A piece of the response streaming through `turn.step`; the mod forwards it unread. */
export type TurnStepChunk = unknown;
export type TurnStepResult = unknown;

export type TurnCompleteInput = {
  readonly turnId: string;
  readonly agentId?: string;
  /** True when the user interrupted the turn. */
  readonly isAborted: boolean;
};
export type TurnCompleteResult = { readonly text: string };

declare const ELEMENT: unique symbol;

/** A drawn element, as a constructor returns it: the mod never looks inside one. */
export type RenderElement = { readonly [ELEMENT]: true };

export type RenderChildren = RenderElement | string | undefined | readonly RenderChildren[];

type Children = { readonly children?: RenderChildren };

/** The elements the band draws with, each a constructor from its props, children included. */
export type BandElements = {
  readonly Box: (props: { readonly flexDirection?: "row" | "column" } & Children) => RenderElement;
  readonly Text: (
    props: {
      /** A theme key, a colour name such as `cyan`, or a hex colour. */
      readonly color?: string;
      readonly dimColor?: boolean;
      readonly wrap?: "truncate-end";
    } & Children,
  ) => RenderElement;
  /**
   * A link, inline in a Text: its label is its text; with none, its address. The mod gives it no
   * children: a Text child draws its text and then the address.
   */
  readonly Link: (props: { readonly href: string; readonly label: string }) => RenderElement;
};

/** The band above the prompt as a `ui.render` hook receives it; raised on terminal and desktop. */
export type AbovePromptInput = {
  /** Where the tree is drawn: `terminal` or `desktop`. */
  readonly surface: string;
  readonly component: "AbovePrompt";
  readonly requestId: string;
  readonly props: {
    /** True while a survey holds the band; a hook yields to it. */
    readonly hasSurvey: boolean;
    /** True while a model turn is running. */
    readonly isWorking: boolean;
    /** Rows the band may take; a taller tree scrolls. */
    readonly maxRows: number;
    /** Cells the band's tree is laid out in. */
    readonly bodyColumns: number;
  };
};

type Hook<E, R> = (api: ModApi, e: E, next: (e: E) => Promise<R>) => Promise<R>;

/** The band's hook: draws a tree, or passes with `next(e)`, what the plugins beneath draw. */
export type AbovePromptHook = Hook<AbovePromptInput, RenderElement>;

/** A hook on a streaming event: an async generator that forwards `next(e)`'s stream. */
type StreamHook<E, C, R> = (
  api: ModApi,
  e: E,
  next: (e: E) => AsyncGenerator<C, R>,
) => AsyncGenerator<C, R>;

/** The events the mod hooks, with their hooks' shapes. */
export type ModHooks = {
  readonly "session.start": Hook<SessionStartInput, SessionStartResult>;
  readonly "turn.start": Hook<TurnStartInput, TurnStartResult>;
  readonly "turn.step": StreamHook<TurnStepInput, TurnStepChunk, TurnStepResult>;
  readonly "turn.complete": Hook<TurnCompleteInput, TurnCompleteResult>;
};

/** `on(event, hook)`, and `on("ui.render", matcher, hook)`, as the engine passes it to `register`. */
export type On = {
  <N extends keyof ModHooks>(event: N, hook: ModHooks[N]): unknown;
  (
    event: "ui.render",
    matcher: { readonly component: "AbovePrompt" },
    hook: AbovePromptHook,
  ): unknown;
};
