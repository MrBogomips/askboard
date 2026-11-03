// Why a hook or the client did less than asked (AD-19): AskBoard's own fixed text, never the
// session token or agent text, so it can go to stderr as it is (Consistency Conventions, Process
// output).

export class HookFailure extends Error {
  /** The local API's status, when it answered and refused. */
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "HookFailure";
    this.status = status;
  }
}

/**
 * The stderr text of any error: a `HookFailure`'s own message; for anything else only its kind,
 * since its message may quote the input. One line either way.
 */
export const describeFailure = (error: unknown): string => {
  const text =
    error instanceof HookFailure
      ? error.message
      : `failed with ${error instanceof Error ? error.name : typeof error}`;
  return text.replace(/\s*[\r\n]+\s*/g, " ");
};
