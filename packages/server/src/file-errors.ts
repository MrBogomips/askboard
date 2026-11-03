// The code of a failed file-system call, as Node names it (`ENOENT`, `EACCES`), for the
// configuration files and the project folders; `EIO` when the error carries none.

export const errorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "EIO";
