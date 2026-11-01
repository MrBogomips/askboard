import { describe, expect, test } from "bun:test";
import {
  closedAskTranscript,
  LIFECYCLE,
  type LifecycleTranscript,
  type LifecycleTranscriptStep,
  lifecycleBoardDocument,
  lifecycleTranscripts,
  restoredDraftTranscript,
  staleSubmitTranscript,
  submitTranscript,
  takeoverDraftTranscript,
  transcripts,
} from "../src/fixtures/index.ts";
import {
  ACTION_ID_PATTERN,
  BOARD_CLOSE_CODES,
  boardLink,
  type LifecycleBoardDocument,
} from "../src/index.ts";
import { draftRecordProblems, validateBoardMessage } from "../src/validate.ts";

// E3's recorded board exchanges (design decision 8, step 4): a submit, a refused stale submit, a
// takeover with the old tab's last draft, a draft restored on connect and a closed ask, kept beside
// E1's `transcripts` so that E1's replays still play E1's alone.
type Step = LifecycleTranscriptStep;

const messageOf = (step: Step | undefined) =>
  step && "message" in step ? step.message : undefined;
const typeOf = (step: Step | undefined) => messageOf(step)?.type;
const kindOf = (step: Step): string => {
  if ("message" in step) return step.message.type;
  if ("invalid" in step) return `invalid ${String(step.invalid.type)}`;
  if ("close" in step) return `close ${step.close}`;
  if ("drop" in step) return "drop";
  return `${step.from} ${step.event}`;
};
const socketsOf = (transcript: LifecycleTranscript) => {
  const sockets = new Map<number, Step[]>();
  for (const step of transcript.steps) {
    if (step.socket === undefined) continue;
    sockets.set(step.socket, [...(sockets.get(step.socket) ?? []), step]);
  }
  return sockets;
};
const lines = (transcript: LifecycleTranscript) =>
  transcript.steps.map((step) => [step.socket, kindOf(step)]);

// Each question of a board document, with its revision.
const questionsOf = (document: LifecycleBoardDocument) =>
  document.items.flatMap((item) => (item.type === "area" ? item.props.items : [item]));

describe("the lifecycle transcripts", () => {
  test("are E3's five exchanges, apart from E1's", () => {
    expect(lifecycleTranscripts).toEqual({
      submit: submitTranscript,
      staleSubmit: staleSubmitTranscript,
      takeoverDraft: takeoverDraftTranscript,
      restoredDraft: restoredDraftTranscript,
      closedAsk: closedAskTranscript,
    });
    for (const name of Object.keys(lifecycleTranscripts))
      expect(transcripts).not.toHaveProperty(name);
    for (const transcript of Object.values(lifecycleTranscripts)) {
      expect(transcript.askId).toBe(LIFECYCLE.askId);
      expect(transcript.token).toBe(LIFECYCLE.token);
    }
    expect(LIFECYCLE.link).toBe(boardLink(LIFECYCLE));
    expect(lifecycleBoardDocument.askId).toBe(LIFECYCLE.askId);
  });
});

describe.each(Object.entries(lifecycleTranscripts))("the %s transcript", (_, transcript) => {
  const { steps } = transcript;
  const sockets = socketsOf(transcript);

  test("every message validates in its direction, and every invalid one fails", () => {
    for (const step of steps) {
      if ("message" in step) {
        const direction = step.from === "page" ? "toHost" : "toPage";
        expect({ step, ok: validateBoardMessage(direction, step.message).ok }).toEqual({
          step,
          ok: true,
        });
      }
      if ("invalid" in step) {
        expect({ step, ok: validateBoardMessage("toHost", step.invalid).ok }).toEqual({
          step,
          ok: false,
        });
      }
    }
  });

  test("each socket opens with connect and its token, then gets the board and the state", () => {
    for (const socketSteps of sockets.values()) {
      const [first, ...rest] = socketSteps;
      expect(messageOf(first)).toMatchObject({ type: "connect", token: transcript.token });
      expect(rest.slice(0, 2).map(kindOf)).toEqual(["board", "state"]);
      const end = socketSteps.findIndex((step) => "close" in step || "drop" in step);
      if (end !== -1) expect(socketSteps.slice(end + 1)).toEqual([]);
    }
  });

  test("a moved socket may still send its last draft, then board-host closes it with 4409", () => {
    for (const socketSteps of sockets.values()) {
      const moved = socketSteps.findIndex((step) => typeOf(step) === "moved");
      if (moved === -1) continue;
      const after = socketSteps.slice(moved + 1).map(kindOf);
      expect([["close 4409"], ["draft", "close 4409"]]).toContainEqual(after);
    }
    for (const step of steps) {
      if ("close" in step) expect(step.close).toBe(BOARD_CLOSE_CODES.moved);
    }
  });

  test("every command has a fresh action ID, and is answered by done or refused, then the state", () => {
    const seen = new Set<string>();
    for (const socketSteps of sockets.values()) {
      socketSteps.forEach((step, at) => {
        const message = messageOf(step);
        if (message?.type !== "act" || step.from !== "page") return;
        expect(message.actionId).toMatch(new RegExp(ACTION_ID_PATTERN));
        expect(seen.has(message.actionId)).toBe(false);
        seen.add(message.actionId);
        const answer = messageOf(socketSteps[at + 1]);
        expect(answer).toMatchObject({ actionId: message.actionId });
        expect(["done", "refused"]).toContain(answer?.type ?? "none");
        expect(typeOf(socketSteps[at + 2])).toBe("state");
      });
    }
  });

  test("every state names each question of the latest board, at its revision", () => {
    for (const socketSteps of sockets.values()) {
      let document: LifecycleBoardDocument | undefined;
      for (const step of socketSteps) {
        const message = messageOf(step);
        if (message?.type === "board") document = message.document as LifecycleBoardDocument;
        if (message?.type !== "state" || document === undefined) continue;
        const named = message.state.questions.map(({ itemId, rev }) => [itemId, rev]);
        expect(named).toEqual(questionsOf(document).map(({ id, rev }) => [id, rev]));
      }
    }
  });

  test("every draft record names questions of the board, as its own properties", () => {
    for (const step of steps) {
      const message = messageOf(step);
      if (message?.type !== "draft") continue;
      expect(draftRecordProblems(message.record, lifecycleBoardDocument)).toEqual([]);
    }
  });
});

describe("each lifecycle exchange", () => {
  test("submit: one command of several acts, acknowledged by done, then the state", () => {
    expect(lines(submitTranscript)).toEqual([
      [1, "connect"],
      [1, "board"],
      [1, "state"],
      [1, "act"],
      [1, "done"],
      [1, "state"],
    ]);
    const command = messageOf(submitTranscript.steps[3]);
    expect(command?.type === "act" && command.acts.map((act) => act.type)).toEqual([
      "answer",
      "answer",
      "postpone",
    ]);
    expect(messageOf(submitTranscript.steps[5])).toMatchObject({
      state: { ask: "partly-answered" },
    });
  });

  test("stale submit: refused naming the action ID, the act's index and its question, then the state", () => {
    expect(lines(staleSubmitTranscript)).toEqual([
      [1, "connect"],
      [1, "board"],
      [1, "state"],
      [undefined, "session update"],
      [1, "board"],
      [1, "state"],
      [1, "act"],
      [1, "refused"],
      [1, "state"],
    ]);
    const command = messageOf(staleSubmitTranscript.steps[6]);
    const refusal = messageOf(staleSubmitTranscript.steps[7]);
    expect(refusal).toMatchObject({ reason: "act", index: 1, itemId: "payment" });
    expect(command?.type === "act" && command.acts[1]).toMatchObject({ itemId: "payment", rev: 1 });
    expect(messageOf(staleSubmitTranscript.steps[4])).toMatchObject({ type: "board" });
    expect(messageOf(staleSubmitTranscript.steps[8])).toEqual(
      messageOf(staleSubmitTranscript.steps[5]),
    );
  });

  test("takeover: the old tab's last draft reaches the new tab", () => {
    const { steps } = takeoverDraftTranscript;
    const takeover = steps.findIndex((step) => step.socket === 2);
    expect(steps.slice(takeover).map((step) => [step.socket, kindOf(step)])).toEqual([
      [2, "connect"],
      [1, "moved"],
      [1, "draft"],
      [1, `close ${BOARD_CLOSE_CODES.moved}`],
      [2, "board"],
      [2, "state"],
      [2, "draft"],
    ]);
    const last = messageOf(steps[takeover + 2]);
    const earlier = steps
      .slice(0, takeover)
      .map(messageOf)
      .filter((message) => message?.type === "draft");
    expect(earlier).toHaveLength(1);
    expect(earlier[0]).not.toEqual(last);
    expect(messageOf(steps.at(-1))).toEqual(last);
  });

  test("restored draft: after a drop, the new socket gets the draft record last mirrored", () => {
    const { steps } = restoredDraftTranscript;
    expect(lines(restoredDraftTranscript)).toEqual([
      [1, "connect"],
      [1, "board"],
      [1, "state"],
      [1, "draft"],
      [1, "drop"],
      [2, "connect"],
      [2, "board"],
      [2, "state"],
      [2, "draft"],
    ]);
    expect(messageOf(steps[8])).toEqual(messageOf(steps[3]));
  });

  test("closed ask: board-host says closed, then refuses an act with reason closed", () => {
    expect(lines(closedAskTranscript)).toEqual([
      [1, "connect"],
      [1, "board"],
      [1, "state"],
      [undefined, "session update"],
      [1, "closed"],
      [1, "act"],
      [1, "refused"],
      [1, "state"],
    ]);
    const update = closedAskTranscript.steps[3];
    expect(update && "request" in update && update.request.actions).toEqual([{ action: "close" }]);
    expect(messageOf(closedAskTranscript.steps[4])).toMatchObject({ reason: "agent" });
    expect(messageOf(closedAskTranscript.steps[6])).toMatchObject({ reason: "closed" });
    expect(messageOf(closedAskTranscript.steps[7])).toMatchObject({ state: { ask: "closed" } });
  });
});
