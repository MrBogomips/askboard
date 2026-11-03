import { describe, expect, test } from "bun:test";
import {
  boardProtocolExamples,
  contextProtocolExamples,
  duplicateAnswerTranscript,
  fixtureViewFiles,
  fixtureViewManifest,
  lifecycleProtocolExamples,
  notConnectFirstTranscript,
  PLAIN_CHOICE,
  plainChoiceBoardDocument,
  plainChoiceTranscript,
  resendAfterDropTranscript,
  restartTranscript,
  schemaRefusalTranscript,
  type Transcript,
  type TranscriptStep,
  transcripts,
  versionRefusalTranscript,
} from "../src/fixtures/index.ts";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_MESSAGES,
  BOARD_PROTOCOL_VERSION,
  boardLink,
  type ManifestFile,
  VIEW_MANIFEST_FILE,
} from "../src/index.ts";
import {
  validateBoardDocument,
  validateBoardMessage,
  validateViewManifest,
} from "../src/validate.ts";

const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const typeOf = (step: TranscriptStep | undefined) =>
  step && "message" in step ? step.message.type : undefined;
// One word per step: the message's type, or what else happens.
const kindOf = (step: TranscriptStep): string => {
  if ("message" in step) return step.message.type;
  if ("invalid" in step) return `invalid ${String(step.invalid.type)}`;
  if ("close" in step) return `close ${step.close}`;
  if ("drop" in step) return "drop";
  return `${step.from} ${step.event}`;
};
const socketsOf = (transcript: Transcript) => {
  const sockets = new Map<number, { step: TranscriptStep; at: number }[]>();
  transcript.steps.forEach((step, at) => {
    if (step.socket === undefined) return;
    sockets.set(step.socket, [...(sockets.get(step.socket) ?? []), { step, at }]);
  });
  return sockets;
};
const CLOSE_AFTER: Readonly<Record<string, number>> = {
  refused: BOARD_CLOSE_CODES.refused,
  moved: BOARD_CLOSE_CODES.moved,
  discarded: BOARD_CLOSE_CODES.discarded,
};

describe("the plain-choice session", () => {
  test("its link is the approved example's, and its board document validates", () => {
    expect(PLAIN_CHOICE.link).toBe(boardLink(PLAIN_CHOICE));
    expect(PLAIN_CHOICE.link).toBe(
      "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A",
    );
    expect(validateBoardDocument(plainChoiceBoardDocument).ok).toBe(true);
    expect(plainChoiceBoardDocument.askId).toBe(PLAIN_CHOICE.askId);
  });
});

describe("the transcripts", () => {
  test("are the plain-choice session, its error paths and its resend paths", () => {
    expect(transcripts).toEqual({
      plainChoice: plainChoiceTranscript,
      restart: restartTranscript,
      duplicateAnswer: duplicateAnswerTranscript,
      resendAfterDrop: resendAfterDropTranscript,
      schemaRefusal: schemaRefusalTranscript,
      versionRefusal: versionRefusalTranscript,
      notConnectFirst: notConnectFirstTranscript,
    });
    for (const transcript of Object.values(transcripts)) {
      expect(transcript.askId).toBe(PLAIN_CHOICE.askId);
      expect(transcript.token).toBe(PLAIN_CHOICE.token);
    }
  });
});

describe.each(Object.entries(transcripts))("the %s transcript", (_name, transcript: Transcript) => {
  const { steps } = transcript;
  const sockets = socketsOf(transcript);
  // A socket is accepted when board-host answers its first message with the board document.
  const accepted = (socket: number) => typeOf(sockets.get(socket)?.[1]?.step) === "board";

  test("every message validates in its direction, and every invalid one fails", () => {
    for (const step of steps) {
      if ("message" in step) {
        const direction = step.from === "page" ? "toHost" : "toPage";
        const ok = validateBoardMessage(direction, step.message).ok;
        expect({ step, ok }).toEqual({ step, ok: true });
      }
      if ("invalid" in step) {
        const ok = validateBoardMessage("toHost", step.invalid).ok;
        expect({ step, ok }).toEqual({ step, ok: false });
      }
    }
  });

  test("each socket opens with the page's first message, and nothing reaches it once it ends", () => {
    for (const socketSteps of sockets.values()) {
      expect(socketSteps[0]?.step.from).toBe("page");
      const end = socketSteps.findIndex(({ step }) => "close" in step || "drop" in step);
      if (end !== -1) expect(socketSteps.slice(end + 1)).toEqual([]);
    }
  });

  test("a socket gets the board and state after connect with the token, or a refusal and a close", () => {
    for (const [socket, socketSteps] of sockets) {
      const [first, ...rest] = socketSteps.map(({ step }) => step);
      const kinds = rest.map(kindOf);
      if (accepted(socket)) {
        expect(first).toEqual({
          socket,
          from: "page",
          message: { version: BOARD_PROTOCOL_VERSION, type: "connect", token: transcript.token },
        });
        expect(kinds.slice(0, 2)).toEqual(["board", "state"]);
      } else {
        expect(kinds).toEqual(["refused", `close ${BOARD_CLOSE_CODES.refused}`]);
      }
    }
  });

  test("board-host closes right after moved, discarded and a refusal before connect, and only then", () => {
    steps.forEach((step, at) => {
      const { socket } = step;
      if (socket === undefined) return;
      const next = steps[at + 1];
      const type = typeOf(step);
      const closes =
        type === "moved" || type === "discarded" || (type === "refused" && !accepted(socket));
      if (closes) {
        expect({ at, next }).toEqual({
          at,
          next: { socket, from: "host", close: CLOSE_AFTER[type] as never },
        });
      }
      if ("close" in step) {
        const before = steps[at - 1];
        expect(before?.socket).toBe(socket);
        expect(step.close).toBe(CLOSE_AFTER[typeOf(before) ?? ""] as never);
        // Once connect is accepted, a refusal leaves the socket open.
        if (typeOf(before) === "refused") expect(accepted(socket)).toBe(false);
      }
    });
  });

  test("an answer refusal names its item and is followed by the question's state", () => {
    for (const [, socketSteps] of sockets) {
      socketSteps.forEach(({ step }, index) => {
        if (!("message" in step) || step.message.type !== "refused") return;
        if (step.message.reason !== "answer") return;
        expect(step.message.itemId).toBe(plainChoiceBoardDocument.items[0].id);
        expect(typeOf(socketSteps[index + 1]?.step)).toBe("state");
      });
    }
  });

  test("every answer names an option of the question at its revision", () => {
    const [question] = plainChoiceBoardDocument.items;
    const labels = question.props.options.map((option) => option.label);
    for (const step of steps) {
      if (!("message" in step) || step.message.type !== "answer") continue;
      expect(step.message.itemId).toBe(question.id);
      expect(step.message.rev).toBe(question.rev);
      expect(step.message.choice.every((label) => labels.includes(label))).toBe(true);
    }
  });

  test("the user's answer comes before the answer command that carries it", () => {
    steps.forEach((step, at) => {
      if (step.from !== "user") return;
      const sent = steps.slice(at + 1).find((later) => typeOf(later) === "answer");
      expect(sent && "message" in sent && sent.message).toMatchObject({ choice: step.choice });
    });
  });
});

describe("the plain-choice transcript", () => {
  const { steps } = plainChoiceTranscript;
  const types: (string | undefined)[] = steps.map(typeOf);

  test("covers connect, the board document, answer, receipt, a takeover and the discard", () => {
    for (const type of ["connect", "board", "state", "answer", "receipt", "moved", "discarded"]) {
      expect(types).toContain(type);
    }
  });

  test("every board message carries the plain-choice board document", () => {
    for (const step of steps) {
      if ("message" in step && step.message.type === "board") {
        expect(step.message.document).toEqual(plainChoiceBoardDocument);
      }
    }
  });

  test("the receipt follows the agent's collect, and the discard the session's exit", () => {
    const at = (match: (step: TranscriptStep) => boolean) => steps.findIndex(match);
    const collected = at((step) => step.from === "session" && step.event === "collected");
    const exit = at((step) => step.from === "session" && step.event === "exit");
    expect(collected).toBeGreaterThan(-1);
    expect(at((step) => typeOf(step) === "receipt")).toBe(collected + 1);
    expect(at((step) => typeOf(step) === "discarded")).toBe(exit + 1);
  });

  test("a takeover moves the older socket and closes it before the newer one gets the board", () => {
    const takeover = steps.findIndex((step) => step.socket === 2);
    expect(steps.slice(takeover, takeover + 5).map((step) => [step.socket, kindOf(step)])).toEqual([
      [2, "connect"],
      [1, "moved"],
      [1, "close 4409"],
      [2, "board"],
      [2, "state"],
    ]);
  });
});

describe("the error and resend transcripts", () => {
  test("restart: a token the session process does not know is refused and the socket closed", () => {
    expect(restartTranscript.steps.map(kindOf)).toEqual(["connect", "refused", "close 4403"]);
    expect(restartTranscript.steps[1]).toMatchObject({ message: { reason: "token" } });
  });

  test("duplicate answer: the second is refused, and the state still holds the first", () => {
    const { steps } = duplicateAnswerTranscript;
    expect(steps.map(kindOf)).toEqual([
      "connect",
      "board",
      "state",
      "user answer",
      "answer",
      "state",
      "answer",
      "refused",
      "state",
    ]);
    expect(steps[6]).toEqual(steps[4] as never);
    expect(steps[7]).toMatchObject({ message: { reason: "answer", itemId: "database" } });
    expect(steps[8]).toEqual(steps[5] as never);
    expect(steps[5]).toMatchObject({ message: { state: { ask: "answered" } } });
  });

  test("resend after a drop: the queued answer goes once, after the new socket's state", () => {
    const { steps } = resendAfterDropTranscript;
    expect(steps.map((step) => [step.socket, kindOf(step)])).toEqual([
      [1, "connect"],
      [1, "board"],
      [1, "state"],
      [1, "drop"],
      [undefined, "user answer"],
      [2, "connect"],
      [2, "board"],
      [2, "state"],
      [2, "answer"],
      [2, "state"],
    ]);
    expect(steps[7]).toMatchObject({ message: { state: { ask: "waiting" } } });
    expect(steps[9]).toMatchObject({ message: { state: { ask: "answered" } } });
  });

  test("schema refusal: each message outside the schema is refused and the socket stays open", () => {
    const { steps } = schemaRefusalTranscript;
    expect(steps.map(kindOf)).toEqual([
      "connect",
      "board",
      "state",
      "invalid telemetry",
      "refused",
      "invalid answer",
      "refused",
    ]);
    for (const at of [4, 6]) expect(steps[at]).toMatchObject({ message: { reason: "message" } });
  });

  test("version refusal: a major-2 connect is refused, naming version 1, and closed", () => {
    const { steps } = versionRefusalTranscript;
    expect(steps.map(kindOf)).toEqual(["invalid connect", "refused", "close 4403"]);
    expect(steps[0]).toMatchObject({ invalid: { version: "2.0" } });
    const refusal = steps[1] && "message" in steps[1] ? steps[1].message : undefined;
    expect(refusal).toMatchObject({ reason: "version" });
    expect(refusal && "detail" in refusal ? refusal.detail : "").toContain("supports version 1");
  });

  test("not connect first: a socket that opens with an answer is refused as a token and closed", () => {
    const { steps } = notConnectFirstTranscript;
    expect(steps.map(kindOf)).toEqual(["answer", "refused", "close 4403"]);
    expect(steps[1]).toMatchObject({ message: { reason: "token" } });
  });
});

describe("board-protocol examples", () => {
  test("one valid example of every message type, in each direction: E1's, then 1.1's, then 1.2's", () => {
    for (const direction of ["toHost", "toPage"] as const) {
      const examples: readonly object[] = [
        ...boardProtocolExamples[direction],
        ...lifecycleProtocolExamples[direction],
        // The reading panel's and the editor's messages (excerpts, design decision 5).
        ...contextProtocolExamples[direction],
      ];
      const types = examples.map((message) => (message as { type: string }).type);
      for (const type of Object.keys(BOARD_PROTOCOL_MESSAGES[direction])) {
        expect(types).toContain(type);
      }
      for (const message of examples) {
        expect({ message, ok: validateBoardMessage(direction, message).ok }).toEqual({
          message,
          ok: true,
        });
      }
    }
  });
});

describe("the fixture view build", () => {
  const files = fixtureViewFiles;
  const listed: ManifestFile[] = [
    fixtureViewManifest.boardPage.html,
    fixtureViewManifest.boardPage.script,
    ...fixtureViewManifest.boardPage.styles,
    ...Object.values(fixtureViewManifest.chunks).flatMap((chunk) => [
      chunk.script,
      ...chunk.styles,
    ]),
  ];

  test("the manifest validates and is the folder's manifest file", () => {
    expect(validateViewManifest(fixtureViewManifest)).toEqual({
      ok: true,
      value: fixtureViewManifest,
    });
    expect(JSON.parse(files[VIEW_MANIFEST_FILE] ?? "")).toEqual(fixtureViewManifest);
  });

  test("every file it lists is in the folder with its hash and size", () => {
    for (const file of listed) {
      const text = files[file.path];
      expect({ path: file.path, sha256: text && sha256(text) }).toEqual({
        path: file.path,
        sha256: file.sha256,
      });
      expect(new TextEncoder().encode(text).length).toBe(file.bytes);
    }
    const notices = [
      ...fixtureViewManifest.boardPage.licences,
      ...Object.values(fixtureViewManifest.chunks).flatMap((chunk) => chunk.licences),
    ];
    expect(notices.length).toBeGreaterThan(0);
    for (const notice of notices) expect(files[notice.path]).toContain(notice.licence);
  });

  test("the board page's HTML holds its script and styles inline, verbatim", () => {
    const { html, script, styles } = fixtureViewManifest.boardPage;
    const page = files[html.path] ?? "";
    expect(page).toContain(`<script>${files[script.path]}</script>`);
    for (const style of styles) expect(page).toContain(`<style>${files[style.path]}</style>`);
  });

  test("it has E1's chunks: the shell, the Choice component and their libraries", () => {
    const { chunks } = fixtureViewManifest;
    expect(Object.keys(chunks).sort()).toEqual(["choice", "ext-apps", "radix", "react", "shell"]);
    expect(chunks.choice?.components).toEqual(["choice"]);
    expect(chunks.choice?.needs).toEqual(["react", "radix"]);
  });
});
