# Changing an ask

`update` changes an open ask by item ID. Its actions run in order, all or none:

{{actions}}

## Adding to a question

- `add` takes a question (into an area by `parentId`) or an area at the top level, never a widget, atom, layout or context item.
- To put one of those in a question, `change` the question's `items`. A `change` replaces each key you send whole, so send `items` whole, with every item you keep, each by its own ID: an item you leave out is removed from the question.
- A question that has an answer cannot be changed or deleted: `reopen` it first.
- To change one widget's, atom's, layout's or molecule reference's props, `change` it by its own ID; a context item only through its question's `items`; an area only its `title`.

{{askExample}}

{{changeExample}}

## Replying to a follow-up

Name the question the follow-up event names in `itemId`, and that event's cursor in `followUp`.

{{replyExample}}
