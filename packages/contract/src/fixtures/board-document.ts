// The plain-choice board document: the approved example asks/plain-choice.json as ask-core
// accepts it, at rev 1, with the title derived from its question (FR-1).

import { BOARD_DOCUMENT_VERSION, type BoardDocument } from "../schemas/board-document/index.ts";

export const plainChoiceBoardDocument: BoardDocument = {
  version: BOARD_DOCUMENT_VERSION,
  askId: "order-db-choice-x7k2",
  title: "Which database should the order service use?",
  items: [
    {
      type: "question",
      id: "database",
      rev: 1,
      props: {
        text: "Which database should the order service use?",
        header: "Database",
        options: [
          {
            label: "PostgreSQL",
            description: "Relational, already run by the platform team; needs a managed instance.",
          },
          {
            label: "SQLite",
            description: "Embedded file, no server to run; one writer at a time.",
          },
          {
            label: "DynamoDB",
            description: "Managed key-value store that scales without tuning; no joins.",
          },
        ],
      },
    },
  ],
};
