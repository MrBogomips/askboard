// The follow-up thread (EXPERIENCE.md, Follow-up thread and Unread-reply marker; DESIGN.md, the
// same; ask-lifecycle, task 6.5; FR-10): under the question's actions, collapsed until opened into
// one row, "Follow-up", the message count and "Ask a follow-up". Open, it lists each follow-up with
// the agent's replies under it, each headed by its author and time, and the composer at its foot:
// Enter adds a line, Ctrl+Enter, Cmd+Enter or "Send" sends at once in either delivery mode. The
// composer's text is the lifecycle draft's, so a reload keeps it; whether the thread is open is
// not. A jump to an unread reply opens it and brings the latest reply into view. Every message is
// text (AD-8). A reply is no change to the question and raises no notice.

import { FOLLOW_UP_MAX_CHARS, type ThreadEntry } from "@askboard/contract";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLanguage, useLocale, useStrings } from "../catalog/port.ts";
import type { Store } from "./store.ts";
import { BUTTON_LINK, BUTTON_SECONDARY, TEXT_FIELD } from "./styles.ts";
import { agentAuthor, isSendKey, messageCountOf, messagesLabel, timeOf } from "./thread-text.ts";

/** A request to open a question's thread and show its latest reply, numbered so each runs once. */
export type ThreadRequest = { readonly questionId: string; readonly n: number };

export type ThreadRequests = Store<ThreadRequest | undefined>;

const Message = ({
  author,
  when,
  text,
  agent,
}: {
  readonly author: string;
  readonly when: string;
  readonly text: string;
  readonly agent: boolean;
}) => {
  const locale = useLocale();
  return (
    <li
      data-askboard-message={agent ? "agent" : "user"}
      className={`flex flex-col gap-0.5 border-t border-border px-md py-sm first:border-t-0 ${agent ? "bg-muted" : ""}`}
    >
      <span className="flex items-center gap-sm text-badge">
        <span className="font-semibold text-foreground">{author}</span>
        <time dateTime={when} className="text-muted-foreground">
          {timeOf(when, locale)}
        </time>
      </span>
      <span className="whitespace-pre-wrap text-body text-foreground">{text}</span>
    </li>
  );
};

export type ThreadProps = {
  readonly questionId: string;
  readonly thread: readonly ThreadEntry[] | undefined;
  readonly composer: string;
  /** The composer can be used: the question is visible and the board not locked. */
  readonly usable: boolean;
  /** An opened Snapshot: the messages show, with no composer and no way to ask. */
  readonly readOnly?: boolean;
  /** A follow-up of the composer's is on its way. */
  readonly sending: boolean;
  readonly onComposerChange: (text: string) => void;
  readonly onSend: () => void;
  readonly requests: ThreadRequests;
};

export const Thread = ({
  questionId,
  thread,
  composer,
  usable,
  readOnly = false,
  sending,
  onComposerChange,
  onSend,
  requests,
}: ThreadProps) => {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<"composer" | "toggle" | "latest" | undefined>();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const request = useSyncExternalStore(requests.subscribe, requests.get);
  const handled = useRef(request?.n ?? 0);
  useEffect(() => {
    if (
      request === undefined ||
      request.questionId !== questionId ||
      request.n <= handled.current
    ) {
      return;
    }
    handled.current = request.n;
    setOpen(true);
    setFocus("latest");
  }, [request, questionId]);
  useEffect(() => {
    if (focus === undefined) return;
    setFocus(undefined);
    if (focus === "composer") composerRef.current?.focus();
    else if (focus === "toggle") toggleRef.current?.focus();
    else listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [focus]);
  const count = messageCountOf(thread);
  const text = useStrings();
  const language = useLanguage();
  const id = `${questionId}:thread`;
  const canSend = usable && !sending && composer !== "";
  if (readOnly && count === 0) return null;
  if (!open) {
    return (
      <div className="flex items-center gap-sm rounded-md border border-border px-md py-1.5">
        <span className="text-control font-semibold text-foreground">{text("thread.title")}</span>
        <span className="text-badge text-muted-foreground">{messagesLabel(count, language)}</span>
        <button
          ref={toggleRef}
          type="button"
          className={`${BUTTON_LINK} ml-auto`}
          // A follow-up cannot be asked of a closed ask or a locked board (review F-18).
          disabled={!readOnly && !usable}
          aria-expanded={false}
          aria-controls={id}
          onClick={() => {
            setOpen(true);
            setFocus(readOnly ? "latest" : "composer");
          }}
        >
          {text(readOnly ? "thread.show" : "thread.ask")}
        </button>
      </div>
    );
  }
  return (
    <section
      id={id}
      aria-label={text("thread.title")}
      className="flex flex-col rounded-md border border-border"
    >
      <div className="flex items-center gap-sm border-b border-border px-md py-1.5">
        <span className="text-control font-semibold text-foreground">{text("thread.title")}</span>
        <span className="text-badge text-muted-foreground">{messagesLabel(count, language)}</span>
        <button
          type="button"
          className={`${BUTTON_LINK} ml-auto`}
          aria-expanded={true}
          aria-controls={id}
          onClick={() => {
            setOpen(false);
            setFocus("toggle");
          }}
        >
          {text("thread.collapse")}
        </button>
      </div>
      {count === 0 ? null : (
        <ol ref={listRef} className="flex flex-col">
          {(thread ?? []).flatMap((entry) => [
            <Message
              key={entry.cursor}
              author={entry.who}
              when={entry.when}
              text={entry.text}
              agent={false}
            />,
            ...entry.replies.map((reply, index) => (
              <Message
                // Replies are appended under their follow-up and never reordered.
                // biome-ignore lint/suspicious/noArrayIndexKey: a reply has no ID of its own
                key={`${entry.cursor}:${index}`}
                author={agentAuthor(language)}
                when={reply.when}
                text={reply.text}
                agent
              />
            )),
          ])}
        </ol>
      )}
      {readOnly ? null : (
        <div className="flex items-end gap-sm border-t border-border p-sm">
          <textarea
            ref={composerRef}
            aria-label={text("thread.composer")}
            placeholder={text("thread.composer")}
            value={composer}
            readOnly={!usable || sending}
            maxLength={FOLLOW_UP_MAX_CHARS}
            rows={2}
            onChange={(event) => onComposerChange(event.target.value)}
            onKeyDown={(event) => {
              if (!isSendKey(event)) return;
              event.preventDefault();
              if (canSend) onSend();
            }}
            className={TEXT_FIELD}
          />
          <button type="button" className={BUTTON_SECONDARY} disabled={!canSend} onClick={onSend}>
            {text("thread.send")}
          </button>
        </div>
      )}
    </section>
  );
};
