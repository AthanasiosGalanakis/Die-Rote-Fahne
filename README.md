# Die Rote Fahne

A mod of [Social Democracy: An Alternate History](https://github.com/aucchen/social_democracy_alternate_history) by Autumn Chen. You lead one of four factions inside the Communist Party of Germany (KPD), starting in January 1923.

The original SPD game is still in this repository and can be started from the title screen.

## The prototype

The current version covers Act I, the revolutionary year: January 1923 to the Frankfurt party congress of April 1924. Choose "Die Rote Fahne" on the title screen.

- **Factions:** Brandler Right, Fischer–Maslow Left, Middle Group, and the Thälmann circle (which starts inside the Left, because a separate Stalinist faction did not exist yet in 1923).
- **Two boards:** Party Affairs, Mass Work and Moscow card decks move faction strength, dissent and Moscow standing on one side, and the revolutionary situation, armed readiness, unions and SPD relations on the other.
- **Comintern:** each faction has a standing in Moscow, and the party has an autonomy score that falls each time Moscow intervenes. After congresses and defeats, Moscow can overturn the result.
- **Events:** the Leipzig congress, the Schlageter speech, the Cuno strikes, the German October plan, the Saxon workers' government, the Chemnitz conference, the Hamburg Uprising, the Reich intervention, the Beer Hall Putsch, the party ban, Moscow's verdict, Lenin's death and the Frankfurt congress.
- **Purges and splits:** the leadership can remove or expel rival factions; a faction with very high dissent breaks away; an expelled player can recant, found a splinter party, or leave.
- **Endings:** a successful German October (rare, by design), or the Frankfurt congress, graded by where your faction ends up.

Acts II to V (1924 to 1934) are not built yet.

## Where the code is

- `source/scenes/rote_fahne/`: all scenes for the mod, prefixed `rf_` (start, hand, monthly update, sidebar, endings).
- `source/scenes/rote_fahne/cards/`: playable cards, tagged `rf_party`, `rf_mass` or `rf_moscow`.
- `source/scenes/rote_fahne/events/`: events, tagged `rf_event`.
- `out/html/rote_fahne.js`: shared rules (normalising factions, congresses, Moscow verdicts, the rising).
- `source/scenes/root.scene.dry` routes to `rf_post_event` when `rf_mode = 1`; `out/html/game.js` shows the `rf_status` sidebar in that mode.

## Included Libraries

[jquery v1.11.1](https://releases.jquery.com/)

[d3.js v7](https://d3js.org)

[d3-parliament](https://github.com/geoffreybr/d3-parliament)

## Building the game

1. Run `npm install` (installs [dendrynexus](https://github.com/aucchen/dendrynexus)).

2. Run `npx dendrynexus make-html` in this folder, then copy `out/game.json` to `out/html/`.

3. Serve `out/html` with any static web server, for example `python3 -m http.server` inside that folder, and open it in a browser.

To update dendrynexus in `package-lock.json`, run `npm install --upgrade https://github.com/aucchen/dendrynexus`
