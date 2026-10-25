# Die Rote Fahne

A standalone game built on [Social Democracy: An Alternate History](https://github.com/aucchen/social_democracy_alternate_history) by Autumn Chen. You lead the Communist Party of Germany (KPD), starting in January 1923.

## How it plays

You play the party as a whole, not one faction. Every card and event you choose strengthens some factions inside the KPD and angers others, and each choice says which:

- Brandler Right: united front with the SPD, workers' governments.
- Middle Group: party unity above any line.
- Fischer–Maslow Left: no coalitions, prepare the offensive; Zinoviev's favourites.
- Ultra-Left: Korsch, Scholem, Rosenberg; suspicious of the unions, parliament and Moscow. Defying Moscow feeds it.
- Thälmann circle: follows whoever rules in Moscow. Obeying Moscow feeds it; defying Moscow angers it.

Strong factions take the leadership at congresses. Angry factions can break away. A leadership pushed too far can resign. Moscow can overturn any result, more easily the less autonomy the party has kept.

The sidebar has four tabs: Main (the party's status, the Reich government, the Reichstag, the next election, the currency), Party (factions, Moscow, armed formations, support for the revolution), Politics (relations with and leaders of the other parties) and Polls (projected results, support for the Republic and for nationalism, results by group). You hold four cards each month. Words replace numbers in the sidebar; Options can turn exact numbers on, which disables achievements for that game. The advisor slots, the leader's portrait and the achievements page are placeholders for now.

The current version covers Act I, the revolutionary year: January 1923 to the Frankfurt party congress of April 1924. It ends with a successful German October (rare, by design), a graded verdict on the party at Frankfurt, or the party's collapse. Acts II to V (1924 to 1934) are not built yet.

## Where the code is

- `source/scenes/rote_fahne/`: the game's scenes, prefixed `rf_` (start, hand, monthly update, sidebar, endings).
- `source/scenes/rote_fahne/cards/`: playable cards, tagged `rf_party`, `rf_mass` or `rf_moscow`.
- `source/scenes/rote_fahne/events/`: events, tagged `rf_event`.
- `source/scenes/rote_fahne/rf_status.scene.dry`: the sidebar tabs. Charts (Reichstag, polls) are drawn by `RF.renderSidebar` into placeholder divs.
- `source/scenes/rote_fahne/rf_advisors.scene.dry`: empty advisor slots.
- `source/scenes/rote_fahne/rf_changelog.scene.dry` and `rf_achievements.scene.dry`: the title-screen pages. The title screen itself is `source/scenes/root.scene.dry`.
- `source/qdisplays/rf_*.qdisplay.dry`: the words the sidebar uses instead of numbers.
- `out/html/rote_fahne.js`: shared rules (faction leanings, congresses, Moscow verdicts, the rising, the Reich calendar, polls).
- `out/html/game.css`: party colours (`p-kpd`, `p-spd`, ...) and faction colours (`f-right`, `f-left`, ...), after the Dynamic Social Democracy mod.
- The original game's scenes are still in `source/scenes/` for reuse in later acts, but the title screen no longer offers them.

## Included Libraries

[jquery v1.11.1](https://releases.jquery.com/)

[d3.js v7](https://d3js.org)

[d3-parliament](https://github.com/geoffreybr/d3-parliament)

## Building the game

1. Run `npm install` (installs [dendrynexus](https://github.com/aucchen/dendrynexus)).

2. Run `npx dendrynexus make-html` in this folder, then copy `out/game.json` to `out/html/`.

3. Serve `out/html` with any static web server, for example `python3 -m http.server` inside that folder, and open it in a browser.

To update dendrynexus in `package-lock.json`, run `npm install --upgrade https://github.com/aucchen/dendrynexus`
