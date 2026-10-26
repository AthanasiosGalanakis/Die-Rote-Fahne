# Generates source/scenes/rote_fahne/events/rf_leipzig.scene.dry: the
# Eighth Party Congress (Leipzig, 28 January to 1 February 1923) as a run
# of motions. Run from the repository root:
#   python3 tools/gen_leipzig.py
# The texts, stances, effects and the reasons a version is unavailable live
# in RF.motions.leipzig (out/html/rf_congress.js); this file only holds the
# choice titles and subtitles. The keys must match.


def p(pid, name):
    return f'<span class="m-{pid} rf-person">{name}</span>'


# (motion id, next label, [(version, title, subtitle)])
MOTIONS = [
    ('agenda', "Next: the hall.", [
        ('keep', "Hold to the agenda as the Zentrale drew it up.",
         "The Ruhr will have its place in the political report, and nowhere else."),
        ('report', "Promise the Ruhr a full hour in the political report.",
         "Brandler will answer Berlin from the rostrum, on ground of his choosing."),
        ('ruhr', "Give the occupation a debate of its own, first on the agenda.",
         "Berlin gets its debate, and the Zentrale must defend its record before it has made its case."),
    ]),
    ('floor', "Next: the workers' government.", [
        ('cut', "Back the chair and have her ruled out of order.",
         "Order will be restored. Berlin will not forget how."),
        ('pieck', f"Send {p('pieck', 'Wilhelm Pieck')} to the rostrum to calm the hall.",
         "Old Pieck has smoothed over worse quarrels than this one."),
        ('hear', "Let her speak to the end.",
         "The majority will sit through it, if not quietly."),
    ]),
    ('wg', "Next: the united front.", [
        ('theses', "Table the Zentrale's theses as drafted.",
         "A workers' government is a road to power, and Saxony is where the road begins."),
        ('amended', "Table the theses with the commission's amendments: \"a step, not a road\".",
         "Such a government can only be born of the workers' struggle, and no Communist sits in it without the International's leave."),
        ('counter', f"Table {p('maslow', 'Maslow')}'s counter-theses.",
         "No coalitions with reformists: the workers' government is another name for the dictatorship of the proletariat, or it is nothing."),
    ]),
    ('uf', "Next: workers' defence.", [
        ('above', "The united front from above and below.",
         "Approach the SPD's leaders, and make sure their members hear it when the leaders say no."),
        ('below', "The united front from below only.",
         "Over the heads of Wels and Dittmann, straight to the Social Democratic workers in the factories."),
        ('appeal', "Offer the SPD a common fight against Cuno and the occupation.",
         "An open letter to the SPD Executive, signed by the new Zentrale on the day the congress closes."),
    ]),
    ('def', "Next: the Ruhr.", [
        ('hundreds', "Proletarian Hundreds in the factories, open to all workers.",
         "Elected by the workforce, Social Democrats and non-party men alongside Communists."),
        ('unions', "Leave defence to the trade unions for now.",
         "The unions have the numbers. Let the party push them to act."),
        ('armed', "Armed squads under the party's own command.",
         "Picked comrades, hidden rifles, and a chain of command that runs to the Zentrale."),
    ]),
    ('ruhr', "Next: the new Zentrale.", [
        ('both', "Fight the occupiers and the Cuno government alike.",
         "Against Poincaré's soldiers and against the industrialists who hide behind them, in one breath."),
        ('french', "Put the fight against the occupiers first.",
         "Stand with the whole nation against the French, and settle accounts with Cuno afterwards."),
        ('republic', "Call for a workers' republic on the Ruhr.",
         "Take the pits and the works, arm the miners, and let the Ruhr show the rest of Germany the way."),
    ]),
    ('zentrale', "Close the congress.", [
        ('closed', "Elect the majority's twenty-one as drafted.",
         "A Zentrale of one mind, and a third of the party without a voice in it."),
        ('moderate', f"Take {p('radek', 'Radek')}'s list, with Ewert, Lindau and Pfeiffer on it.",
         "Three men from the Left whom the majority can live with, and whom the Left does not count as its own."),
        ('leaders', f"Seats in proportion: {p('fischer', 'Ruth Fischer')}, Geschke, Katz and König.",
         "The Left's own candidates, put forward by Berlin, Hamburg, Frankfurt and Cologne."),
    ]),
]

INTRO = rf"""title: The Leipzig Congress
subtitle: The Eighth Party Congress meets at the end of January.
new-page: true
tags: rf_event
view-if: congress_number = 8 and time >= 2
max-visits: 1
priority: 3
on-arrival: {{!
var RF = window.RF;
RF.normalize(Q);
Q.mo_passed_news = '';
var d = RF.delegateShares(Q);
Q.leipzig_delegates = RF.delegateHemicycle(d, 150);
Q.leipzig_legend = RF.factionLegend(d);
Q.leipzig_districts = RF.districtsHtml(Q);
!}}

= The Eighth Party Congress, Leipzig

Leipzig, the last days of January 1923. A fortnight ago French and Belgian troops marched into Essen to take the coal Germany owes in reparations. The Cuno government, a cabinet of shipowners and bankers with no party behind it, has answered with passive resistance and the printing press, and the mark is falling faster than at any time since the war. Prices change between morning and evening. In Dresden the Saxon government has just fallen, and Social Democrats there are asking aloud whether they could govern with Communist votes. In Munich, this same week, Hitler's National Socialists parade under their new standards.

The party that meets here is barely four years old. It has lived through the murder of its founders, a split, a merger with the left of the Independents, a failed rising and the expulsion of its former chairman. From the International's Fourth Congress in Moscow it has brought home two slogans, the united front and the workers' government, and no agreement on what they mean. The Zentrale's majority, led by {p('brandler', 'Heinrich Brandler')} and {p('thalheimer', 'August Thalheimer')}, reads them as a patient road through the factories, the unions and governments like Saxony's. The Berlin organisation of {p('fischer', 'Ruth Fischer')} and {p('maslow', 'Arkadi Maslow')}, with Hamburg behind it, calls that opportunism dressed up as tactics. {p('radek', 'Karl Radek')} and {p('kolarov', 'Vasil Kolarov')} have come from Moscow to keep the quarrel from becoming a split.

The delegates come from the districts, and each district sends mostly its own majority's people.

{{!<div class="rf-district-wrap">!}}[+ leipzig_districts +]{{!</div>!}}

{{!<div class="rf-delegates">!}}[+ leipzig_delegates +]{{!<div class="rf-legend">!}}[+ leipzig_legend +]{{!</div></div>!}}

The motions are the Zentrale's, and it is the Zentrale that decides in what form they go before the hall. The <span class="f-right">Brandler Right</span> will not put its name to what it thinks wrong, and every concession made to Berlin is noted in the Saxon delegations.

- @agenda: Open the congress.

"""

CLOSE = rf"""@close
new-page: true
on-arrival: {{!
var RF = window.RF;
Q.congress_before = Q.leader;
Q.moscow_overruled = 0;
Q.moscow_rejected = 0;
Q.leipzig_summary = RF.motionSummary(Q);
var z = RF.zentrale(Q);
Q.leipzig_zentrale = RF.delegateHemicycle(z, Object.keys(z).reduce(function(a, f) {{ return a + z[f]; }}, 0), 'Zentrale');
Q.leipzig_zentrale_text = RF.zentraleText(Q);
Q.leipzig_left_mood = Q.left_dissent >= 50 ? 2 : Q.left_dissent >= 30 ? 1 : 0;
RF.congressDone(Q);
!}}

= The Congress Closes

[+ leipzig_summary +]

{{!<div class="rf-delegates">!}}[+ leipzig_zentrale +]{{!</div>!}}

The new Zentrale has [+ leipzig_zentrale_text +]. {p('brandler', 'Heinrich Brandler')} takes the chair in place of {p('meyer', 'Ernst Meyer')}, and the <span class="f-right">Brandler Right</span> holds the leadership.

[? if leipzig_left_mood = 2 : The Left leaves Leipzig bitter. In Berlin and Hamburg its people talk of a leadership that has shut them out, and Radek reports to Moscow that the party is close to a split. ?][? if leipzig_left_mood = 1 : The Left goes home outvoted but still inside the tent. Radek reports to Moscow that the split has been avoided, for now. ?][? if leipzig_left_mood = 0 : Even the Left goes home half satisfied. Radek reports to Moscow that the German party has come out of Leipzig united. ?]

The delegates take the night trains home to the Ruhr, to Hamburg, to the Erzgebirge. The next congress is due in about a year.
"""

out = [INTRO]
for i, (mid, nxt, opts) in enumerate(MOTIONS):
    out.append(f"""@{mid}
new-page: true
on-arrival: {{! window.RF.motionIntro(Q, 'leipzig', '{mid}'); !}}

= [+ mo_title +]

[+ mo_text +]

""")
    for key, title, sub in opts:
        out.append(f"- @{mid}_{key}\n")
    out.append("\n")
    for key, title, sub in opts:
        out.append(f"""@{mid}_{key}
title: {title}
subtitle: {sub} [+ mo_st_{mid}_{key} +]
choose-if: mo_ok_{mid}_{key} = 1
unavailable-subtitle: [+ mo_why_{mid}_{key} +]
on-arrival: {{! window.RF.motionVote(Q, 'leipzig', '{mid}', '{key}'); !}}
go-to: {mid}_done

""")
    target = MOTIONS[i + 1][0] if i + 1 < len(MOTIONS) else 'close'
    out.append(f"""@{mid}_done
new-page: true

= [+ mo_title +]

[+ mo_result +]

- @{target}: {nxt}

""")
out.append(CLOSE)

with open('source/scenes/rote_fahne/events/rf_leipzig.scene.dry', 'w') as f:
    f.write(''.join(out).rstrip() + '\n')
