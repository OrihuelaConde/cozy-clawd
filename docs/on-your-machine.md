# What Cozy Clawd does on your machine

Cozy Clawd is a mod: code that runs inside Claude Code with your permissions. This page lists what it reads, keeps, and runs, so you can decide whether to trust it.

## What it doesn't do

- It makes no network requests.
- It reads and writes no files.
- It sets no environment variables.

## What it keeps

The mod keeps three choices in Claude Code's plugin store, so later sessions start with them:

| Key | Value |
| --- | --- |
| `scene` | The scene you chose. |
| `language` | Your language choice in the `/cozy-clawd` panel. |
| `size` | The band's size in a terminal. |

## What it reads and runs to find your language

The mod reads the **Language** setting in `/config` and the `LC_ALL`, `LC_MESSAGES`, and `LANG` environment variables, and the `OS` variable to tell whether it runs on Windows. If none of them names a language the mod speaks, it asks the system:

- On Windows, it runs `reg.exe query` on two values under `HKCU\Control Panel\International`: your preferred languages and your regional format.
- On other systems, it runs `defaults read -g AppleLanguages`.

These are the only commands the mod runs. Besides the language, the mod reads only the **Theme** setting in `/config`, to paint the terminal's band for a light or a dark background. For the order the mod goes by, see [Languages](languages.md#how-the-mod-picks-the-language).

## What it hooks

The mod hooks the following events only to know what to draw, and passes every one of them on unchanged:

- The steps of each turn, and each tool call.
- Requests for your permission and forms that ask you something.
- Compaction of the conversation.
- The start of a session.
- Changes to the **Language** and **Theme** settings in `/config`, so the band follows them.
- Its own commands, `/cozy-clawd` and `/cozy-clawd-scene`, and the focus and presses in its own panel.

It also hooks the telemetry stream that Claude Code keeps for an operator's collector. Claude Code raises no other event when you approve a tool, so this is how Clawd knows to stop waiting. From each record, the mod reads only the event name and the `decision` and `source` fields, and acts only on a `tool_decision` record. It keeps nothing from the stream and sends nothing.

## What it changes

The **Compact** button compacts the conversation only after you select **Yes**.

## Check it yourself

To list what the mod hooks and calls, clone the repository and run the following command from its root:

```bash
claude plugin validate .claude-plugin/plugin.json
```

The command ends with **Validation passed with warnings**. The warning is about `CLAUDE.md` at the plugin root, and it's expected: that file holds notes for working on the mod with Claude Code.
