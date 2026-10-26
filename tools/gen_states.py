# Generates source/scenes/rote_fahne/rf_provinces.scene.dry: the Provinces
# card, a page per state and the decisions there. Run from the repository
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

# The decisions below are switched off for now: the state pages show the
# Landtag only. Set ENABLE_DECISIONS = True to bring them back.
ENABLE_DECISIONS = False

# Decisions every state offers. (id, title, subtitle, view-if, choose-if,
# unavailable subtitle, local points, national effects as JS, result text)
GENERIC = [
    ('campaign', 'Campaign in {name}.',
     'Meetings, leaflets and the party press. Raises the party\'s standing here. Costs 1 resource.',
     None, 'prov_ready = 1 and funds >= 1', 'One decision in the states a month; needs 1 resource.',
     2.0, "Q.funds -= 1;\nQ.members += 1;",
     'Speakers tour the industrial towns, the local party paper doubles its run for a week, and the comrades go door to door in the workers\' districts.'),
    ('councils', 'Organise the factory councils and the unemployed in {name}.',
     'More influence in the unions, a little more standing here. The police take note.',
     None, 'prov_ready = 1', 'One decision in the states a month.',
     1.0, "Q.union_influence += 2;\nQ.repression += 1;",
     'Communist slates contest the council elections in the big works; unemployed committees march on the town halls to demand relief.'),
    ('support', 'Back the Social Democratic government in {name} against the right.',
     'Better relations with the SPD; pleases the Right, angers the Left. Some radical voters are disappointed.',
     'state_spd_gov = 1 and state_kpd_seats > 0', 'prov_ready = 1', 'One decision in the states a month.',
     -0.5, "Q.spd_relation += 3;\nwindow.RF.lean(Q, {right: 2, left: -2});",
     'The Communist deputies vote with the Social Democrats against the bourgeois motions. The SPD press grudgingly notes it; the Left calls it parliamentary cretinism.'),
    ('attack', 'Attack the government in {name} from the left.',
     'More standing with radical voters; worse relations with the SPD. Pleases the Left.',
     'state_kpd_seats > 0', 'prov_ready = 1', 'One decision in the states a month.',
     1.0, "Q.spd_relation -= 2;\nwindow.RF.lean(Q, {left: 2, right: -1});",
     'Communist deputies table motions for free school meals, price controls and the disarming of the right-wing leagues, knowing the government will vote them down.'),
]

# Decisions only some states offer.
SPECIFIC = {
    'prussia': [
        ('ruhr', 'Organise in the occupied Ruhr.',
         'The miners are on passive resistance, the French on the pitheads. Raises standing in Prussia and the revolutionary mood; draws repression.',
         'year = 1923 and month <= 9', 'prov_ready = 1', 'One decision in the states a month.',
         1.5, "Q.rev_situation += 2;\nQ.repression += 2;\nQ.nationalism -= 1;",
         'Party organisers move between the pits and the occupation authorities\' checkpoints, preaching a struggle against both the French and the German coal barons.'),
    ],
    'bavaria': [
        ('underground', 'Build illegal cells in Bavaria.',
         'Protects the party against the Bavarian authorities. Less repression; a little more readiness.',
         None, 'prov_ready = 1', 'One decision in the states a month.',
         0.0, "Q.repression -= 2;\nQ.readiness += 1;",
         'Membership lists are kept out of the offices, meetings move to back rooms, and every cell knows a second address.'),
    ],
    'saxony': [
        ('control', 'Push for control committees and workers\' defence in Saxony.',
         'Demands on the Social Democrats in return for Communist votes. Raises readiness and standing here; pleases the Left.',
         'state_kpd_seats > 0', 'prov_ready = 1', 'One decision in the states a month.',
         1.0, "Q.readiness += 2;\nwindow.RF.lean(Q, {left: 2});\nQ.spd_relation -= 1;",
         'The Communist group names its price: price-control committees with powers, an amnesty, and defence units of the factory workers.'),
    ],
    'thuringia': [
        ('tolerate', 'Keep the Frölich government in office.',
         'Communist votes keep the socialist minority alive. Better relations with the SPD; pleases the Right.',
         'state_kpd_seats > 0', 'prov_ready = 1', 'One decision in the states a month.',
         0.0, "Q.spd_relation += 2;\nwindow.RF.lean(Q, {right: 2});",
         'The Communist deputies abstain on the budget and the government survives another vote.'),
    ],
    'hamburg': [
        ('docks', 'Rally the Hamburg docks and shipyards.',
         'Raises standing in Hamburg and union influence; pleases the Left and its Hamburg leaders.',
         None, 'prov_ready = 1', 'One decision in the states a month.',
         1.5, "Q.union_influence += 1;\nwindow.RF.lean(Q, {left: 2});",
         'The Hamburg party calls the dockers and the yard workers to the Heiligengeistfeld. Ernst Thälmann speaks.'),
    ],
}

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
    decisions = GENERIC + SPECIFIC.get(sid, []) if ENABLE_DECISIONS else []
    out.append(f"""@{sid}
title: {name}
new-page: true
on-arrival: {{! window.RF.stateView(Q, '{sid}'); !}}

= {name}

[+ st_view +]

""")
    for d in decisions:
        out.append(f"- @{sid}_{d[0]}\n")
    out.append(f"- @rf_provinces: Back to the states.\n- @rf_hand: Back to the party.\n\n")
    for did, title, sub, view, choose, unav, local, js, text in decisions:
        out.append(f"@{sid}_{did}\ntitle: {title.format(name=name)}\nsubtitle: {sub}\nnew-page: true\n")
        if view:
            out.append(f"view-if: {view}\n")
        if choose:
            out.append(f"choose-if: {choose}\nunavailable-subtitle: {unav}\n")
        out.append(f"""on-arrival: {{!
{js}
window.RF.stateAction(Q, '{sid}', {local});
!}}

= {name}

{text}

- @{sid}: Back to {name}.
- @rf_hand: Back to the party.

""")

with open('source/scenes/rote_fahne/rf_provinces.scene.dry', 'w') as f:
    f.write(''.join(out).rstrip() + '\n')
