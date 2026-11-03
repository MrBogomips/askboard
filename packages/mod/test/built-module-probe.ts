// Run as its own process by tools/build/mod.test.ts, so that the built code it loads stays out of
// that run's coverage: it loads the built mod module as the conformance suite's stand-in mod host
// will (an import, an `on` that records registrations, a fake `$`), drives it through a few polls,
// draws its band, and checks the build's standalone validators against the mod's own checks, which run the
// contract's. It prints what it found as one JSON line.
//
// Usage: bun packages/mod/test/built-module-probe.ts <built module> <generated validators>

import { LOCAL_API_VERSION } from "@askboard/contract";
import { fixturePollResponse, fixtureSessionFile } from "@askboard/contract/fixtures";
import { checks } from "../src/validators.ts";
import {
  answerAt,
  entryOf,
  MAIN_ASK,
  pendingOf,
  pollOf,
  runningSession,
  sessionOf,
  writeSessionFile,
} from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

type Built = { readonly register: (on: unknown) => void };
type Check = (value: unknown) => boolean;

const [modulePath = "", validatorsPath = ""] = process.argv.slice(2);
const built = (await import(modulePath)) as Record<string, unknown>;
const generated = (await import(validatorsPath)).checks as Record<string, Check>;

const load = () => {
  const fake = fakeModApi();
  const hooks = fakeOn(fake.api);
  (built as Built).register(hooks.on);
  return { fake, hooks };
};

// Registering touches nothing; the hooks are the session's start and the turns.
const registered = load();
const events = registered.hooks.events();
const reachedAtRegister = registered.fake.calls.reached.length;

// A valid poll's answer is pushed and reported.
const valid = load();
await valid.hooks.sessionStart();
const validApi = runningSession(valid.fake);
validApi.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])], [pendingOf(MAIN_ASK)]));
await valid.fake.tick();
await settle();
const validBand = await valid.hooks.drawBand();

// Another local API major pushes nothing; a session file of another format reaches nothing.
const other = load();
await other.hooks.sessionStart();
const otherApi = runningSession(other.fake);
otherApi.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])], [], { version: "2.0" }));
await other.fake.tick();
await settle();
writeSessionFile(other.fake, { ...sessionOf(other.fake), format: "2.0" });
const before = otherApi.requests.length;
await other.fake.tick();

const cases: readonly (readonly [string, "sessionFile" | "poll" | "ack", unknown])[] = [
  ["the session file", "sessionFile", fixtureSessionFile],
  ["another session file major", "sessionFile", { ...fixtureSessionFile, format: "2.0" }],
  ["a session file with an extra field", "sessionFile", { ...fixtureSessionFile, x: 1 }],
  ["the poll", "poll", fixturePollResponse],
  ["another local API major", "poll", { ...fixturePollResponse, version: "2.0" }],
  ["a poll without its pending list", "poll", { ...fixturePollResponse, pending: undefined }],
  [
    "a title within the limit in code points",
    "poll",
    pollOf([], [pendingOf(MAIN_ASK, { title: "😀".repeat(200) })]),
  ],
  [
    "a title past the limit in code points",
    "poll",
    pollOf([], [pendingOf(MAIN_ASK, { title: "😀".repeat(257) })]),
  ],
  ["an acknowledgement", "ack", { version: LOCAL_API_VERSION }],
  ["an acknowledgement of another major", "ack", { version: "2.0" }],
];

console.log(
  JSON.stringify({
    exports: Object.keys(built),
    events,
    reachedAtRegister,
    validSubmits: valid.fake.calls.submit.length,
    validBand,
    validPaths: validApi.paths(),
    otherSubmits: other.fake.calls.submit.length,
    requestsWithOtherFormat: otherApi.requests.length - before,
    checks: cases.map(([what, name, value]) => ({
      what,
      generated: generated[name]?.(value),
      contract: checks[name](value),
    })),
  }),
);
