# Changing the keys

The user can replace or remove the keys of an action, in the user configuration file only. The board has no control for it. A change holds only in the Ranking, the widgets the board gives a Keys button, and in no other.

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
  "edit.start": ["F2", "Mod+Alt+Enter"]
}
```

## Writing a combination

- Modifiers, each at most once and in any order: `Mod` (Ctrl on Linux, Cmd on macOS), `Alt` (Option on macOS) and `Shift`, then `+` and the key. At most 32 characters.
- The key is a key name (`ArrowUp`, `Home`, `End`, `Enter`, `Escape`, `Delete`, `Backspace`, `PageUp`, `PageDown`, `F2`), a letter, `Space`, or `?` or `%` alone. `Ctrl`, `Cmd`, `Meta` and `Option` are not modifiers here.
- `Mod+Alt` takes only `Mod+Alt+ArrowUp`, `Mod+Alt+ArrowDown`, `Mod+Alt+Home`, `Mod+Alt+End`, `Mod+Alt+Enter`.
- Refused, because the browser or the system needs them: `Tab`, `F1`, `F3` to `F12`, `Mod` with any key but Z and A, `Mod+Shift` with any key but the arrows up and down and Enter, `Alt` alone (no hold has it), and a modifier on `?` or `%`.
- Refused, because the system needs them: `Alt+Shift` with a letter or `Space` (macOS composes a character from it and some Linux desktops switch the keyboard layout on it).
- An action an editor takes (a text field's actions) refuses a key that types a character: a letter or `Space` with no modifier or `Shift`, and a printed character.
- `keys.open` also refuses, with no modifier or Shift, the keys a control inside a question takes: `Enter`, `Space`, `Escape`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`, `Delete`, `Backspace`; and any key that another action of a widget takes, since it acts across the whole question.
- Two actions of one part of a widget cannot share a key once the changes apply, and an exit cannot be left with no key (`edit.cancel`, `tree.cancelDelete`, `tree.cancelGroup`).
- An action whose keys a control takes by itself (marked in the list) cannot be changed.

## When it applies

- Any problem refuses the whole `keys`: every widget keeps its default keys. The session's stderr lists the problems found at its first read of the file, and Settings those found when a board opens (up to 8). Fix the file; there is no partial change.
- A change applies to the next board opened, not to one already open, and only in the Ranking; the keys panel (the Keys button) shows the keys in effect, with a changed action marked.
