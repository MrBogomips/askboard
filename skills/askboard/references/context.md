# Context items

Context sits beside a question, in its `items`. Point to project files instead of copying them: a pointer is `path#Heading` or `path#L10-L40`, relative to the project root. Save screenshots under `.askboard/media/` and point to them; image data and image URLs are refused.

## excerpt

Use for a passage of a project file beside the question: a pointer, which AskBoard resolves when the ask is sent, or text you wrote, never both.

- `pointer` (string, 1 to 1024 characters): A project file, relative to the project root, with an optional anchor: `#Heading` or `#L10-L40`. A pointer AskBoard cannot read is a warning, not an error.
- `text` (string, at least 1 character)
- `title` (string, 1 to 256 characters)

```json item
{
  "type": "excerpt",
  "id": "scope-excerpt",
  "props": {
    "pointer": "docs/prd.md#Scope",
    "title": "Scope in the PRD"
  }
}
```

## reference

Use for a file or a web page the user opens in one click: a pointer or an http or https URL, never both.

- `pointer` (string, 1 to 1024 characters): A project file, relative to the project root, with an optional anchor: `#Heading` or `#L10-L40`. A pointer AskBoard cannot read is a warning, not an error.
- `url` (string, 1 to 2048 characters)
- `title` (string, 1 to 256 characters)

```json item
{
  "type": "reference",
  "id": "install-notes",
  "props": {
    "pointer": "README.md#Install",
    "title": "Install notes"
  }
}
```

## image

Use for a screenshot or picture saved as a project file, with the text that describes it.

- `pointer` (required, string, 1 to 1024 characters): A project file, relative to the project root, with an optional anchor: `#Heading` or `#L10-L40`. A pointer AskBoard cannot read is a warning, not an error.
- `alt` (required, string, 1 to 1000 characters)

```json item
{
  "type": "image",
  "id": "checkout-screen",
  "props": {
    "pointer": ".askboard/media/checkout.png",
    "alt": "The checkout page with the error"
  }
}
```
