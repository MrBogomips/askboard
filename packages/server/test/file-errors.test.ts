import { describe, expect, test } from "bun:test";
import { errorCode } from "../src/file-errors.ts";

// The code of a failed file-system call (settings-languages design decision 13), which E8's project
// folders report; E7 brings the helper with them.

describe("a failed call's code", () => {
  test("is the error's code, as Node names it", () => {
    expect(errorCode(Object.assign(new Error("denied"), { code: "EACCES" }))).toBe("EACCES");
  });

  test("is EIO for an error without one, or with one that is not a string", () => {
    expect(errorCode(new Error("lost"))).toBe("EIO");
    expect(errorCode({ code: 13 })).toBe("EIO");
    expect(errorCode(undefined)).toBe("EIO");
  });
});
