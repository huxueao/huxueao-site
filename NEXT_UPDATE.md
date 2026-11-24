# Update notes

## Included in the Candle Flight update — 2026-11-25

- Janus silver coin: substantially coarser pixel blocks; a stern older bearded profile and a younger clean-shaven profile are visibly different. Header size stays modest.
- Candle Flight: user selected the open-to-close candle body as the passable window. Four assets (NVIDIA, Tesla, Apple, Bitcoin), pixel character choices, real historical daily candles, and one-button flight.
- Annual courses cover the rolling year ending today (Singapore time), using completed daily candles. Show the actual dates and clearly label fallback data. Save and continue the latest unfinished flight.
- Keep interface copy simple and maintain English/Chinese switching.

The coin changes were requested on 2026-11-24 for the next website update and are implemented in this release. No additional avatar change is currently queued.

## Candle Flight camera and controls — 2026-11-25

- Preserve raw body sizes and gaps on one fixed price scale; pan vertically instead of fitting a whole year to the screen.
- Wide playfield, many more visible candles, narrower columns, smaller pilot and forgiving centre hitbox.
- Hold to rise and release to glide, with smoother speed changes and reliable input release.
- Preserve prior progress by migrating old saves to the last completed candle.

## Candle Flight desktop layout and tap controls - 2026-11-25

- Supersedes the hold/release controls above: click, tap, or press Space once per flap. Holding does not repeat; rapid separate taps climb higher.
- Triple column width from 14 to 42 world units while retaining real open-to-close heights and the moving camera.
- Remove the height-based width cap. Use a full-width board, compact title/asset row, score header, and simple controls; preserve pixel aspect ratio on resize.
- On touch devices, require landscape to play. Rotating to portrait pauses and saves; rotating back waits for Resume.
- Upgrade v2/v3 saves at the last completed candle; v4 saves preserve exact position and camera.
