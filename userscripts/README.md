# ATLAS userscripts

Free, open source userscripts for GeoGuessr players, from the team behind
[ATLAS](https://geoguessrcheats.com/). These are self-improvement tools. They run fully in
your browser, make no network calls, and never reveal the round location while you play.

## GeoGuessr Round Journal

[`geoguessr-round-journal.user.js`](geoguessr-round-journal.user.js)

Keeps a training journal of your finished rounds: actual location, your guess, distance and
score, with Street View links and CSV or JSON export. It writes a round only after you have
guessed, so it shows nothing about an unfinished round.

## GeoGuessr Round Timer and Pace Tracker

[`geoguessr-round-timer.user.js`](geoguessr-round-timer.user.js)

A small on-screen timer that tracks how long you take per round, with session stats (rounds
played, average, fastest, slowest) and CSV export. Useful for training your speed in Duels
and NMPZ, where pace matters as much as accuracy. It never reads the game's location data,
so it is not a cheat.

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/).
2. Open the raw `.user.js` file and your manager will offer to install it.
3. Open GeoGuessr and the tool appears.

## Want predictions, not just stats?

If you want an AI that actually reads the round and tells you the location, that is the
[ATLAS desktop app and Chrome extension](https://geoguessrcheats.com/). The free
[Chrome extension](https://chromewebstore.google.com/detail/geoguesser-cheats-geogues/mggpkondmigmgbgafalghhkagkldinkj)
gives you 7 free rounds with no account.

## License

MIT. Use, fork and improve.
