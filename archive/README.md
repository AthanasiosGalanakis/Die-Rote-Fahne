# Archived content

Scenes here are not built into the game. They were taken out while the game
is rebuilt, and can be brought back by moving them into `source/scenes/rote_fahne/`.

- `cards/`: the 1923 cards (taken out in version 0.6). Give a restored card the
  tag `rf_party`; the old tags `rf_mass` and `rf_moscow` belonged to decks that
  were merged into Party Affairs.
- `events/`: the old events from Leipzig 1923 to Frankfurt 1924 (taken out in 0.8; version 0.10 rewrote Leipzig, Saxony and the congresses from scratch).
  Splits and the collapse ending also lived in `rf_post_event.scene.dry` (see
  the git history of that file).
- `rf_endings.scene.dry`: the endings (taken out in 0.8).
- `v0.10/`: everything version 0.11 took out: the 1923 events (Leipzig, Saxony, Zeigner, the Zentralausschuss, state elections, congresses, factions forming, the hidden split-offs), the eight Party Affairs cards, the advisors scene with its actions, the Zentrale's Executive card and the Provinces scene with state decisions. The advisor candidates and the state decisions also live in the git history of `out/html/rote_fahne.js` and `tools/gen_states.py` (set `ENABLE_DECISIONS = True` there).
- `v0.10/tools/gen_advisors.py`: the generator for the v0.10 advisors scene. It writes `source/scenes/rote_fahne/rf_advisors.scene.dry`, so running it replaces the current placeholder posts with the old advisors.
