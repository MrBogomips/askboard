// Reloading the board page in a browser test. Playwright's Firefox driver can miss the view frame's
// navigation after a reload: it keeps the frame at `about:blank`, with no document to search, while
// the browser shows the view the board page set as the frame's srcdoc, so no locator reaches the
// view. The test then reloads once more, which the board must survive as well, and says so; any
// other failure fails the test.

/** Whether Playwright lost the view's frame: the srcdoc is set, and it tracks no frame at it. */
export const viewFrameLost = (srcdoc: string | null, trackedUrls: readonly string[]): boolean =>
  srcdoc !== null && !trackedUrls.includes("about:srcdoc");

export const LOST_FRAME_NOTICE =
  "Playwright lost the view's frame on a reload: the board page is reloaded once more";

export type ReloadSteps = {
  /** Reloads the board page. */
  readonly reload: () => Promise<unknown>;
  /** Waits until the view shows what the test needs; fails when it does not. */
  readonly loaded: () => Promise<unknown>;
  /** Whether Playwright lost the view's frame (`viewFrameLost`). */
  readonly frameLost: () => Promise<boolean>;
  /** The error a failed wait becomes, saying what the board page shows. */
  readonly failure: (error: unknown) => Promise<Error>;
  readonly warn: (text: string) => void;
};

/** Reloads and waits for the view; reloads once more if Playwright lost the view's frame. */
export const reloadAndWait = async (steps: ReloadSteps): Promise<void> => {
  await steps.reload();
  try {
    await steps.loaded();
    return;
  } catch (error) {
    if (!(await steps.frameLost())) throw await steps.failure(error);
  }
  steps.warn(LOST_FRAME_NOTICE);
  await steps.reload();
  try {
    await steps.loaded();
  } catch (error) {
    throw await steps.failure(error);
  }
};
