# As built: `user-keys-writable-by-others`

In code since `user-keys-writable-by-others` (Issue #224): a user configuration file that another user can write (the file or its folder group- or world-writable, owned by another user, or with an owner and mode that cannot be read; the `othersCanWrite` test that already drops `editor`) has its whole `keys` ignored, with one warning, before the key-override check; its other keys apply and every key keeps its default (AD-14, NFR-10).

- **Contract:** the warning code `keys-file-writable-by-others` in `packages/contract/src/schemas/board-protocol/settings.json` (`$defs.warning`, on the user file and the key `keys`; the schema's `else` branch already refuses a rule, action, binding or `with` on it) and in `SettingWarning`'s code union. Board protocol 1.14 (main 1.13 at e799b351, after `palettes`), bound on 2026-11-16.
- **Core:** `keysRule` in `packages/core/src/config/rules.ts` returns the warning for a user file with `othersCanWrite` before `keyOverridesProblems` runs; `WARNINGS` in `config/diagnostics.ts` gives its stderr line, written once at the first read.
- **View:** `isKeysWarning` and `keysWarningText` in `board-page/settings-keys-data.ts` put the warning on the Keys row, after the project's; `settings.warningKeysWritableByOthers` in both string tables. No other row shows it.
- **Help skill:** `configureKeysText` in `tools/build/skills/help-keys.ts` adds the bullet that names `chmod go-w`; `references/configure-keys.md` holds 3,957 of 4,000 characters.
- **Documents:** the spine's AD-14 (one clause), EXPERIENCE.md (The user's keys; Voice and Tone) and DESIGN.md (Settings panel, States).
- **Known effect:** a Linux account with umask 002 creates a group-writable user file, so its keys are ignored until the file is made private, as its `editor` already is; trusting a private group would change `writableByOthers`, which this change does not.
