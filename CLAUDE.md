# CLAUDE.md: Rooftop Rush

Notes for the AI developer continuing this project.

## The game
An endless 3D rooftop runner at sunset for start.ng. The runner auto-runs along a chain of rooftops. The player jumps gaps (with a double jump for wide ones), dodges water tanks, satellite dishes and clothes lines, and collects coins. Speed and difficulty rise over time. One hit, a missed gap or a wall crash ends the run.

- **Score** = distance in metres (`score`). **Second stat** = coins (`coins`).
- **Controls:** Space / Up / W to jump (press again in mid-air to double jump), Esc or P to pause, Enter to start. On touch: tap anywhere or use the on-screen Jump button.
- The player's character is built from their start.ng `style` (see `js/character.js`).

## File map
- `index.html`: page shell, import map (three.js r160 from jsDelivr), screens markup.
- `css/style.css`: all styles (dusk-plum UI, Bungee title, Nunito body).
- `js/config.js`: every tunable number in one exported `CONFIG` object. Change balance here first.
- `js/startng.js`: `askStartNg` (verbatim helper) plus `getPlayer()`, `saveRun()`, `getLeaderboard()`, `signIn()`. The ONLY file that talks to start.ng.
- `js/character.js`: `createCharacter(style)` returns a `THREE.Group` with `userData.animate(dt, state, speed)`; states are `idle | run | air | fall | dead`. `disposeCharacter()` frees it.
- `js/world.js`: scene, camera, lights, sky dome, parallax skyline, clouds; mesh factories `createRoof/createObstacle/createCoin/createPuff`.
- `js/game.js`: game loop, generation, physics, collisions, scoring, difficulty, pooling.
- `js/ui.js`: screens, HUD, name tag, pop-ups, leaderboard list. No game logic.
- `js/main.js`: entry point; input, pause handling, start.ng wiring, frame loop.
- `startng.json`: leaderboard columns (`score`, `coins`). Must match `CONFIG.stats`.
- `README.md`: for humans.

## start.ng rules (do not break these, or the game is refused)
1. Static files only: HTML, CSS, JavaScript. No server, no build step, no npm, no TypeScript, no JSX. `index.html` stays at the repo root.
2. three.js r160 via the import map in `index.html`, pinned exactly. No other external scripts. (Google Fonts stylesheet is allowed.)
3. Relative paths only (`./js/main.js`, never `/js/main.js`).
4. No secrets, API keys, password fields, redirects to other sites (other than the sign-in link in `startng.js`), `eval`, `new Function` or obfuscated code.
5. All 3D models are built from three.js primitives. No external models or textures.
6. The player's character MUST be drawn from `player.style` (all hair, hat and accessory options, skirt for female and trousers for male, sensible fallbacks).
7. All start.ng calls go through `js/startng.js` only.
8. Leaderboard stats sent must be exactly the keys in `startng.json`, as whole numbers.
9. If the URL contains `?guest`, never nag the player to sign in.

## How the game works (read before changing gameplay)
- **Coordinates:** the runner stays at x = 0. Everything else has a world position `wx` along the path and is drawn at `x = wx - dist`. Roofs span `[start, end]`.
- **Jump maths:** `airtime = 2 * jumpVelocity / gravity`; single-jump distance = `speed * airtime`. Gap sizes are fractions of that (`CONFIG.gaps`), so gaps are always clearable. Wide gaps (115-135%) need the double jump and only appear after difficulty 0.25. If you change jump physics, re-check the fractions in `CONFIG.gaps` (the double jump reaches roughly 1.5x to 1.9x a single jump depending on timing).
- **Obstacle placement:** `populateRoof()` keeps a clear zone after landing and before the next gap, and spaces obstacles by `single * 0.9 + pad`.
- **Pooling:** roofs, obstacles, coins and dust puffs are pooled (`take` / `give` in `game.js`). Do not create meshes per frame.
- **Death:** `die('hit' | 'fall' | 'crash')` then state `dying` (about 1 s), then `over` and `hooks.onGameOver`.
- **Player updates:** `main.js` shows a guest straight away, then replaces it when start.ng answers. Updates that arrive mid-run wait until the run ends.

## Run locally
```
python -m http.server 8000
```
Then open `localhost:8000`. Locally, start.ng never answers, so the guest fallback is used and the leaderboard shows "not available". Add `?guest` to test the no-nag path.

## Publish
```
POST https://api.start.ng/games/check
POST https://api.start.ng/games/publish
body {"repo_url":"https://github.com/<owner>/<repo>","name":"rooftop-rush"}
```
Send the same JSON body to both. After `publish`, open the `approve_url` in the reply if there is one. Add a 16:10 `cover.png` (1600x1000) next to `index.html` first.

## Known assumptions (verify on start.ng)
- The leaderboard reply shape is read defensively in `normaliseRows()` in `js/startng.js` (it looks for `entries/rows/leaderboard/board/results/data`, and `player_id`, `name`, and stats either nested under `stats` or flat). Log a real reply on start.ng and tighten it.
- `saveRun()` treats any reply without `ok: false` or `error` as success.
- Nothing has been playtested in a browser yet. Expect to tune `CONFIG` (jump feel, gap fractions, camera framing, light intensities).

## TODO (next improvements)
- Sound: jump, land, coin, hit, and a mute toggle (WebAudio synthesised, no files).
- More obstacle types: birds crossing at head height (slide/duck), moving platforms, crumbling roof edges.
- Power-ups: coin magnet, shield, slow-mo.
- `cover.png` (16:10, 1600x1000) for the start.ng card.
- Better portrait/phone camera (fixed framing so the runner sees further ahead) and a landscape hint on small screens.
- A real character preview on the start screen, and a trimmed-pixel-ratio "low quality" toggle.
- Instance the window rows and skyline to cut draw calls further on very weak devices.
- Daily seeded runs, plus showing the player's own rank when they are outside the top 10.
- Headless tests for the generator (assert every gap is clearable at every speed).
