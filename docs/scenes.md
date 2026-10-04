# Scenes

The right side of the Cozy Clawd band draws four meters of your session as a scene: the context window left, the minutes left on the prompt cache, and what's left of your five-hour and weekly usage limits. Each scene draws the meters as objects of its own, with each number underneath in a pixel font.

When 25% or less of the context is left, each scene shows it in its own way, and a **Compact** button appears next to the scene. While the conversation is compacted, the context meter fills up again.

## What the meters measure

- **Context.** The percentage of the context window left. Before Claude's first answer in a session, and after a compaction or `/clear`, Claude Code has no reading yet, so the meter shows an estimate of what the next request sends, as `/context` counts it.
- **Prompt cache.** The minutes left on the prompt cache, counted down from Claude's last answer. The mod doesn't read the cache itself; it counts down the length Claude Code keeps the cache for, by the same rules:
  - An hour when you sign in with a Claude subscription and stay within its usage limits.
  - Five minutes with an API key, or once you use up a usage limit.
  - The length you set with the `CLAUDE_CODE_PROMPT_CACHE_TTL` environment variable or the `promptCacheTtl` setting, `1h` or `5m`.
  - An hour with the `ENABLE_PROMPT_CACHING_1H` environment variable, or on Amazon Bedrock with `ENABLE_PROMPT_CACHING_1H_BEDROCK`.
  - Five minutes with `FORCE_PROMPT_CACHING_5M`, whatever else is set.

  With `DISABLE_PROMPT_CACHING`, nothing is cached and the meter shows `--`. After `/clear`, the count waits for the next answer. When you resume a conversation, the count goes on from that conversation's last answer.
- **Five-hour and weekly limits.** What's left of your subscription's usage limits, as of Claude's last answer. When a limit's window starts over, its meter fills up again without waiting for the next answer. With an API key, Claude Code reports no usage limits, so these meters show `--`.

Until the context or a usage limit has a reading, its meter shows `--` and draws full.

## Choose a scene

To choose a scene, do one of the following:

- Open the `/cozy-clawd` panel, which shows each scene with your session's meters, and select **Use** under the one you want. In a terminal, the panel has a **Scene** picker instead.
- Run the `/cozy-clawd-scene` command with the scene's name:

  ```text
  /cozy-clawd-scene SCENE_NAME
  ```

  Replace `SCENE_NAME` with the name of a scene on this page, such as `mate`. To see the current scene and the names available, run `/cozy-clawd-scene` with no name.

The band switches to the new scene at once, and later sessions start with it. Until you choose a scene, the band shows `balcony`.

The scene names stay the same in every language. In a terminal's small size, each scene has a smaller drawing of its own; for more information, see [Choose the size](terminal.md#choose-the-size).

## Balcony

<img src="images/scenes/balcony.gif" width="432" alt="A watering can, a daisy, a bird feeder, and a jar of honey on a balcony">

**Name:** `balcony`, the default scene.

A sunny balcony. A watering can's water shows the context left; at 25% or less a rain cloud gathers over it, and while the conversation is compacted it rains into the can. A daisy in a pot wilts as the prompt cache runs out. A bluebird pecks at a feeder whose seeds are what's left of the five-hour limit, and a jar of honey, a bee buzzing around it, empties as you use the weekly limit.

## Mate

<img src="images/scenes/mate.gif" width="432" alt="A thermos, a mate, a plate of medialunas, and a pack of yerba on a sky blue and white checked tablecloth">

**Name:** `mate`

A tablecloth checked sky blue and white, like the Argentine flag, set for mate. A thermos's strip of water shows the context left, and at 25% or less a steaming kettle waits beside it; while the conversation is compacted, the kettle boils and the thermos fills up. The mate's steam fades as the prompt cache runs out, and the yerba washes out when the cache expires. A plate holds a medialuna for every quarter of the five-hour limit left, and a pack of yerba flattens as you use the weekly limit.

## Teatime

<img src="images/scenes/teatime.gif" width="432" alt="A mug of tea, a brass clock with an orange timer disc, a cookie jar, and a box of tea bags on a wooden shelf">

**Name:** `teatime`

A wooden shelf on iron brackets. A mug of tea shows the context left; at 25% or less it stops steaming and a teapot stands beside it, and while the conversation is compacted the teapot pours and the mug fills up again. A brass clock times the tea hour: an orange disc on its face shrinks clockwise as the prompt cache runs out, and when the cache expires the face is bare, its hands at six. A cookie jar holds a cookie for every fifth of the five-hour limit left, and crumbs once only a couple remain. A box of tea bags empties, a bag at a time, as you use the weekly limit.

## Night window

<img src="images/scenes/window.gif" width="432" alt="A candle, a window with the moon, a cup of cocoa, and a ball of yarn on a desk at night">

**Name:** `window`

A desk by a window at night. A candle is as tall as the context left; at 25% or less a spare candle stands by, and while the conversation is compacted the candle grows back. The moon crosses the window as the prompt cache runs out, and sets when the cache expires. A cup of cocoa shows what's left of the five-hour limit, its steam thinning as it goes down, and a ball of yarn shrinks as you use the weekly limit.

## Adventure

<img src="images/scenes/adventure.gif" width="432" alt="A mana potion, an hourglass, a chest of gold, and a quiver on a stone floor">

**Name:** `adventure`

An adventurer's gear on the stone floor of a keep. A mana potion is as full as the context left; at 25% or less a spare vial waits beside it, and while the conversation is compacted the potion fills up again, sparkling. An hourglass runs out with the prompt cache. A chest's heap of gold is what's left of the five-hour limit, and a quiver loses its arrows as you use the weekly limit.

## Gamer

<img src="images/scenes/gamer.gif" width="432" alt="A monitor with three hearts, an arcade cabinet, cans of energy drink, and a gamepad on a desk">

**Name:** `gamer`

A gaming desk lit by an RGB strip. A monitor shows three hearts of health for the context left; at 25% or less the last one blinks, and while the conversation is compacted the hearts heal. On an arcade cabinet, a little hero walks to the flag as the prompt cache runs out; when the cache expires, it's game over. Cans of energy drink are what's left of the five-hour limit, and a gamepad's battery runs down as you use the weekly limit.

## Cyberpunk

<img src="images/scenes/cyberpunk.gif" width="432" alt="A power cell, a neon noodle sign, a stack of credit chips, and signal bars on a rainy rooftop">

**Name:** `cyberpunk`

A rooftop in the rain under a neon skyline. A power cell's charge shows the context left; at 25% or less it flickers pink beside a loose cable, and while the conversation is compacted the cable is plugged in and the cell charges. A neon sign of a bowl of noodles goes out tube by tube as the prompt cache runs out, until it's dark. A stack of credit chips is what's left of the five-hour limit, and signal bars drop as you use the weekly limit.

## Steampunk

<img src="images/scenes/steampunk.gif" width="432" alt="A boiler, a pocket watch, a scuttle of coal, and an airship in a workshop">

**Name:** `steampunk`

Brass and copper machines in a workshop. A boiler's sight glass shows the context left; at 25% or less its fire dies down and the gauge drops into the red, and while the conversation is compacted it whistles and the glass fills up. A pocket watch's minute hand goes around as the prompt cache runs out, and stops when the cache expires. A scuttle of coal is what's left of the five-hour limit, and an airship comes down as you use the weekly limit.
