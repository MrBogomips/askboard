# LaTeX

Use for one mathematical expression in LaTeX that the user reads and corrects, with a live preview.
Item type `latex`: props are a LaTeX's props {expression}.

## Fields

- `expression` (required, string, 0 to 2000 characters)

## Notes

- The answer's change is one `set` of `<id>.expression`: the whole expression as the user wrote it, which may not parse.
- KaTeX draws it as data: `\href`, `\url` and `\includegraphics` show no link or image.
- The ask is refused for a macro definition (`\def`, `\newcommand`, …), a KaTeX internal command (a name holding `@`), `\show`, `\char` before a backquote, and a nest deeper than 11 levels.

## In the answer

- Edits: `changes` lists what the user changed, one operation for each, naming an element by its ID in `target` (`<item>.<element>` or `<item>.<element>.<field>`). Only what changed is sent; `fetch` returns the whole item.

## Example

```json item
{
  "type": "latex",
  "id": "formula",
  "props": {
    "expression": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
  }
}
```
