// The lifecycle fixtures (ask-lifecycle, design decision 2): one ask of two areas holding five
// questions with FR-3's fields, as the agent sends it and as its board shows it, the board's unsent
// work, an update of every action with its result, a fetch result and a fetch page, and a collect
// result with every event type. Each validates against the full contract; the contract's tests say
// so by name.

import { boardLink } from "../routes.ts";
import {
  BOARD_DOCUMENT_VERSION,
  type BoardArea,
  type LifecycleBoardDocument,
} from "../schemas/board-document/index.ts";
import type { DraftRecord } from "../schemas/board-protocol/index.ts";
import type { AreaItem, LifecycleAskInput, UpdateInput } from "../schemas/input/index.ts";
import {
  type CollectResult,
  type FetchPage,
  type FetchResult,
  RESULT_VERSIONS,
  type UpdateResult,
} from "../schemas/tool-envelopes/index.ts";

/** The lifecycle session: its epoch, ask, port and token, and the ask's board link. */
export const LIFECYCLE = {
  epoch: "k3x9",
  askId: "checkout-plan-p8r3",
  port: 47213,
  token: "Rk7mW2xQp9LsT4vNc8bYdF",
  get link(): string {
    return boardLink(this);
  },
} as const;

const scope: AreaItem = {
  type: "area",
  id: "scope",
  props: {
    title: "Scope",
    items: [
      {
        type: "question",
        id: "region",
        props: {
          text: "Which regions does the first release of the new checkout cover?",
          header: "Regions",
          multiSelect: true,
          options: [
            {
              label: "EU",
              description: "Germany, France, Italy and Spain.",
              annotation: "Two thirds of last quarter's orders came from the EU.",
              recommended: true,
            },
            { label: "US", description: "All states but Alaska and Hawaii." },
            {
              label: "APAC",
              preview: "Japan and Australia only; payment methods differ per country.",
            },
          ],
        },
      },
      {
        type: "question",
        id: "payment",
        props: {
          text: "Which payment provider should the new checkout use?",
          header: "Payments",
          allowOther: true,
          options: [
            { label: "Stripe", preview: "Fees: 1.5% + 0.25 EUR per European card payment." },
            { label: "Adyen", annotation: "The shop team runs it already for refunds." },
          ],
        },
      },
      {
        type: "question",
        id: "analytics",
        props: {
          text: "Which analytics events should the new checkout send?",
          header: "Analytics",
          multiSelect: true,
          options: [
            { label: "Step views" },
            { label: "Payment errors" },
            { label: "Abandoned carts" },
          ],
        },
      },
    ],
  },
};

const delivery: AreaItem = {
  type: "area",
  id: "delivery",
  props: {
    title: "Delivery",
    items: [
      {
        type: "question",
        id: "rollout",
        props: {
          text: "How should the new checkout roll out?",
          header: "Rollout",
          options: [
            { label: "All at once", description: "One release, on a Tuesday morning." },
            {
              label: "Behind a flag",
              description: "10% of sessions first, then everyone within two weeks.",
              recommended: true,
            },
          ],
        },
      },
      {
        type: "question",
        id: "erp-export",
        props: {
          text: "Should orders be exported to the ERP every night?",
          header: "ERP",
          options: [
            { label: "Yes", description: "A nightly batch the finance team reconciles." },
            { label: "No", description: "Finance keeps importing the CSV by hand." },
          ],
        },
      },
    ],
  },
};

/** An ask of two areas, four questions, and every field input format 1.1 adds (FR-2, FR-3). */
export const lifecycleAsk: LifecycleAskInput = {
  askId: LIFECYCLE.askId,
  title: "Checkout redesign plan",
  agentName: "Planner",
  expectedUser: "Sara Conti",
  presentation: "tabs",
  delivery: "submitted",
  items: [scope, delivery],
};

const asBoard = ({ id, props }: AreaItem): BoardArea => ({
  type: "area",
  id,
  props: {
    title: props.title,
    items: props.items.map((question) => ({
      ...question,
      rev: 1,
    })) as unknown as BoardArea["props"]["items"],
  },
});

/** The lifecycle ask as ask-core accepts it: both areas, each question at rev 1. */
export const lifecycleBoardDocument: LifecycleBoardDocument = {
  version: BOARD_DOCUMENT_VERSION,
  askId: LIFECYCLE.askId,
  title: "Checkout redesign plan",
  presentation: "tabs",
  delivery: "submitted",
  items: [asBoard(scope), asBoard(delivery)],
};

/**
 * The board's unsent work in submitted delivery, the payment question in view: two answers held
 * for Submit, one made by "Select recommended", with "Other…" text, an option note, the open
 * prompt's text and a follow-up being written.
 */
export const lifecycleDraftRecord: DraftRecord = {
  delivery: "submitted",
  inView: "payment",
  questions: {
    region: {
      rev: 1,
      values: { region: ["EU"] },
      held: { act: "answer", order: 1, byRecommended: true },
    },
    payment: {
      rev: 1,
      other: "Mollie",
      optionNotes: { Adyen: "Ask the shop team about their contract." },
      note: "Mollie is cheaper for iDEAL payments.",
      composer: "Does the EU",
      held: { act: "answer", order: 2 },
    },
  },
};

const sara = { who: "Sara Conti" } as const;
const versions = RESULT_VERSIONS;
const { epoch, askId } = LIFECYCLE;

/**
 * An update of every action, in an order ask-core can apply once the user has answered "region"
 * and "payment", postponed "erp-export" and written a follow-up on "rollout" (cursor k3x9.4): a
 * question added after the last of its area, an open question reworded, another deleted, an answer
 * reopened, the user's terminal answer to the postponed question recorded, the follow-up answered,
 * and the ask closed.
 */
export const lifecycleUpdate: UpdateInput = {
  askId,
  actions: [
    {
      action: "add",
      item: {
        type: "question",
        id: "launch",
        props: {
          text: "When should the new checkout launch?",
          options: [{ label: "Before Black Friday", recommended: true }, { label: "In January" }],
        },
      },
      parentId: "delivery",
      after: "erp-export",
    },
    {
      action: "change",
      itemId: "rollout",
      props: { text: "How should the new checkout roll out to customers?" },
    },
    { action: "delete", itemId: "analytics" },
    { action: "reopen", itemId: "region" },
    {
      action: "answer",
      itemId: "erp-export",
      answer: { choice: ["Yes"], note: "Sara confirmed it in the terminal." },
    },
    {
      action: "reply",
      itemId: "rollout",
      followUp: "k3x9.4",
      text: "A flag lets us switch back within a minute if payments fail.",
    },
    { action: "close" },
  ],
};

/** What `update` returns for it: each question's new rev, the recorded answer's who and when. */
export const lifecycleUpdateResult: UpdateResult = {
  versions,
  epoch,
  askId,
  state: "closed",
  applied: [
    { action: "add", itemId: "launch", rev: 1 },
    { action: "change", itemId: "rollout", rev: 2 },
    { action: "delete", itemId: "analytics" },
    { action: "reopen", itemId: "region", rev: 2 },
    {
      action: "answer",
      itemId: "erp-export",
      rev: 1,
      recorded: { ...sara, when: "2026-10-31T14:20:03Z" },
    },
    { action: "reply", itemId: "rollout" },
    { action: "close" },
  ],
  unchecked: true,
};

const [region] = scope.props.items;

/** `fetch` of the answered "region" question: its props, state and answer in full (FR-20). */
export const lifecycleFetchResult: FetchResult = {
  versions,
  epoch,
  askId,
  state: "partly-answered",
  item: {
    type: "question",
    id: region.id,
    rev: 1,
    props: region.props,
    state: "answered",
    answer: {
      cursor: "k3x9.1",
      choice: ["EU", "US"],
      optionNotes: { US: "East coast only, at first." },
      ...sara,
      when: "2026-10-31T14:05:12Z",
    },
  },
  unchecked: true,
};

/**
 * The first page of the same item when it does not fit one result: the first 120 characters of its
 * RFC 8785 JSON text, and a continuation naming the item, its rev, the core's generation and the
 * next offset, base64url-encoded (design decision 4).
 */
export const lifecycleFetchPage: FetchPage = {
  versions,
  epoch,
  askId,
  itemId: region.id,
  part: '{"answer":{"choice":["EU","US"],"cursor":"k3x9.1","optionNotes":{"US":"East coast only, at first."},"when":"2026-10-31T1',
  continuation: "eyJpdGVtSWQiOiJyZWdpb24iLCJyZXYiOjEsImdlbmVyYXRpb24iOjMsIm9mZnNldCI6MTIwfQ",
  unchecked: true,
};

const at = (seq: number) => `${epoch}.${seq}`;
const by = (seq: number) => ({
  ...sara,
  when: `2026-10-31T14:${String(seq).padStart(2, "0")}:00Z`,
});

/**
 * A collect result with every event type: the lifecycle ask, partly answered after answers with
 * option notes and "Other…" text, a postpone and its undo, a follow-up, a note alone, an edit choice
 * that kept rev 1 followed by the answer naming it, a revision and a decline; and another ask the
 * board left past the grace period.
 */
export const lifecycleCollectResult: CollectResult = {
  versions,
  epoch,
  asks: [
    {
      askId,
      state: "partly-answered",
      cursor: at(10),
      events: [
        {
          cursor: at(1),
          type: "answer",
          itemId: "region",
          rev: 1,
          ...by(5),
          choice: ["EU", "US"],
          optionNotes: { US: "East coast only, at first." },
        },
        {
          cursor: at(2),
          type: "answer",
          itemId: "payment",
          rev: 1,
          ...by(5),
          other: "Mollie",
          note: "Mollie is cheaper for iDEAL payments.",
        },
        { cursor: at(3), type: "postponed", itemId: "erp-export", rev: 1 },
        {
          cursor: at(4),
          type: "follow-up",
          itemId: "rollout",
          rev: 1,
          ...by(7),
          text: "Why behind a flag?",
        },
        {
          cursor: at(5),
          type: "note",
          itemId: "analytics",
          rev: 1,
          ...by(8),
          note: "Ask the data team which events they already have.",
        },
        { cursor: at(6), type: "reopened", itemId: "erp-export", rev: 1 },
        {
          cursor: at(7),
          type: "edit-choice",
          itemId: "rollout",
          rev: 2,
          edit: "ignore",
          keptRev: 1,
        },
        {
          cursor: at(8),
          type: "answer",
          itemId: "rollout",
          rev: 1,
          ...by(12),
          choice: ["Behind a flag"],
        },
        {
          cursor: at(9),
          type: "answer",
          itemId: "payment",
          rev: 1,
          ...by(13),
          choice: ["Adyen"],
          replaces: at(2),
        },
        {
          cursor: at(10),
          type: "answer",
          itemId: "erp-export",
          rev: 1,
          ...by(14),
          declined: true,
          note: "Finance decides this.",
        },
      ],
      unchecked: true,
    },
    {
      askId: "checkout-copy-m2d5",
      state: "discarded",
      cursor: at(1),
      events: [{ cursor: at(1), type: "discarded", reason: "board-closed" }],
      unchecked: true,
    },
  ],
};
