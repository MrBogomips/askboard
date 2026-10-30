// Diagnostics lines for stderr (Consistency Conventions, Process output): fixed text, an error's
// class and code, never its message, which could carry agent content or a token (AD-11).

const PREFIX = "askboard:";

/** `askboard: <what>: <ErrorClass> (<code>)`, for a failure the session survives. */
export const failure = (what: string, error: unknown): string => {
  if (!(error instanceof Error)) return `${PREFIX} ${what}: ${typeof error}`;
  const code = (error as { code?: unknown }).code;
  const suffix = typeof code === "string" && /^[A-Z0-9_]{1,32}$/.test(code) ? ` (${code})` : "";
  return `${PREFIX} ${what}: ${error.name}${suffix}`;
};

/** `askboard: <text>`, for AskBoard's own fixed text. */
export const note = (text: string): string => `${PREFIX} ${text}`;
