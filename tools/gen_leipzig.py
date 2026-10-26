# Generates source/scenes/rote_fahne/events/rf_leipzig.scene.dry: the
# Eighth Party Congress (Leipzig, January 1923) as a run of motions. Run
# from the repository root:
#   python3 tools/gen_leipzig.py
# The votes and effects live in RF.motions.leipzig (out/html/rf_congress.js);
# keep the stances in the subtitles below in step with it.
R = '<span class="f-right">Right</span>'
L = '<span class="f-left">Left</span>'
M = '<span class="f-minor">Minor currents</span>'


def st(r, l, m):
    return f"{R} {r}, {L} {l}, {M} {m}."


NO = "The Right will not table this: it goes against its core ideas."

# (motion id, heading, next label, [(version, title, subtitle, historical)])
MOTIONS = [
    ('wg', "The workers' government", "Next: the united front.", [
        ('theses', "Table the Zentrale's theses as drafted.",
         st('for', 'against', 'divided') + " SPD relations and the party's appeal up; Radek pleased, Zinoviev cool.", True),
        ('amended', "Table the theses with the commission's amendments: \"a step, not a road\".",
         st('for', 'divided', 'for') + " A smaller gain with the SPD, a little readiness; Radek and Zinoviev both pleased.", False),
        ('counter', "Table the Left's counter-theses.",
         st('against', 'for', 'divided') + " Breaks with the SPD; Zinoviev pleased.", False),
    ]),
    ('uf', "The united front", "Next: workers' defence.", [
        ('above', "The united front from above and below.",
         st('for', 'against', 'divided') + " SPD relations up; Radek pleased.", True),
        ('below', "The united front from below only.",
         st('divided', 'for', 'for') + " Unions up, SPD relations down; Zinoviev pleased. Your own faction grumbles.", False),
    ]),
    ('def', "Workers' defence", "Next: the Ruhr.", [
        ('hundreds', "Proletarian Hundreds in the factories, open to all workers.",
         st('for', 'for', 'for') + " Readiness up; the police take note.", True),
        ('unions', "Leave defence to the trade unions for now.",
         st('divided', 'against', 'divided') + " No risk, but the party looks timid. Your own faction grumbles.", False),
    ]),
    ('ruhr', "The Ruhr", "Next: the new Zentrale.", [
        ('both', "\"Beat Poincaré on the Ruhr and Cuno on the Spree.\"",
         st('for', 'for', 'for') + " The revolutionary mood rises; nationalism dips.", True),
        ('french', "Put the fight against the French occupiers first.",
         st('divided', 'against', 'against') + " Wins some nationalist-minded workers; the Left and Zinoviev object.", False),
    ]),
    ('zentrale', "The new Zentrale", "Close the congress.", [
        ('closed', "The majority's list only: shut the Left out.",
         st('for', 'against', 'divided') + " The Right is calm, the Left furious; Moscow dislikes the split.", False),
        ('moderate', "Make room for three moderate Leftists.",
         st('for', 'divided', 'for') + " The Left grumbles less.", True),
        ('leaders', "Bring in the Left's leaders, Fischer and Maslow.",
         st('divided', 'for', 'for') + " The Left calms down and Moscow approves; your own faction grumbles.", False),
    ]),
]

out = [r"""title: The Leipzig Congress
subtitle: The Eighth Party Congress meets at the end of January.
new-page: true
tags: rf_event
view-if: congress_number = 8 and time >= 2
max-visits: 1
priority: 3
on-arrival: {!
var RF = window.RF;
RF.normalize(Q);
Q.mo_passed_news = '';
var d = RF.delegateShares(Q);
Q.leipzig_delegates = RF.delegateHemicycle(d, 150);
Q.leipzig_legend = RF.factionLegend(d);
Q.leipzig_districts = RF.districtsHtml(Q);
!}

= The Eighth Party Congress, Leipzig

The delegates meet in Leipzig from 28 January, a fortnight after the French marched into the Ruhr. They come from the districts, and each district sends mostly its own majority's people.

{!<div class="rf-district-wrap">!}[+ leipzig_districts +]{!</div>!}

{!<div class="rf-delegates">!}[+ leipzig_delegates +]{!<div class="rf-legend">!}[+ leipzig_legend +]{!</div></div>!}

The <span class="f-right">Brandler Right</span> has the majority, and the Zentrale's motions will decide the line. You decide which version of each motion the Zentrale tables. The factions vote by their convictions: the Right will not table what it stands against, and every compromise costs it some patience. <span class="m-radek rf-person col-comintern">Karl Radek</span> is here for the International.

- @wg: Open the debate.

"""]

for i, (mid, head, nxt, opts) in enumerate(MOTIONS):
    out.append(f"""@{mid}
title: {head}
new-page: true
on-arrival: {{! window.RF.motionIntro(Q, 'leipzig', '{mid}'); !}}

= {head}

[+ mo_text +]

""")
    for key, title, sub, hist in opts:
        out.append(f"- @{mid}_{key}\n")
    out.append("\n")
    for key, title, sub, hist in opts:
        out.append(f"""@{mid}_{key}
title: {title}
subtitle: {sub}
choose-if: mo_ok_{key} = 1
unavailable-subtitle: {NO}
on-arrival: {{! window.RF.motionVote(Q, 'leipzig', '{mid}', '{key}'); !}}
go-to: {mid}_done

""")
    target = MOTIONS[i + 1][0] if i + 1 < len(MOTIONS) else 'close'
    out.append(f"""@{mid}_done
new-page: true

= {head}

[+ mo_result +]

- @{target}: {nxt}

""")

out.append(r"""@close
new-page: true
on-arrival: {!
var RF = window.RF;
Q.congress_before = Q.leader;
Q.moscow_overruled = 0;
Q.moscow_rejected = 0;
Q.leipzig_summary = RF.motionSummary(Q);
var z = RF.zentrale(Q);
Q.leipzig_zentrale = RF.delegateHemicycle(z, Object.keys(z).reduce(function(a, f) { return a + z[f]; }, 0), 'Zentrale');
Q.leipzig_zentrale_text = RF.zentraleText(Q);
Q.leipzig_left_mood = Q.left_dissent >= 50 ? 2 : Q.left_dissent >= 30 ? 1 : 0;
RF.congressDone(Q);
!}

= The Congress Closes

[+ leipzig_summary +]

{!<div class="rf-delegates">!}[+ leipzig_zentrale +]{!</div>!}

The new Zentrale has [+ leipzig_zentrale_text +]. The <span class="f-right">Brandler Right</span> keeps the leadership.

[? if leipzig_left_mood = 2 : The Left leaves Leipzig bitter. In Berlin and Hamburg its people talk of a leadership that has shut them out, and Radek reports to Moscow that the party is close to a split. ?][? if leipzig_left_mood = 1 : The Left goes home outvoted but still inside the tent. Radek reports to Moscow that the split has been avoided, for now. ?][? if leipzig_left_mood = 0 : Even the Left goes home half satisfied. Radek reports to Moscow that the German party has come out of Leipzig united. ?]

The next congress is due in about a year.
""")

with open('source/scenes/rote_fahne/events/rf_leipzig.scene.dry', 'w') as f:
    f.write(''.join(out).rstrip() + '\n')
