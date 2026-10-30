import { describe, expect, test } from "bun:test";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { linkThrough, parseBoardLink } from "./board-link.ts";

const TOKEN = PLAIN_CHOICE.token;

describe("parseBoardLink", () => {
  test("reads the port, the ask and the token of a link as the ask result gives it", () => {
    expect(parseBoardLink(PLAIN_CHOICE.link)).toEqual({
      port: PLAIN_CHOICE.port,
      askId: PLAIN_CHOICE.askId,
      token: TOKEN,
    });
  });

  test.each([
    ["not a URL", "board", "not a URL"],
    ["https", `https://127.0.0.1:47213/b/a?t=${TOKEN}`, "not http"],
    ["another host", `http://localhost:47213/b/a?t=${TOKEN}`, "host localhost, not 127.0.0.1"],
    ["no port", `http://127.0.0.1/b/a?t=${TOKEN}`, "port none, not in 47200-47299"],
    ["a port outside the range", `http://127.0.0.1:8080/b/a?t=${TOKEN}`, "port 8080"],
    ["another route", `http://127.0.0.1:47213/ws/a?t=${TOKEN}`, "path /ws/a"],
    ["no token", "http://127.0.0.1:47213/b/a", "token none"],
    ["a short token", "http://127.0.0.1:47213/b/a?t=abc", "token abc"],
    ["a second token", `http://127.0.0.1:47213/b/a?t=${TOKEN}&t=${TOKEN}`, "2 tokens"],
    ["a fragment", `http://127.0.0.1:47213/b/a?t=${TOKEN}#x`, "fragment #x"],
  ])("refuses %s, saying why", (_, link, why) => {
    expect(() => parseBoardLink(link)).toThrow(why);
  });
});

describe("linkThrough", () => {
  test("is the same board link on another port of 127.0.0.1", () => {
    const link = parseBoardLink(PLAIN_CHOICE.link);
    expect(linkThrough(link, 51234)).toBe(
      `http://127.0.0.1:51234/b/${PLAIN_CHOICE.askId}?t=${TOKEN}`,
    );
  });
});
