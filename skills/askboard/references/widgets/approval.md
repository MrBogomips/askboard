# Approval

Use for a verdict on its question's content: approve, approve with changes or reject; put it last in the question it approves.
Item type `approval`: props are an Approval's props, an empty object {}.

## Fields


## Notes

- The reason arrives as the answer's `note`; `approve-with-changes` always has one.
- An answer that edits the question's other items never carries `approve`.

## In the answer

- Result: `results` holds, under the item's ID, an object with:
  - `decision` (required, one of "approve", "approve-with-changes", "reject")

## Example

```json item
{
  "type": "approval",
  "id": "verdict",
  "props": {}
}
```
