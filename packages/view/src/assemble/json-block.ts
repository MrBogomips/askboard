// A JSON block in the view's page (AD-9, AD-15): the `askboard-data` block the view boots from and,
// in a Snapshot, the `askboard-licences` block after the scripts. Both are read without rendering:
// the text between `id="<id>">` and the next `</script>` is the JSON. Plain ECMAScript only.

/**
 * `<script type="application/json" id="<id>">` holding `value` as JSON with every `<` escaped, so
 * no string in it can end the block or open a tag; `JSON.parse` reads the escape back.
 */
export const jsonBlock = (id: string, value: unknown): string =>
  `<script type="application/json" id="${id}">${JSON.stringify(value).replaceAll("<", "\\u003c")}</script>`;
