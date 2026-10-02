# cozy-clawd

A Claude Code mod (a plugin of function hooks) that draws a pixel-art band above the prompt in the desktop app: Clawd's scenes on the left, a scene of session figures on the right (the shelf, or another the person picks). See `README.md` for what it shows and how it's laid out.

## Working on the mod

- Load the `plugin-authoring` skill before changing a hooks module. Its `claude-code.d.ts` is the API reference for this engine build.
- The mod hot-reloads in every session that loads it from this folder (`CLAUDE_CODE_PLUGIN_DIRS` in the user settings). A change is visible in the band when the turn that made it ends.
- Verify each change with `claude plugin validate .` and `claude plugin test .`, then look at it with `node tools/preview.mjs` and the `preview` launch config. The preview renders scenes the way the desktop does (plain images on the dark background), so a drawing reviewed there matches the band.
- Docs and code comments are in English.

## Gotchas the code doesn't confess

- **A redraw restarts every animation.** The desktop reloads each `Svg` image when the band redraws, even with identical source. The band reads only state that changes on a new mode, a new reading, or the cache's expiry; anything that moves on its own (the candle, the countdown digits) is a CSS animation with a negative delay, never a periodic state write.
- **Plain images only.** `isInteractive` draws the SVG in a sandboxed frame with a white backdrop. CSS `@keyframes` run in plain images.
- **The engine hands a response over in a burst.** Text and tool-call chunks often arrive within milliseconds of each other, so every mode stays on screen at least `MIN_MS`.
- **`$` travels only to top-level functions.** The engine scans the module: a helper that receives `$` is a top-level `function` or a `const` bound to one, never a closure inside `register`.
- **Pixel units.** A sprite pixel is 1 unit wide and 2 tall (`scale(1 2)`), like a terminal quarter-block; props use half-unit heights for square pixels. The figure scenes use square pixels.
- **Plugin options are out of reach in the desktop.** There `$.config.list()` returns only the engine's own rows (seen on 2.1.287), so `$.config.set` can't change a `userConfig` field. The scene choice lives in `$.store` instead.
- **The first click in an unfocused pane only focuses it.** On the desktop, a click on a `Button` in a `Pane` that doesn't hold the keyboard raises `ui.focus` on that Button and no `ui.press` (seen on 2.1.286). The `/clawd` pane picks the scene from that focus move too (`isPaneFocused`).
- **The desktop draws its own busy indicator.** A `ui.render` hook on `Spinner` never ran in the desktop app (seen on 2.1.286), so Clawd lives in the band (`AbovePrompt`) and the `/clawd` pane (`Pane`), which do render there.

## Commits

Commit after the person tests the change and approves it. Pushing is a separate approval.
