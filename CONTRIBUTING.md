# Contribute to Cozy Clawd

Cozy Clawd is a Claude Code plugin of function hooks: a module that Claude Code loads, which follows each turn and draws the band and the `/cozy-clawd` panel with the engine's UI elements. This page covers how the repository is laid out, how to load and check your copy, and what a drawing needs to look the same in the desktop app and in a terminal.

> **Note:** The plugin API for function hooks can change between Claude Code releases.

The engine has quirks the code relies on: for example, a redraw restarts every animation, and a terminal can't draw SVG. They're listed in [Gotchas the code doesn't confess](CLAUDE.md#gotchas-the-code-doesnt-confess) in `CLAUDE.md`, which Claude Code reads when you work on the mod with it. Read them before you change how the band draws or follows a turn.

In the code, the scenes that draw the four meters on the right of the band are *meter scenes*.

## Find your way around

| Path | Contents |
| --- | --- |
| `hooks/hooks.json` | The hooks modules the plugin loads. |
| `hooks/register.tsx` | The hooks module: Clawd's scenes, how the mod follows the turn, the band, the `/cozy-clawd` panel, and the order the mod goes by to find your language. |
| `hooks/small.ts` | Clawd's scenes in the terminal's small size. |
| `hooks/raster.ts` | How the terminal paints the scenes: a reader of the SVG and CSS they're drawn with that paints any moment of their animations in block characters, two or four pixels to a cell. Also how many columns a text takes there. |
| `hooks/language.ts` | The languages the mod speaks, and how a setting's value names one. |
| `hooks/languages/` | The mod's texts, one file per language. `en.ts` sets the texts every language has. |
| `hooks/scenes/index.ts` | The meter scenes, in the order the panel offers them, and the meters in words. |
| `hooks/scenes/pixels.ts` | What the meter scenes share: their layout, the pixel font of the numbers, the cache's countdown, and the refill while compacting. |
| `hooks/scenes/NAME.ts` | One file per meter scene, named after it, such as `shelf.ts`. For what each scene draws, see [Scenes](docs/scenes.md). |
| `hooks/*.test.tsx` | Tests that run against the engine: the band and the panel in `cozy-clawd.test.tsx`, what Clawd shows as a session moves on in `clawd.test.tsx`, the meters in `meters.test.tsx`, and how the terminal paints and lays out the band in `terminal.test.tsx`. |
| `types/index.d.ts` | The contract for the values the mod keeps in the session's state. |
| `.claude-plugin/plugin.json` | The plugin's manifest. |
| `tools/preview.mjs` | A script that renders Clawd's scenes and a few states of each meter scene to an HTML page, as images and as the terminal paints them in both sizes. |
| `tools/serve.mjs` | A script that serves the preview page to your own machine. |
| `tools/readme-images.mjs` | A script that renders the documentation's GIFs to `docs/images/`. |
| `tools/load.mjs` | What the scripts share: the Node.js version they need, and how they load the mod's modules and Clawd's scenes. |
| `docs/` | The user documentation that the README links to, and its images. |

## Load the mod from a clone

To work on the mod, load it from your clone instead of the marketplace. If you installed it from the marketplace, turn that copy off first with `claude plugin disable cozy-clawd@orihuelaconde`, so only one copy draws the band.

To load the clone in every session, including the desktop app's, add its folder to the `CLAUDE_CODE_PLUGIN_DIRS` variable, and set `CLAUDE_CODE_PLUGIN_DIR_WATCH` to `1`, in the `env` block of your user settings file, `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "PATH_TO_COZY_CLAWD",
    "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
  }
}
```

Replace `PATH_TO_COZY_CLAWD` with the folder where you cloned the repository, such as `C:\\Users\\YOUR_USER\\source\\repos\\cozy-clawd` on Windows; in JSON, each backslash is written twice. To list several folders, separate them with your platform's path-list separator: `;` on Windows, `:` on macOS and Linux. A terminal session watches the folder and reloads the mod when its files change. A desktop or SDK session watches it only when `CLAUDE_CODE_PLUGIN_DIR_WATCH` is `1` in the same `env` block, as in the example; without it, they don't reload the mod when its files change. A change shows in the band when the turn that made it ends.

To load the clone in a single terminal session instead, start Claude Code with the `--plugin-dir` flag:

```bash
claude --plugin-dir PATH_TO_COZY_CLAWD
```

## Check your change

To check the mod the way the engine reads it, run the following commands from the repository root:

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

The first command checks the plugin, and the second runs the tests.

To type-check the mod, run TypeScript's compiler with the repository's `tsconfig.json`:

```bash
npx -p typescript tsc -p .
```

The `tsconfig.json` extends the engine's types, which Claude Code writes to `.claude-plugin/types/` when it loads the mod. Load the mod from your clone once before you run the compiler.

## Preview the scenes

The preview page shows Clawd's scenes and each meter scene without running a session: each at band size, enlarged, and as the terminal paints it in the small and the large size, with cells of 9 by 18 pixels.

To build and serve the page, you need Node.js 22.18 or later, which runs the mod's `.ts` files directly.

To see the preview page, do the following:

1. From the repository root, generate the page:

   ```bash
   node tools/preview.mjs
   ```

2. Serve the page:

   ```bash
   node tools/serve.mjs
   ```

   The server answers only on your own machine. The `preview` launch configuration in `.claude/launch.json` runs the same server.

3. Open `http://localhost:8765` in a browser.

## Change a drawing

Clawd's scenes are in `hooks/register.tsx`, and in `hooks/small.ts` for the terminal's small size. The meter scenes are in `hooks/scenes/`. Each drawing is a plain SVG image with CSS animations. To look the same in the desktop app and in a terminal, a drawing keeps to the following:

- **Pixel units.** In Clawd's sprite, a pixel is 1 unit wide and 2 tall (`scale(1 2)`), like a terminal's quarter block, and props use half-unit heights for square pixels. The meter scenes use square pixels.
- **Motion in CSS only.** The desktop app reloads every image when the band redraws, which restarts its animations. Anything that moves on its own, such as a candle's flame or the cache's countdown, is a CSS animation with a negative delay, never a state the mod writes on a timer.
- **What the terminal reads.** The terminal can't show SVG, so `hooks/raster.ts` reads each scene's SVG and CSS and paints it in block characters. It reads only the elements, selectors, and properties that its header comment lists. If a drawing needs more, add it to `hooks/raster.ts` too, or the terminal paints it differently.
- **The small size.** In the terminal's small size, `hooks/small.ts` draws Clawd a quadrant to a pixel, two colors to a character cell; a cell with more colors shows the two it has most of. A meter scene can have a `small` drawing of its own in half blocks, with its numbers as a line of text under it. A scene without one shows its large drawing in both sizes.

After you change a drawing, check it on the preview page, then [render the documentation's images](#render-the-documentations-images) again.

## Add a scene

To add a meter scene, do the following:

1. In every file in `hooks/languages/`, add the scene's name, as the panel shows it, to `scenes`.
2. Create `hooks/scenes/NAME.ts`, and export a `MeterScene` from it: its `name`, its `label` (`wordsOf(t => t.scenes.NAME)`), its size, an `svg` function that draws the meters, and, optionally, a `small` drawing. The type is in `hooks/scenes/index.ts`.
3. Add the scene to `METER_SCENES` in `hooks/scenes/index.ts`. The panel offers the scenes in that order.
4. [Render the documentation's images](#render-the-documentations-images). The script renders every scene in `METER_SCENES`.
5. Describe the scene in `docs/scenes.md`, and add it to the grid in the README's **Choose a scene** section.

## Improve a translation

The mod's texts are in `hooks/languages/`, one file per language, named by its language code, such as `ja.ts`. `en.ts` sets the texts every language has, under the same keys.

To improve a translation, edit the language's file, then open the `/cozy-clawd` panel, select the language, and check the band and the panel. The texts in languages other than English and Spanish are machine translations.

> **Note:** In a terminal, the band, the panel, and the commands speak English when the language is Hindi, because Claude Code measures Devanagari narrower than a terminal draws it. To check Hindi, use the desktop app.

## Render the documentation's images

The GIFs in `docs/images/` come from the mod's own drawing code. To render them, you need the following:

- [ffmpeg](https://ffmpeg.org/) on your `PATH`.
- Node.js 22.18 or later.
- Playwright 1.56.1 and its Chromium, which the first two of the following commands install.

To render the images, run the following commands from the repository root:

```bash
npm install --no-save playwright@1.56.1
```

```bash
npx playwright install chromium
```

```bash
node tools/readme-images.mjs
```

The labels and buttons in the GIFs are set in the sans-serif and monospace fonts your machine has, so they can look slightly different from the GIFs in the repository.

## Release a version

The `orihuelaconde` marketplace, in the [claude-plugins](https://github.com/OrihuelaConde/claude-plugins) repository, installs the mod from this repository's default branch. Users who installed it get an update only when its version changes. To publish a release, increment `version` in `.claude-plugin/plugin.json` and push.
