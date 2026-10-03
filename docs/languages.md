# Languages

Cozy Clawd speaks the languages the Claude desktop app shows: English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Brazilian Portuguese, and Spanish. The band, the `/cozy-clawd` panel, and the mod's commands use the language.

The command names (`/cozy-clawd`, `/cozy-clawd-scene`) and the scene names that `/cozy-clawd-scene` takes stay the same in every language.

## How the mod picks the language

Claude Code doesn't tell a mod which language the app shows, so by default the mod goes by the first of the following that names a language it speaks:

1. The **Language** setting in `/config`, the language Claude answers in, when you've set it.
2. Your system's locale variables, `LC_ALL`, `LC_MESSAGES`, and `LANG`, where they're set.
3. Your system's language. On Windows, that's the first of your preferred languages, then your regional format, which the mod reads from two values under `HKCU\Control Panel\International` with `reg.exe query`. On other systems, the mod runs `defaults read -g AppleLanguages`, which macOS answers with your preferred languages.
4. English.

The desktop app usually starts without the locale variables, so there the mod goes by your system's language unless you've set the **Language** setting in `/config`.

## Choose the language

To choose the language yourself, open the `/cozy-clawd` panel and select the language by its own name, such as **Español** or **日本語**, next to **Language**. In a terminal, the panel has a **Language** picker instead. Later sessions start with the language you chose.

To go back to the language the mod picks, select **Automatic**. The option names the language the mod detected, such as **Automatic (English)**.

## Hindi in a terminal

In a terminal, the band, the panel, and the commands' replies and menu descriptions speak English when the language is Hindi, and the panel's language picker names Hindi in English. Claude Code lays out Devanagari narrower than a terminal draws it, so a row of Hindi text comes out garbled there. The desktop app shows Hindi throughout.

## Improve a translation

The texts in languages other than English and Spanish are machine translations. To suggest a better one, open an issue, or open a pull request that edits the language's file in `hooks/languages/`. For how the files work, see [Improve a translation](../CONTRIBUTING.md#improve-a-translation).
