# Rooftop Rush

A 3D endless rooftop runner for [start.ng](https://start.ng). Sprint across a sunset skyline, jump the gaps (double jump for the wide ones), dodge water tanks, dishes and clothes lines, and grab coins. Your own start.ng character runs the course. Score is distance, and coins are a second stat on the leaderboard.

## Controls
- **Jump:** Space, Up arrow or W. Press again in mid-air to double jump.
- **Pause:** Esc or P. The game also pauses when the tab is hidden.
- **Touch:** tap anywhere (or swipe up) to jump, or use the on-screen Jump button.

## Run locally
The game is plain static files, so any static server works:

```
python -m http.server 8000
```

Then open <http://localhost:8000>. Opened locally, start.ng does not answer, so you play as a default guest and scores are not saved. Add `?guest` to the URL to hide the sign-in prompts.

## Publish on start.ng
Push this repo to GitHub, then:

```
curl -X POST https://api.start.ng/games/check \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/<owner>/<repo>","name":"rooftop-rush"}'

curl -X POST https://api.start.ng/games/publish \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/<owner>/<repo>","name":"rooftop-rush"}'
```

If the reply contains an `approve_url`, open it to approve the game.

## Cover image
Add a 16:10 `cover.png` (1600x1000) next to `index.html`. start.ng uses it for the game's card.

## Project layout
See `CLAUDE.md` for the file map, rules and the list of next improvements.
