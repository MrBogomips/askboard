// The transcripts the test server replays (design decision 13): Track 0's that the board page can
// provoke, unchanged, and test-only parts of them for scenarios that need only a stretch of a
// session. Each part is made of Track 0's steps, cut or renumbered, never of new messages; only
// `withDocument` puts another board document in, for the view's test-only documents.

import type { BoardDocument } from "@askboard/contract";
import {
  plainChoiceTranscript,
  resendAfterDropTranscript,
  restartTranscript,
  type TranscriptStep,
} from "@askboard/contract/fixtures";

/**
 * A transcript step, or the session process restarting: every socket ends with no close frame and
 * the board's token opens nothing any more. The restart transcript starts after one; this step
 * puts it under an open board.
 */
export type ReplayStep =
  | TranscriptStep
  | { readonly socket?: undefined; readonly from: "session"; readonly event: "restart" };

export type ReplayTranscript = {
  readonly name: string;
  readonly askId: string;
  readonly token: string;
  readonly steps: readonly ReplayStep[];
};

const named = (
  name: string,
  steps: readonly ReplayStep[],
  base = plainChoiceTranscript,
): ReplayTranscript => ({ name, askId: base.askId, token: base.token, steps });

const isHost = (step: ReplayStep, type: string): boolean =>
  step.from === "host" && "message" in step && step.message.type === type;

/** The steps up to and including the first that matches. */
const through = (steps: readonly ReplayStep[], match: (step: ReplayStep) => boolean) => {
  const at = steps.findIndex(match);
  if (at < 0) throw new Error("the transcript has no step to cut at");
  return steps.slice(0, at + 1);
};

const renumbered = (steps: readonly ReplayStep[], socket: (n: number) => number): ReplayStep[] =>
  steps.map((step) =>
    step.socket === undefined ? step : ({ ...step, socket: socket(step.socket) } as ReplayStep),
  );

const plain = plainChoiceTranscript.steps;
const answeredState = (step: ReplayStep) =>
  step.from === "host" &&
  "message" in step &&
  step.message.type === "state" &&
  step.message.state.ask === "answered";
const isExit = (step: ReplayStep) => step.from === "session" && step.event === "exit";

const opening = through(plain, (step) => isHost(step, "state"));
const beforeExit = plain.slice(0, plain.findIndex(isExit));
const fromExit = plain.slice(plain.findIndex(isExit));
// The resend transcript's steps until the second socket's state, without the user's answer.
const shortDrop = through(
  resendAfterDropTranscript.steps,
  (step) => step.socket === 2 && isHost(step, "state"),
).filter((step) => step.from !== "user");

export const replayTranscripts = {
  /** Track 0's plain-choice session: answer, receipt, takeover by a second tab, discard. */
  plainChoice: named("plainChoice", plain),
  /** Track 0's restart: the old token refused on the first socket. */
  restart: named("restart", restartTranscript.steps, restartTranscript),
  /** Track 0's answer queued across a drop and sent once the new socket's state shows it open. */
  resendAfterDrop: named(
    "resendAfterDrop",
    resendAfterDropTranscript.steps,
    resendAfterDropTranscript,
  ),
  /** The board opens: connect, the board document, the state. */
  opening: named("opening", opening),
  /** The opening, then the user's answer and its state with the receipt at "sent". */
  answered: named("answered", through(plain, answeredState)),
  /** Then the agent collects it, and the receipt says "delivered". */
  collected: named(
    "collected",
    through(plain, (step) => isHost(step, "receipt")),
  ),
  /** Then a second socket connects, as after a reload, up to its board document and state. */
  reload: named("reload", beforeExit),
  /** The session ends under the open board of the first socket. */
  sessionEnd: named("sessionEnd", [...opening, ...renumbered(fromExit, () => 1)]),
  /** The connection drops and comes back with the ask still open. */
  shortDrop: named("shortDrop", shortDrop, resendAfterDropTranscript),
  /** The session process restarts under an open board, which reconnects with its old token. */
  restartAfterOpen: named(
    "restartAfterOpen",
    [
      ...opening,
      { from: "session", event: "restart" },
      ...renumbered(restartTranscript.steps, (n) => n + 1),
    ],
    restartTranscript,
  ),
} as const satisfies Readonly<Record<string, ReplayTranscript>>;

/** The transcript with another board document in each of its `board` messages. */
export const withDocument = (
  transcript: ReplayTranscript,
  document: BoardDocument,
): ReplayTranscript => ({
  ...transcript,
  name: `${transcript.name} with another board document`,
  steps: transcript.steps.map((step) =>
    step.from === "host" && "message" in step && step.message.type === "board"
      ? { ...step, message: { ...step.message, document } }
      : step,
  ),
});
