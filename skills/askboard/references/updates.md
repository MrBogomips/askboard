# Changing an ask

`update` changes an open ask by item ID. Its actions run in order, all or none:

- `add` (required: `item`; optional: `parentId`, `after`): Adds a question, into an area by `parentId` and after the sibling `after` names, or an area at the top level.
- `change` (required: `itemId`, `props`): Changes an item's props by its ID; each key you send replaces its value whole. A question with an answer is reopened first.
- `delete` (required: `itemId`): Removes a question or an area, and everything in it.
- `reopen` (required: `itemId`): Reopens a question that has an answer: a new revision starts.
- `answer` (required: `itemId`, `answer`): Records an answer the user gave you outside the board.
- `reply` (required: `itemId`, `followUp`, `text`): Replies to a follow-up: `itemId` is the question the follow-up event names, `followUp` that event's cursor, as you received it.
- `close` (no fields): Closes the ask.

## Adding to a question

- `add` takes a question (into an area by `parentId`) or an area at the top level, never a widget, atom, layout or context item.
- To put one of those in a question, `change` the question's `items`. A `change` replaces each key you send whole, so send `items` whole, with every item you keep, each by its own ID: an item you leave out is removed from the question.
- A question that has an answer is reopened first.
- To change one item's props, `change` that item by its own ID.

```json ask
{
  "askId": "release-notes-k4m2",
  "items": [
    {
      "type": "question",
      "id": "release",
      "props": {
        "text": "Ship the release on Friday?",
        "items": [
          {
            "type": "toggle",
            "id": "notify",
            "props": {
              "label": "Notify the team"
            }
          }
        ]
      }
    }
  ]
}
```

```json update
{
  "askId": "release-notes-k4m2",
  "actions": [
    {
      "action": "change",
      "itemId": "release",
      "props": {
        "items": [
          {
            "type": "toggle",
            "id": "notify",
            "props": {
              "label": "Notify the team"
            }
          },
          {
            "type": "text-field",
            "id": "reason",
            "props": {
              "label": "Reason"
            }
          }
        ]
      }
    }
  ]
}
```

## Replying to a follow-up

Name the question the follow-up event names in `itemId`, and that event's cursor in `followUp`.

```json update
{
  "askId": "release-notes-k4m2",
  "actions": [
    {
      "action": "reply",
      "itemId": "release",
      "followUp": "k3x9w2q7.4",
      "text": "Friday, once the freeze lifts."
    }
  ]
}
```
