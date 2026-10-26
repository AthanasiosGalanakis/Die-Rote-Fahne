# Generates source/scenes/rote_fahne/rf_advisors.scene.dry. Run from the repository root:
#   python3 tools/gen_advisors.py
# Keep ADVISORS here in step with RF.advisors in out/html/rote_fahne.js.
SLOTS = [
 ('org', 'Organisation', 'Your organisation secretary. Can act once every six months.', 'head of organisation', [
   ('recruit', 'Recruitment drive.', 'More members. Costs 1 resource.', 'funds >= 1', 'Needs 1 resource.',
    "Q.members += 10;\nQ.funds -= 1;",
    'Factory meetings, leaflets at the labour exchanges and a membership week in every district bring in new members.'),
   ('apparatus', 'Tighten the apparatus.', 'More paid functionaries loyal to the leadership; the leadership\'s faction calms down.', None, None,
    "Q.apparatus += 6;\nQ[Q.leader + '_dissent'] -= 4;",
    'District secretaries are checked, paid on time and reminded who appointed them.'),
 ]),
 ('unions', 'Trade Unions', 'Your head of trade-union work. Can act once every six months.', 'head of trade-union work', [
   ('councils', 'Campaign in the factory councils.', 'More Communist influence in the workplaces. The <span class="p-spd">SPD</span> resents it.', None, None,
    "Q.union_influence += 6;\nQ.spd_relation -= 3;",
    'Communist slates stand in the factory-council elections and win seats in the big works.'),
   ('adgb', 'Work inside the ADGB unions.', 'Some union influence and better relations with the <span class="p-spd">SPD</span>.', None, None,
    "Q.union_influence += 3;\nQ.spd_relation += 4;",
    'Communists stay in the Free Trade Unions, take on the dull work of the locals and avoid open splits.'),
 ]),
 ('military', 'Military Affairs', 'Your head of the military apparatus. Can act once every six months.', 'head of military affairs', [
   ('arm', 'Arm and train the defence units.', 'More readiness for a rising. Draws the police. Costs 1 resource.', 'funds >= 1', 'Needs 1 resource.',
    "Q.readiness += 6;\nQ.repression += 3;\nQ.funds -= 1;",
    'Weapons are bought, hidden and cleaned; men drill on Sundays in the woods outside the cities.'),
   ('lie_low', 'Lie low and protect the cadres.', 'Less state repression.', None, None,
    "Q.repression -= 5;",
    'Lists are burned, weapons buried and known militants moved to other towns.'),
 ]),
]
ADVISORS = [('eberlein','org'),('pieck','org'),('geschke','org'),('scholem','org'),
            ('walcher','unions'),('heckert','unions'),('merker','unions'),
            ('skoblevsky','military'),('schneller','military'),('kippenberger','military')]
NAMES = {'eberlein':'Hugo Eberlein','pieck':'Wilhelm Pieck','geschke':'Ottomar Geschke','scholem':'Werner Scholem',
         'walcher':'Jacob Walcher','heckert':'Fritz Heckert','merker':'Paul Merker','skoblevsky':'Pyotr Skoblevsky',
         'schneller':'Ernst Schneller','kippenberger':'Hans Kippenberger'}
out = []
for slot, name, sub, role, actions in SLOTS:
    out.append(f"""@{slot}
title: {name}
subtitle: {sub}
is-pinned-card: true
tags: rf_advisor
new-page: true
on-arrival: {{! window.RF.advisorView(Q, '{slot}'); !}}

= {name}

[+ adv_text +]

""" + ''.join(f"- @{slot}_{a[0]}\n" for a in actions) + f"- @rf_appoint_{slot}\n- @rf_hand: Back.\n")
    for aid, title, asub, choose, unav, js, text in actions:
        out.append(f"""@{slot}_{aid}
title: {title}
subtitle: {asub}
view-if: adv_ready = 1
new-page: true
""" + (f"choose-if: {choose}\nunavailable-subtitle: {unav}\n" if choose else "") + f"""on-arrival: {{!
{js}
window.RF.advisorUse(Q, '{slot}');
!}}

{text}

- @rf_hand: Back to the party.
""")
    out.append(f"""@rf_appoint_{slot}
title: Appoint a new {role}.
subtitle: The old holder's faction is angered and the new one's pleased. The six-month wait stays.
new-page: true
on-arrival: {{! window.RF.advisorCandidates(Q, '{slot}'); !}}

= {name}

The post is held by [+ adv_current +]. Who should take it over?

""" + ''.join(f"- @pick_{a}\n" for a, s in ADVISORS if s == slot) + "- @rf_hand: Keep things as they are.\n")
    for a, s in ADVISORS:
        if s != slot:
            continue
        out.append(f"""@pick_{a}
title: {NAMES[a]}
subtitle: [+ pick_{a}_desc +]
view-if: pick_{a} = 1
new-page: true
on-arrival: {{! window.RF.appoint(Q, '{slot}', '{a}'); !}}

[+ appointed_name +] takes over. [+ appointed_faction +] welcomes the appointment.

- @rf_hand: Back to the party.
""")
out.append("""@replace
title: Replace an advisor
subtitle: Put someone else in one of the three posts.
is-pinned-card: true
tags: rf_advisor
new-page: true
on-arrival: {! window.RF.advisorView(Q, 'org'); !}

= Replace an Advisor

Which post should change hands? Replacing an advisor angers the faction of the one who goes and pleases the faction of the one who comes. The new holder still waits out the post's six months.

- @rf_appoint_org
- @rf_appoint_unions
- @rf_appoint_military
- @rf_hand: Back.
""")
open('source/scenes/rote_fahne/rf_advisors.scene.dry','w').write('title: Advisors\nsubtitle: The three posts in the Zentrale.\nnew-page: true\n\n= Advisors\n\nThe party\'s three posts.\n\n- @rf_hand: Back.\n\n' + '\n'.join(out))
