# Generates source/scenes/rote_fahne/rf_provinces.scene.dry: the Provinces
# card, a page per state. Run from the repository
# root:
#   python3 tools/gen_states.py
# Keep STATES in step with RF.states in out/html/rf_states.js (the data and
# the drawing live there; this file only writes the scenes).
# Only the states that matter most to the party are shown: the big ones
# and the centres of the 1923 crisis. rf_states.js keeps data for all 18.
STATES = [
    ('prussia', 'Prussia'), ('bavaria', 'Bavaria'), ('saxony', 'Saxony'), ('wurttemberg', 'Württemberg'),
    ('baden', 'Baden'), ('thuringia', 'Thuringia'), ('hesse', 'Hesse'), ('hamburg', 'Hamburg'),
]

out = [r"""title: Provinces
subtitle: The German states, their governments and their parliaments.
is-pinned-card: true
tags: rf_top
new-page: true

= The States

The Reich is a federation of states, each with its own parliament, government and police. Choose a state to see its Landtag.

"""]
for sid, name in STATES:
    out.append(f"- @{sid}\n")
out.append("- @rf_hand: Back to the party.\n\n")

for sid, name in STATES:
    out.append(f"""@{sid}
title: {name}
new-page: true
on-arrival: {{! window.RF.stateView(Q, '{sid}'); !}}

= {name}

[+ st_view +]

- @rf_provinces: Back to the states.
- @rf_hand: Back to the party.

""")

with open('source/scenes/rote_fahne/rf_provinces.scene.dry', 'w') as f:
    f.write(''.join(out).rstrip() + '\n')
