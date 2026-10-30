// A test-only board document with markup in every agent string (view spec, "Agent content as
// text"; AD-8). It keeps the plain-choice question's ID and rev, so the transcripts' state
// messages still describe it.

import type { BoardDocument } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";

const [question] = plainChoiceBoardDocument.items;

/** The label the view spec's scenario names. */
export const MARKUP_LABEL = "<img src=x onerror=alert(1)>";

export const markupBoardDocument: BoardDocument = {
  ...plainChoiceBoardDocument,
  title: "<b>Bold title</b>",
  items: [
    {
      ...question,
      props: {
        text: "<script>document.title='owned'</script>Which one?",
        header: "<i>chip</i>",
        options: [
          { label: MARKUP_LABEL, description: "<a href=https://example.com>link</a>" },
          { label: "<!-- comment -->", description: "<style>*{display:none}</style>" },
        ],
      },
    },
  ],
};
