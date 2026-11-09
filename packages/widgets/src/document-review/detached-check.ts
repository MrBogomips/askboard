// The Document review's field check as its chunk registers it (design decision 8; re-review X-1 of
// 5.11): `{code: "detached", count}` while a held annotation has no place in the document the
// user is shown. It reads and places through the calls the component makes, `readingOfProps` with
// the board's window and the module's `placesOf`, so that the reading and the places are made once
// per item whoever asks first; a wrapped renderer or a list of its own would make them twice. The
// window is read when the check runs, since a chunk's module also loads where there is none.

import { check } from "./model.ts";
import { readingOfProps } from "./reading.ts";

export const detachedCheck = (result: unknown, props: unknown) =>
  check(result, props, (p) => readingOfProps(p, window));
