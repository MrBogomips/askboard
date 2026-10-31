import { describe, expect, test } from "bun:test";
import { lifecycleBoardDocument, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { areaOf, questionsOf } from "./view-document.ts";

describe("the questions of a view document (ask-lifecycle, design decision 6)", () => {
  test("a board without areas holds its questions in board order", () => {
    expect(questionsOf(plainChoiceBoardDocument).map(({ id }) => id)).toEqual(["database"]);
  });

  test("a board of areas holds each area's questions, area by area", () => {
    expect(questionsOf(lifecycleBoardDocument).map(({ id }) => id)).toEqual([
      "region",
      "payment",
      "analytics",
      "rollout",
      "erp-export",
    ]);
  });

  test("a question's area, if the board has areas", () => {
    expect(areaOf(lifecycleBoardDocument, "rollout")?.id).toBe("delivery");
    expect(areaOf(lifecycleBoardDocument, "nothing")).toBeUndefined();
    expect(areaOf(plainChoiceBoardDocument, "database")).toBeUndefined();
  });
});
