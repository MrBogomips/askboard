// What the input format's schemas cannot say of a question's context items (excerpts, design
// decision 2; proposal B7): an excerpt holds exactly one of `pointer` and `text`, a reference
// exactly one of `pointer` and `url`, and a reference's URL is a web URL (AD-8). Each problem reads
// like a schema error, at the item's field. A pointer is never a request error here: one that does
// not resolve, whatever the reason, is an `unresolved-pointer` warning (FR-8).

import { type Placed, WEB_URL } from "../ask-items.ts";
import {
  expectedAt,
  isRecord,
  problemAt,
  type RequestProblem,
  type Segments,
  type Wording,
} from "../problems.ts";
import { type WebUrlProblem, webUrlProblem } from "./url.ts";

// The two fields of which an item's props hold exactly one, by the item's type.
const ONE_OF: Readonly<Record<string, readonly [string, string, string]>> = {
  excerpt: ["an excerpt", "pointer", "text"],
  reference: ["a reference", "pointer", "url"],
};

const URL_MESSAGES: Readonly<Record<WebUrlProblem, string>> = {
  scheme: "{where}: only http and https URLs are accepted",
  credentials: "{where}: a URL with a user name or password is not accepted; send it without them",
  form: `{where} must be ${WEB_URL}`,
};

// One context item's problems: the one-of rule, then the URL.
const itemProblems = (wording: Wording, value: unknown, { item, at }: Placed) => {
  // An own property only: an inherited name such as `constructor` names no rule.
  const rule =
    typeof item.type === "string" && Object.hasOwn(ONE_OF, item.type)
      ? ONE_OF[item.type]
      : undefined;
  const props = item.props;
  if (rule === undefined || !isRecord(props)) return [];
  const [what, first, second] = rule;
  const problems: RequestProblem[] = [];
  if (Object.hasOwn(props, first) === Object.hasOwn(props, second)) {
    const segments: Segments = [...at, "props"];
    const message = `{where}: ${what} takes exactly one of ${first} and ${second}`;
    problems.push(
      problemAt(wording, value, segments, message, expectedAt(wording, segments, value)),
    );
  }
  const problem = typeof props.url === "string" ? webUrlProblem(props.url) : undefined;
  if (problem !== undefined) {
    const segments: Segments = [...at, "props", "url"];
    const expected = expectedAt(wording, segments, value);
    problems.push(problemAt(wording, value, segments, URL_MESSAGES[problem], expected));
  }
  return problems;
};

/** The context checks over every item of a question's `items` among the placed items. */
export const contextProblems = (
  wording: Wording,
  value: unknown,
  placed: readonly Placed[],
): RequestProblem[] =>
  placed
    .filter(({ inQuestion }) => inQuestion === true)
    .flatMap((entry) => itemProblems(wording, value, entry));
