# Changing the keys

The user can replace or remove the keys of an action, in the user configuration file only. A change holds in every widget that has the action. The board has no control for it.

## Where

- The file is `$XDG_CONFIG_HOME/askboard/config.json`, by default `~/.config/askboard/config.json`. The `keys` member sits beside `version` (`"1.1"` in a new file) and the file's other keys, which stay as they are.
- The project file `.askboard/config.json` ignores `keys`, with a warning: an agent can write that file, and an agent never chooses what a key does. Never put `keys` there.
- Write the file only when the user asks you to; otherwise give them the `keys` JSON to paste. Keep `version` and every other key.

## Format

`keys` maps an action to the list of combinations that replace its keys, at most four. An empty list removes the keys: the tool, menu or click of the action stays. The action names are in the key-actions reference.

Move to the top and bottom with Ctrl+Alt (Cmd+Option on macOS), and free Select all:

```json
"keys": {
  "move.top": ["Mod+Alt+ArrowUp"],
  "move.bottom": ["Mod+Alt+ArrowDown"],
  "select.all": []
}
```

Two combinations for one action:

```json
"keys": {
  "edit.start": ["Enter", "F2", "Mod+Shift+Enter"]
}
```

## Writing a combination

- Modifiers, each at most once and in any order: `Mod` (Ctrl on Linux, Cmd on macOS), `Alt` (Option on macOS) and `Shift`, then `+` and the key. At most 32 characters.
- The key is a key name (`ArrowUp`, `Home`, `End`, `Enter`, `Escape`, `Delete`, `Backspace`, `PageUp`, `PageDown`, `F2`), a letter, `Space`, or `?` or `%` alone. `Ctrl`, `Cmd`, `Meta` and `Option` are not modifiers here.
- `Mod+Alt` takes only `Mod+Alt+ArrowUp`, `Mod+Alt+ArrowDown`, `Mod+Alt+Home`, `Mod+Alt+End`, `Mod+Alt+Enter`.
- Refused, because the browser or the system needs them: `Tab`, `F1`, `F3` to `F12`, `Mod` with any key but Z and A, `Mod+Shift` with any key but the arrows up and down and Enter, `Alt` alone (no hold has it), and a modifier on `?` or `%`.
- Two actions of one part of a widget cannot share a key once the changes apply, and an exit cannot be left with no key (`edit.cancel`, and the Tree's `tree.cancelDelete` and `tree.cancelGroup`).
- An action whose keys a control takes by itself (marked in the list) cannot be changed.

## When it applies

- Any problem refuses the whole `keys`: every widget keeps its default keys, Settings shows each problem and the session's stderr lists it. Fix the file; there is no partial change.
- A change applies to the next board opened, not to one already open, and in the widgets with a Keys button; the keys panel shows the keys in effect, with a changed action marked.
