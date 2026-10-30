import { describe, expect, test } from "bun:test";
import { BOARD_CLOSE_CODES } from "@askboard/contract";
import { plainChoiceBoardDocument, transcripts } from "@askboard/contract/fixtures";
import { validateBoardDocument, validateBoardMessage } from "@askboard/contract/validate";
import { markupBoardDocument } from "../fixtures/markup-document.ts";
import {
  type ReplayStep,
  type ReplayTranscript,
  replayTranscripts,
  withDocument,
} from "./transcripts.ts";

// One line per step, to compare a derived transcript with what it is derived from.
const line = (step: ReplayStep): string => {
  if (step.from === "session") return `session ${step.event}`;
  if (step.from === "user") return `user ${step.event} ${step.choice.join(",")}`;
  if (step.from === "network") return `${step.socket} drop`;
  if ("close" in step) return `${step.socket} host close ${step.close}`;
  if ("invalid" in step) return `${step.socket} page invalid`;
  const message = step.message;
  const detail =
    message.type === "state"
      ? ` ${message.state.ask}${message.state.questions.map((q) => (q.state === "answered" ? ` ${q.answer.receipt}` : "")).join("")}`
      : "";
  return `${step.socket} ${step.from} ${message.type}${detail}`;
};
const lines = (transcript: ReplayTranscript | undefined) => transcript?.steps.map(line) ?? [];

describe("the transcripts the test server replays", () => {
  test("hold Track 0's plain-choice session, restart and resend after a drop unchanged", () => {
    expect(replayTranscripts.plainChoice.steps).toEqual(transcripts.plainChoice?.steps ?? []);
    expect(replayTranscripts.restart.steps).toEqual(transcripts.restart?.steps ?? []);
    expect(replayTranscripts.resendAfterDrop.steps).toEqual(
      transcripts.resendAfterDrop?.steps ?? [],
    );
  });

  test("derive the opening, answered, collected and reload parts of the plain-choice session", () => {
    const opening = ["1 page connect", "1 host board", "1 host state waiting"];
    expect(lines(replayTranscripts.opening)).toEqual(opening);
    const answered = [
      ...opening,
      "user answer PostgreSQL",
      "1 page answer",
      "1 host state answered sent",
    ];
    expect(lines(replayTranscripts.answered)).toEqual(answered);
    const collected = [...answered, "session collected", "1 host receipt"];
    expect(lines(replayTranscripts.collected)).toEqual(collected);
    expect(lines(replayTranscripts.reload)).toEqual([
      ...collected,
      "2 page connect",
      "1 host moved",
      `1 host close ${BOARD_CLOSE_CODES.moved}`,
      "2 host board",
      "2 host state answered delivered",
    ]);
  });

  test("derive the session's end on the first socket of an open board", () => {
    expect(lines(replayTranscripts.sessionEnd)).toEqual([
      "1 page connect",
      "1 host board",
      "1 host state waiting",
      "session exit",
      "1 host discarded",
      `1 host close ${BOARD_CLOSE_CODES.discarded}`,
    ]);
  });

  test("derive a short drop from the resend transcript, without the user's answer", () => {
    expect(lines(replayTranscripts.shortDrop)).toEqual([
      "1 page connect",
      "1 host board",
      "1 host state waiting",
      "1 drop",
      "2 page connect",
      "2 host board",
      "2 host state waiting",
    ]);
  });

  test("derive a restart under an open board, the restart transcript on the next socket", () => {
    expect(lines(replayTranscripts.restartAfterOpen)).toEqual([
      "1 page connect",
      "1 host board",
      "1 host state waiting",
      "session restart",
      "2 page connect",
      "2 host refused",
      `2 host close ${BOARD_CLOSE_CODES.refused}`,
    ]);
  });

  test("hold only messages the board protocol accepts in their direction", () => {
    for (const transcript of Object.values(replayTranscripts)) {
      for (const step of transcript.steps) {
        if (!("message" in step)) continue;
        const direction = step.from === "page" ? "toHost" : "toPage";
        const checked = validateBoardMessage(direction as "toHost", step.message);
        expect(checked.ok ? [] : checked.problems).toEqual([]);
      }
    }
  });
});

describe("withDocument", () => {
  test("puts another board document in every board message, leaving the rest", () => {
    const changed = withDocument(replayTranscripts.reload, markupBoardDocument);
    const boards = changed.steps.flatMap((step) =>
      "message" in step && step.message.type === "board" ? [step.message.document] : [],
    );
    expect(boards).toEqual([markupBoardDocument, markupBoardDocument]);
    expect(lines(changed)).toEqual(lines(replayTranscripts.reload));
    expect(changed.name).toBe("reload with another board document");
  });

  test("the markup document is valid, keeps the question's ID and rev, and holds markup", () => {
    const checked = validateBoardDocument(markupBoardDocument);
    expect(checked.ok ? [] : checked.problems).toEqual([]);
    const [question] = markupBoardDocument.items;
    const [plain] = plainChoiceBoardDocument.items;
    expect([question.id, question.rev]).toEqual([plain.id, plain.rev]);
    const strings = [
      markupBoardDocument.title,
      question.props.text,
      question.props.header ?? "",
      ...question.props.options.flatMap((option) => [option.label, option.description ?? ""]),
    ];
    for (const text of strings) expect(text).toMatch(/<[a-z!/]/);
  });
});
