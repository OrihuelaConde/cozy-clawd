# The band in a terminal

A terminal can't show the SVG images the desktop app draws, so there Cozy Clawd paints each scene in block characters and animates it frame by frame. The scenes, the cache's countdown, and the **Compact** button work as they do in the desktop app. Claude Code's own spinner stays as it is.

The band draws in any terminal. For the scenes' true colors, the terminal needs 24-bit color (truecolor), such as Windows Terminal or iTerm2; with fewer colors, Claude Code approximates them.

In the following image, the band shows a turn in a terminal, in the small size above and the large size below:

<p align="center">
  <img src="images/terminal.gif" alt="A terminal shows the band in two sizes as Clawd thinks, reads a file, runs a command, edits a file, writes, and juggles. Above, the small size: Clawd as on Claude Code's welcome screen, beside a small balcony with the meters' numbers as text. Below, the large size, with the desktop app's drawings in block characters">
</p>

## Choose the size

In a terminal, the band comes in two sizes:

| Size | Rows | Columns, at least | What it shows |
| --- | --- | --- | --- |
| Small, the default | 5 | 75 | Clawd as Claude Code draws it on its welcome screen, four pixels to a character cell, beside a smaller drawing of the scene, two pixels to a cell, with the meters' numbers in plain text under it. |
| Large | 9 | 109 | The scenes the desktop app shows, two pixels to a character cell. |

The small drawings are simpler than the large ones. Each meter shows four steps: more than half left, half or less, a quarter or less, and nothing. A few extras of the large drawings don't fit, such as the shelf's teapot and the mate's kettle.

To choose the size, open the `/cozy-clawd` panel in a terminal and select **Small** or **Large** in the **Size** picker. The band switches at once, and later sessions start with the size you chose. The desktop app always shows the large size.

## Fit the band in a narrow terminal

The rows and columns in the table are for Clawd, the step, and the meters. While the **Compact** button shows, the band takes 12 more columns, and 24 more while the button asks you to confirm. These counts are for the English texts; other languages can take more or fewer.

If the terminal is too narrow or too short for Clawd and the meters side by side, the band shows Clawd with the meters in words. If there's room for even less, the band shows only the step and the meters in words.

## Get true colors in Windows Terminal

In Windows Terminal, Claude Code can paint the band in fewer colors than the scenes use, so the colors shift: the wood of the shelf turns olive, for example. To have Claude Code paint in 24-bit color, set the `FORCE_COLOR` environment variable to `3` before you start it. In PowerShell, run the following command:

```powershell
$env:FORCE_COLOR = '3'; claude
```

The variable lasts for that PowerShell session. To set it in every session, add `$env:FORCE_COLOR = '3'` to your PowerShell profile, the file that `$PROFILE` names.

## Get true colors in tmux

In tmux, Claude Code paints in 256 colors at most, unless the `CLAUDE_CODE_TMUX_TRUECOLOR` environment variable is set to `1` before you start Claude Code.

> **Note:** `CLAUDE_CODE_TMUX_TRUECOLOR` comes from Claude Code's own code, not from its documentation, so a later release can change or drop it.

## Hindi in a terminal

In a terminal, the band, the `/cozy-clawd` panel, and the commands' replies and menu descriptions speak English when the language is Hindi, because Hindi text comes out garbled there. For more information, see [Languages](languages.md#hindi-in-a-terminal).
