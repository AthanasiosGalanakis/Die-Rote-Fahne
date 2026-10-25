# Archived content

Scenes here are not built into the game. They were taken out while the game
is rebuilt, and can be brought back by moving them into `source/scenes/rote_fahne/`.

- `cards/`: the 1923 cards (taken out in version 0.6). Give a restored card the
  tag `rf_party`; the old tags `rf_mass` and `rf_moscow` belonged to decks that
  were merged into Party Affairs.
- `events/`: the events from Leipzig 1923 to Frankfurt 1924 (taken out in 0.8).
  Splits and the collapse ending also lived in `rf_post_event.scene.dry` (see
  the git history of that file).
- `rf_advisors.scene.dry`: the three advisor posts and the Replace card (taken
  out in 0.8). `tools/gen_advisors.py` regenerates it; the advisor data is still
  in `RF.advisors` in `out/html/rote_fahne.js`. Add `- #rf_advisor` back to
  `rf_main.scene.dry` to show them.
- `rf_endings.scene.dry`: the endings (taken out in 0.8).
