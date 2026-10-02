# cozy-clawd

A Claude Code mod that turns the space above the prompt into a cozy pixel-art band. On the left, Clawd acts out what Claude is doing. On the right, a small shelf shows the session's context, prompt cache, and usage limits.

cozy-clawd is an unofficial fan project. It isn't affiliated with or endorsed by Anthropic.

## Features

- **Clawd, animated by state.** Each state of a turn has its own scene, and each family of tools has its own prop:

  | State or tool | Scene |
  | --- | --- |
  | Idle | Clawd sleeps, with z's drifting up. |
  | Working on the answer | Clawd stacks colored blocks. |
  | Thinking | Thought dots rise to a light bulb that switches on. |
  | Writing the answer | Clawd walks in place while lines of text appear. |
  | Reading or searching files | A magnifying glass sweeps over a page. |
  | Editing or writing files | A pencil writes line after line. |
  | Running a command | Clawd types at a monitor with green code raining down. |
  | Searching or fetching the web | A desk globe turns on its stand. |
  | Launching a subagent | A small Clawd runs off while the big one waves. |
  | Waiting for your approval or answer | A ladybug flies past, and Clawd follows it. |
  | Compacting the conversation | Loose sheets are pressed into a golden block. |
  | Any other tool | Clawd hammers away. |

- **A shelf of session figures.** Each figure is an object with its number underneath in a pixel font:
  - A mug of tea shows the context window left. It stops steaming at 25% or less.
  - A candle burns down over the one-hour prompt cache and goes out when the cache expires.
  - A cookie jar shows what's left of the five-hour usage limit.
  - A moon wanes as you use the weekly limit.
- **A compact button.** When 25% or less of the context is free, a **Compactar** button appears next to the shelf. It asks for confirmation before it compacts the conversation.

The band draws in the Code tab of the Claude desktop app. In the terminal, the mod leaves Claude Code's own spinner as it is; the `/clawd` pane shows the current state as text.

## Requirements

- Claude Code 2.1.286 or later, with function hooks (mods) enabled.
- The Claude desktop app, to see the band.

## Install

To load the mod in every session, add the repository folder to the `CLAUDE_CODE_PLUGIN_DIRS` variable in the `env` block of your user settings file, `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\YOUR_USER\\source\\repos\\cozy-clawd"
  }
}
```

Replace the path with the folder where you cloned the repository. To list several folders, separate them with your platform's path-list separator: `;` on Windows, `:` on macOS and Linux.

To try the mod in a single terminal session instead, start Claude Code with the `--plugin-dir` flag:

```bash
claude --plugin-dir PATH_TO_COZY_CLAWD
```

Replace `PATH_TO_COZY_CLAWD` with the folder where you cloned the repository.

## Development

The mod is a Claude Code plugin of function hooks:

| Path | Contents |
| --- | --- |
| `hooks/register.tsx` | The hooks module: Clawd's scenes, how the mod follows the turn, and the band. |
| `hooks/shelf.ts` | The shelf of session figures and its pixel font. |
| `types/index.d.ts` | The contract for the values the mod keeps in the session's state. |
| `hooks/cozy-clawd.test.tsx` | Tests that run against the engine. |
| `tools/preview.mjs` | A script that renders every scene and shelf state to an HTML page. |

To check the mod the way the engine reads it, run the following commands from the repository root:

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

To see every scene and shelf state without running a session, generate the preview page and serve the `.preview` folder:

```bash
node tools/preview.mjs
```

```bash
python -m http.server 8765 --directory .preview
```

Open `http://localhost:8765` in a browser. The page shows each scene at band size and enlarged.

> **Note:** The plugin API for function hooks is in early access and can change between Claude Code releases.
