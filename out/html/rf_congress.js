// Die Rote Fahne: the party's inner life. The districts, the Zentrale,
// congress motions and the Party Discussion card. Loaded after
// rote_fahne.js; scenes call these through window.RF.
(function() {
  var RF = window.RF;
  var NAMES = RF.names;

  var clamp = function(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  };
  var esc = function(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var fspan = function(f) {
    return '<span class="f-' + f + '">' + NAMES[f] + '</span>';
  };

  // ---- Districts ------------------------------------------------------------
  // The party's districts (Bezirke), weighted roughly by membership (the
  // weights add up to 100), with each faction's support in January 1923.
  // Berlin and Hamburg for the Left and Saxony and Thuringia for the Right
  // are certain. Hesse-Frankfurt and the Middle Rhine put up the Left's list
  // at Leipzig (Broué), so they lean Left; the other Rhine districts and
  // Halle are best guesses.
  var DISTRICTS = [
    {id: 'berlin', name: 'Berlin-Brandenburg', weight: 12, base: {right: 25, left: 70, minor: 5}},
    {id: 'wasserkante', name: 'Wasserkante (Hamburg)', weight: 7, base: {right: 30, left: 65, minor: 5}},
    {id: 'ruhr', name: 'Ruhr', weight: 11, base: {right: 50, left: 42, minor: 8}},
    {id: 'niederrhein', name: 'Lower Rhine', weight: 6, base: {right: 60, left: 30, minor: 10}},
    {id: 'mittelrhein', name: 'Middle Rhine (Cologne)', weight: 5, base: {right: 40, left: 53, minor: 7}},
    {id: 'frankfurt', name: 'Hesse-Frankfurt', weight: 5, base: {right: 42, left: 51, minor: 7}},
    {id: 'westsachsen', name: 'West Saxony (Leipzig)', weight: 6, base: {right: 80, left: 12, minor: 8}},
    {id: 'ostsachsen', name: 'East Saxony (Dresden)', weight: 5, base: {right: 82, left: 10, minor: 8}},
    {id: 'erzgebirge', name: 'Erzgebirge-Vogtland', weight: 7, base: {right: 85, left: 8, minor: 7}},
    {id: 'thuringia', name: 'Thuringia', weight: 7, base: {right: 80, left: 12, minor: 8}},
    {id: 'halle', name: 'Halle-Merseburg', weight: 8, base: {right: 70, left: 22, minor: 8}},
    {id: 'wurttemberg', name: 'Württemberg', weight: 5, base: {right: 75, left: 17, minor: 8}},
    {id: 'bavaria', name: 'Bavaria', weight: 4, base: {right: 72, left: 20, minor: 8}},
    {id: 'other', name: 'The smaller districts', weight: 12, base: {right: 72, left: 18, minor: 10}}
  ];
  // National strength in January 1923, which the district mixes belong to.
  var START = {right: 60, left: 32, minor: 8};
  // A faction that forms later draws on the camp it comes from.
  var PARENT = {center: 'right', ultra: 'left', stalin: 'left'};
  RF.districtList = DISTRICTS;

  // Support in a district now: its January 1923 mix, scaled by how each
  // faction has grown or shrunk nationally since.
  RF.districtShares = function(Q, d) {
    var raw = {}, sum = 0;
    for (var f of RF.factions) {
      if (!RF.active(Q, f)) {
        continue;
      }
      var root = START[f] ? f : PARENT[f];
      var v = d.base[root] * Q[f + '_strength'] / START[root];
      raw[f] = Math.max(0, v);
      sum += raw[f];
    }
    var out = {};
    for (var g in raw) {
      out[g] = sum ? 100 * raw[g] / sum : 0;
    }
    return out;
  };

  // Who holds a district: the strongest faction, or "contested" when the
  // runner-up is within ten points.
  RF.districtHolder = function(Q, d) {
    var s = RF.districtShares(Q, d);
    var order = Object.keys(s).sort(function(a, b) { return s[b] - s[a]; });
    return {holder: order[0], contested: order.length > 1 && s[order[0]] - s[order[1]] < 10, shares: s};
  };

  // Congress delegates in percent. District conferences tend to elect the
  // local majority's people, so each district's shares are sharpened
  // (to the power 1.5) before they are weighted.
  RF.delegateShares = function(Q) {
    var total = {}, sum = 0;
    for (var d of DISTRICTS) {
      var s = RF.districtShares(Q, d), part = {}, psum = 0;
      for (var f in s) {
        part[f] = Math.pow(s[f], 1.5);
        psum += part[f];
      }
      for (var g in part) {
        total[g] = (total[g] || 0) + d.weight * part[g] / psum;
        sum += d.weight * part[g] / psum;
      }
    }
    var out = {};
    for (var h in total) {
      out[h] = Math.round(100 * total[h] / sum);
    }
    return out;
  };

  var SHORT = {right: 'Right', center: 'Middle Group', left: 'Left', ultra: 'Ultra-Left',
               stalin: 'Thälmann', minor: 'Minor'};

  // The districts and who holds them, as a table.
  RF.districtsHtml = function(Q) {
    var html = '<table class="rf-table rf-districts">';
    for (var d of DISTRICTS) {
      var h = RF.districtHolder(Q, d);
      html += '<tr><td>' + esc(d.name) + '</td><td class="rf-num">' +
          (h.contested ? '<span class="rf-contested">contested</span>' :
           '<span class="f-' + h.holder + '">' + SHORT[h.holder] + '</span>') + '</td></tr>';
    }
    return html + '</table>';
  };

  RF.renderDistricts = function(Q) {
    var el = document.getElementById('rf-districts');
    if (el) {
      el.innerHTML = RF.districtsHtml(Q);
    }
  };

  // A legend for a hemicycle of factions: names with their shares.
  RF.factionLegend = function(shares) {
    return Object.keys(shares).filter(function(f) { return shares[f] > 0; }).map(function(f) {
      return fspan(f);
    }).join(' · ');
  };

  // ---- The Zentrale -----------------------------------------------------------
  // Seats per faction, kept as JSON in Q.zentrale. A faction with fewer
  // seats than its strength deserves grows angrier each month; a fairly
  // represented one calms down.
  RF.zentrale = function(Q) {
    try {
      return JSON.parse(Q.zentrale || '{}');
    } catch (e) {
      return {};
    }
  };

  RF.setZentrale = function(Q, seats) {
    Q.zentrale = JSON.stringify(seats);
  };

  RF.zentraleText = function(Q) {
    var z = RF.zentrale(Q), total = 0, parts = [];
    for (var f of ['right', 'center', 'left', 'ultra', 'stalin', 'minor']) {
      if (z[f]) {
        total += z[f];
        parts.push(z[f] + ' ' + fspan(f));
      }
    }
    return total + ' members: ' + parts.join(', ');
  };

  // Called once a month from rf_post_event.
  RF.monthlyParty = function(Q) {
    var z = RF.zentrale(Q), total = 0;
    for (var f in z) {
      total += z[f];
    }
    for (var g of RF.factions) {
      if (g == Q.leader || !RF.active(Q, g)) {
        continue;
      }
      var seatShare = total ? 100 * (z[g] || 0) / total : 0;
      Q[g + '_dissent'] += clamp(0.3 + (Q[g + '_strength'] - seatShare) / 20, -1, 1.5);
    }
    // the party's appeal fades back towards neutral
    Q.kpd_appeal = (Q.kpd_appeal || 0) * 0.95;
  };

  // ---- Congress motions -------------------------------------------------------
  // Each motion has versions the leadership can table. Each version gives
  // every faction's stance (for, against or split; a faction not named is
  // split), the effects if it passes (added to qualities; `appeal` is the
  // KPD's public appeal, `seats` sets the Zentrale), Moscow's reaction
  // (`moscow`: Kremlin patrons nudged; `standing`: the leadership's
  // standing) and `pass`, a line of what follows. A leadership cannot table
  // a version its own faction is against, nor one whose `need` returns a
  // reason; a version it is split on angers its own members.
  // An `incident` has no vote: its effects apply at once and `pass` is shown.
  var MOTIONS = {
    leipzig: [
      {id: 'agenda', title: 'The order of business',
       text: 'Before the first report is read, Ruth Fischer rises for Berlin-Brandenburg. The French have been in Essen for a fortnight, she says, and the congress means to spend its days on theses drafted before a single soldier crossed the Rhine. Berlin wants the occupation, and what the party should do about it, at the head of the agenda. On the platform Brandler hears the demand for what it is: a motion of no confidence in the Zentrale, dressed as a point of order.',
       options: {
         keep: {stances: {right: 'for', left: 'against', minor: 'split'},
                effects: {}, moscow: {}, standing: 1,
                news: 'the agenda as the Zentrale drew it up',
                pass: 'The agenda stands. The Ruhr will be spoken of in the political report and nowhere else, and the Berlin benches make sure everyone knows what they think of that.'},
         report: {stances: {right: 'for', left: 'split', minor: 'for'},
                  effects: {}, moscow: {}, standing: 1,
                  news: 'a debate on the Ruhr within the political report',
                  pass: 'Brandler promises the occupation its full hour in his report. Berlin has its debate, on ground the Zentrale has chosen.'},
         ruhr: {stances: {right: 'split', left: 'for', minor: 'for'},
                effects: {rev_situation: 1}, moscow: {zinoviev: 2}, standing: 0,
                news: 'a debate on the Ruhr at the head of the agenda',
                pass: 'The occupation goes first. Before the Zentrale has made its case, it must defend its record on the Ruhr against delegates who have come straight from the pits.'}
       }},
      {id: 'floor', title: 'A personal statement', incident: true,
       text: 'On the third day Ruth Fischer asks for the floor to make a personal statement, and then speaks for the whole of Berlin-Brandenburg. The Zentrale is passive, opportunist, revisionist; it wants to reconcile bourgeois democracy with the dictatorship of the proletariat. "We will carry on the fight. Howl, if you like." Arthur Stolzenburg, in the chair, tries to cut her off. Maslow demands that the chair be replaced. Half the hall is on its feet.',
       options: {
         cut: {effects: {left_dissent: 6, right_dissent: -2},
               pass: 'Stolzenburg rules her out of order and the session is suspended amid the uproar. When it resumes, the Berlin delegates sit in a silence that says more than any speech.'},
         pieck: {effects: {left_dissent: -1, right_dissent: 1},
                 pass: 'Pieck speaks of a misunderstanding, of comrades who have all said more than they meant. Nobody believes it, but the hall sits down again and the congress returns to its agenda.'},
         hear: {effects: {left_dissent: -4, right_dissent: 4},
                need: function(Q) {
                  return Q.right_dissent >= 25 ? 'The majority\'s delegates are in no mood to sit through another hour of Ruth Fischer.' : '';
                },
                pass: 'The chair lets her finish. The Saxons and Thuringians sit through it with folded arms, and when she steps down the Berliners cheer her like a victor.'}
       }},
      {id: 'wg', title: 'The workers\' government',
       text: 'Brandler gives the main report. Since the International\'s Fourth Congress the party has a slogan, the workers\' government, and no agreement on what it means. The Zentrale\'s theses call it a road to power: governments of Communists and left Social Democrats, born of the workers\' struggle and backed by their councils, of the kind that might yet be formed in Dresden. Maslow answers for the Left. A workers\' government with the reformists, he says, is a parliamentary coalition by another name, and the question cannot be put at all unless the party is working towards civil war.',
       options: {
         theses: {stances: {right: 'for', left: 'against', minor: 'split'},
                  effects: {spd_relation: 4, appeal: 2}, moscow: {trotsky: 3, zinoviev: -2}, standing: 2,
                  news: 'the Zentrale\'s theses on the workers\' government',
                  pass: 'The theses go out to the districts as the party\'s line. In Dresden, Social Democrats who had sworn never to govern with Communist votes start asking what the Communists would want in return.'},
         amended: {stances: {right: 'for', left: 'split', minor: 'for'},
                   effects: {spd_relation: 2, readiness: 2, appeal: 1}, moscow: {trotsky: 2, zinoviev: 2}, standing: 3,
                   news: 'the workers\' government theses with the commission\'s amendments',
                   pass: 'The commission\'s wording goes through: a workers\' government is a step, not a road, and no Communist sits in one without the International\'s leave. Radek is pleased with his drafting.'},
         counter: {stances: {right: 'against', left: 'for', minor: 'split'},
                   effects: {spd_relation: -6, readiness: 3, appeal: -1}, moscow: {zinoviev: 3, trotsky: -3}, standing: 0,
                   news: 'the Left\'s counter-theses',
                   pass: 'The congress adopts Maslow\'s counter-theses. The Vorwärts calls it proof that the Communists never meant their offers seriously.'}
       }},
      {id: 'uf', title: 'The united front',
       text: 'How far should the united front go? Since the murder of Rathenau the Zentrale has sat at the same tables as the SPD and the trade union leaders, and come away with little to show for it. The Left wants no more letters to Wels and Dittmann: the party should speak to Social Democratic workers in the factories, over the heads of the men who betray them.',
       options: {
         above: {stances: {right: 'for', left: 'against', minor: 'split'},
                 effects: {spd_relation: 5, appeal: 1}, moscow: {trotsky: 2, bukharin: 1}, standing: 1,
                 news: 'the united front from above and below',
                 pass: 'The party will keep knocking at the SPD\'s door, and make sure every Social Democratic worker hears when it is shut.'},
         below: {stances: {right: 'split', left: 'for', minor: 'for'},
                 effects: {spd_relation: -2, union_influence: 2}, moscow: {zinoviev: 3}, standing: 1,
                 news: 'the united front from below only',
                 pass: 'No more letters to the SPD Executive. The party\'s cells will take the united front into the works and the union branches themselves.'},
         appeal: {stances: {right: 'for', left: 'against', minor: 'split'},
                  effects: {spd_relation: 4, appeal: 2}, moscow: {trotsky: 1, zinoviev: -2}, standing: 1,
                  need: function(Q) {
                    return Q.spd_relation < 38 ? 'The SPD Executive has turned down every offer since the summer; the delegates would laugh the motion off the floor.' : '';
                  },
                  news: 'an open offer to the SPD of a common fight against Cuno and the occupation',
                  pass: 'The Zentrale will send the SPD Executive an open letter the day the congress closes, offering a common fight against the occupation and the Cuno government. Whatever the answer, it will be read out in every works meeting in the country.'}
       }},
      {id: 'def', title: 'Workers\' defence',
       text: 'In the autumn Mussolini\'s blackshirts marched on Rome. In Bavaria the völkisch leagues drill in the open, and this same week Hitler\'s National Socialists are holding a rally in Munich under a forest of flags. Brandler puts the fascist danger at the centre of his report: the workers must be ready to defend themselves before it is too late. The question is who should do the defending, and under whose command.',
       options: {
         hundreds: {stances: {right: 'for', left: 'for', minor: 'for'},
                    effects: {readiness: 4, repression: 2, appeal: 1}, moscow: {zinoviev: 1}, standing: 2,
                    news: 'Proletarian Hundreds in the factories',
                    pass: 'Workers\' Hundreds are to be elected in the factories, Social Democrats and non-party men alongside Communists. The police in Prussia have already started counting them.'},
         unions: {stances: {right: 'split', left: 'against', minor: 'split'},
                  effects: {appeal: -1}, moscow: {zinoviev: -2}, standing: -1,
                  news: 'leaving defence to the unions',
                  pass: 'The party will press the unions to organise the defence. Union secretaries promise to look into it.'},
         armed: {stances: {right: 'split', left: 'for', minor: 'against'},
                 effects: {readiness: 6, repression: 4, spd_relation: -2, appeal: -1}, moscow: {zinoviev: 2}, standing: 0,
                 need: function(Q) {
                   return Q.readiness < 12 ? 'The party has neither the rifles nor the trained men; its military apparatus exists mostly on paper.' : '';
                 },
                 news: 'armed squads under the party\'s own command',
                 pass: 'Picked comrades are to be formed into squads, with hidden rifles and a chain of command that runs to the Zentrale. Few in the hall will say aloud what they are for.'}
       }},
      {id: 'ruhr', title: 'The Ruhr',
       text: 'The miners of the Ruhr are on passive resistance, and the Cuno government pays their wages with banknotes that are worth less every evening than they were in the morning. The industrialists who refused the French their coal are the same men who refused the miners their eight-hour day. The nationalist papers call for a holy war. What does the party say to a worker in Essen?',
       options: {
         both: {stances: {right: 'for', left: 'for', minor: 'for'},
                effects: {rev_situation: 2, nationalism: -1, appeal: 1}, moscow: {}, standing: 2,
                news: 'the fight against the occupiers and against Cuno alike',
                pass: 'The party\'s line is set: the enemy sits in Paris and in Berlin alike, and the workers will not die for Stinnes\'s coal.'},
         french: {stances: {right: 'split', left: 'against', minor: 'against'},
                  effects: {nationalism: -3, appeal: 2, spd_relation: -1}, moscow: {trotsky: 2, zinoviev: -3}, standing: -1,
                  news: 'putting the fight against the occupiers first',
                  pass: 'The party will stand against the French with the whole nation, and settle accounts with Cuno afterwards. In Berlin, the Left calls it national Bolshevism.'},
         republic: {stances: {right: 'split', left: 'for', minor: 'against'},
                    effects: {rev_situation: 4, readiness: 3, repression: 5, spd_relation: -4, appeal: -1}, moscow: {zinoviev: 3, trotsky: -2}, standing: -1,
                    need: function(Q) {
                      return Q.mo_leipzig_agenda != 'ruhr' ? 'The occupation was never put to the congress on its own; no delegate will vote for a rising on a question the congress never debated.' : '';
                    },
                    news: 'a call for a workers\' republic on the Ruhr',
                    pass: 'The congress calls on the Ruhr to take the pits and the works into its own hands and arm the miners. The French and the Reich will both have heard it by morning.'}
       }},
      {id: 'zentrale', title: 'The new Zentrale',
       text: 'The outgoing Zentrale proposes to grow from fourteen members to twenty-one. Its list names no one from the Left, and it leaves out Ernst Meyer, who has led the Zentrale since Jena and whom Berlin has attacked all week. The Left holds about a third of the mandates and demands seats in proportion; Berlin, Hamburg and Cologne say they will not vote otherwise. Through the night Radek and Kolarov press Brandler to make room.',
       options: {
         closed: {stances: {right: 'for', left: 'against', minor: 'split'},
                  effects: {appeal: -1}, seats: {right: 20, left: 0, minor: 1}, moscow: {zinoviev: -2}, standing: -3,
                  news: 'a Zentrale of the majority alone',
                  pass: 'The twenty-one are elected as drafted. A third of the party has no voice in its leadership, and Radek\'s report to Moscow will say so.'},
         moderate: {stances: {right: 'for', left: 'split', minor: 'for'},
                    effects: {}, seats: {right: 17, left: 3, minor: 1}, moscow: {trotsky: 1}, standing: 1,
                    news: 'a Zentrale with three men from the Left',
                    pass: 'Ewert, Lindau and Pfeiffer go onto the list. The Left says it does not count them as its own: Lindau is too mild, and Ewert is Radek\'s man.'},
         leaders: {stances: {right: 'split', left: 'for', minor: 'for'},
                   effects: {appeal: 1}, seats: {right: 14, left: 6, minor: 1}, moscow: {zinoviev: 3, trotsky: 1}, standing: 3,
                   need: function(Q) {
                     return Q.right_dissent >= 20 ? 'After a week of Ruth Fischer\'s speeches, the majority\'s delegates will not hear of her in the Zentrale.' : '';
                   },
                   news: 'a Zentrale with Ruth Fischer and the Left\'s own candidates',
                   pass: 'Ruth Fischer, Geschke, Katz and König sit down at the same table as Brandler. Whether it is a truce or a siege, nobody can yet say.'}
       }}
    ]
  };
  RF.motions = MOTIONS;

  var findMotion = function(congress, id) {
    for (var m of MOTIONS[congress]) {
      if (m.id == id) {
        return m;
      }
    }
    return null;
  };

  var stanceOf = function(o, f) {
    return o.stances[f] || 'split';
  };

  var STANCE_WORD = {'for': 'for', 'against': 'against', split: 'divided'};

  // Before a motion: its text, which versions the leadership may table
  // (Q.mo_ok_<motion>_<version> = 1 or 0, with the reason in mo_why_*) and
  // how the factions stand on each (mo_st_*).
  RF.motionIntro = function(Q, congress, id) {
    var m = findMotion(congress, id);
    var del = RF.delegateShares(Q);
    Q.mo_title = m.title;
    Q.mo_text = m.text;
    for (var k in m.options) {
      var o = m.options[k], key = id + '_' + k;
      var why = m.incident ? '' :
          stanceOf(o, Q.leader) == 'against' ? 'The Zentrale\'s own people will not put their names to it.' : '';
      why = why || (o.need ? o.need(Q) : '');
      Q['mo_ok_' + key] = why ? 0 : 1;
      Q['mo_why_' + key] = why;
      Q['mo_st_' + key] = m.incident ? '<span></span>' : '<br><span class="rf-stances">' + Object.keys(del).map(function(f) {
        return fspan(f) + ' ' + STANCE_WORD[stanceOf(o, f)];
      }).join(' · ') + '</span>';
    }
  };

  var applyEffects = function(Q, effects) {
    for (var q in effects) {
      if (q == 'appeal') {
        Q.kpd_appeal = (Q.kpd_appeal || 0) + effects[q];
      } else {
        Q[q] = (Q[q] || 0) + effects[q];
      }
    }
  };

  // The leadership tables a version and the delegates vote. Results go to
  // Q.mo_result (HTML) and Q.mo_passed.
  RF.motionVote = function(Q, congress, id, key) {
    var m = findMotion(congress, id);
    var o = m.options[key];
    if (m.incident) {
      applyEffects(Q, o.effects);
      Q.mo_passed = 1;
      Q.mo_result = '<p>' + o.pass + '</p>';
      Q['mo_' + congress + '_' + id] = key;
      RF.normalize(Q);
      return;
    }
    var del = RF.delegateShares(Q);
    var yes = 0;
    var lines = [];
    for (var f in del) {
      var st = stanceOf(o, f);
      yes += st == 'for' ? del[f] : st == 'split' ? del[f] / 2 : 0;
      lines.push(fspan(f) + ' ' + STANCE_WORD[st]);
    }
    var passed = yes > 50;
    Q.mo_passed = passed ? 1 : 0;
    // the leadership's own members dislike a compromise it tabled
    if (stanceOf(o, Q.leader) == 'split') {
      Q[Q.leader + '_dissent'] += 4;
    }
    for (var g in del) {
      var s = stanceOf(o, g);
      if (passed) {
        Q[g + '_dissent'] += s == 'for' ? -3 : s == 'against' ? 5 : 0;
      } else {
        Q[g + '_dissent'] += s == 'for' ? 3 : s == 'against' ? -2 : 0;
      }
    }
    if (passed) {
      applyEffects(Q, o.effects);
      if (o.seats) {
        RF.setZentrale(Q, o.seats);
      }
      for (var p in o.moscow || {}) {
        RF.nudgePatron(Q, p, o.moscow[p]);
      }
      Q[Q.leader + '_moscow'] += o.standing || 0;
    } else {
      // a defeat on the floor embarrasses the leadership
      Q[Q.leader + '_dissent'] += 3;
      Q[Q.leader + '_moscow'] -= 2;
      Q.kpd_appeal = (Q.kpd_appeal || 0) - 1;
    }
    var verdict = !passed ? 'Defeated.' : yes >= 85 ? 'Carried almost unanimously.' :
        yes >= 65 ? 'Carried by a large majority.' : yes >= 55 ? 'Carried.' : 'Carried narrowly.';
    var after = passed ? o.pass : 'The Zentrale has been beaten on its own motion. The delegates leave the hall arguing, and the press of every other party will make the most of it.';
    Q.mo_result = '<p><b>' + verdict + '</b></p><p class="rf-stances">' + lines.join(' · ') + '</p><p>' + after + '</p>';
    Q['mo_' + congress + '_' + id] = passed ? key : '';
    if (passed) {
      var list = Q.mo_passed_news ? Q.mo_passed_news.split('|') : [];
      list.push(o.news);
      Q.mo_passed_news = list.join('|');
    }
    RF.normalize(Q);
  };

  // What the congress decided, as one sentence.
  RF.motionSummary = function(Q) {
    var list = Q.mo_passed_news ? Q.mo_passed_news.split('|') : [];
    if (!list.length) {
      return 'The congress passed none of the leadership\'s motions.';
    }
    var last = list.pop();
    return 'The congress adopted ' + (list.length ? list.join(', ') + ' and ' + last : last) + '.';
  };

  // ---- Party Discussion ----------------------------------------------------
  // The party press opens a debate and the Zentrale backs one faction's
  // theses. Each faction's theses push the party its way.
  var THESES = {
    right: {effects: {spd_relation: 2, appeal: 1}, patron: 'trotsky'},
    left: {effects: {readiness: 1, spd_relation: -1}, patron: 'zinoviev'},
    minor: {effects: {union_influence: 1}, patron: null},
    center: {effects: {}, patron: 'bukharin', calm: 1},
    ultra: {effects: {autonomy: 2}, patron: null},
    stalin: {effects: {apparatus: 1}, patron: 'stalin', obey: 1}
  };

  // Which theses the Zentrale can back now (Q.pd_ok_<faction>): its own
  // always; a rival's only while its own faction will stand for it.
  RF.discussionPrep = function(Q) {
    for (var f of RF.factions) {
      Q['pd_ok_' + f] = RF.active(Q, f) && (f == Q.leader || Q[Q.leader + '_dissent'] < 50) ? 1 : 0;
    }
  };

  RF.discussion = function(Q, f) {
    var t = THESES[f];
    var e = {};
    e[f] = 3;
    RF.lean(Q, e);
    if (f != Q.leader) {
      Q[Q.leader + '_dissent'] += 4;
    }
    for (var q in t.effects) {
      if (q == 'appeal') {
        Q.kpd_appeal = (Q.kpd_appeal || 0) + t.effects[q];
      } else {
        Q[q] = (Q[q] || 0) + t.effects[q];
      }
    }
    if (t.calm) {
      for (var g of RF.factions) {
        Q[g + '_dissent'] -= 1;
      }
    }
    if (t.obey) {
      Q[Q.leader + '_moscow'] += 2;
      Q.autonomy -= 1;
    }
    if (t.patron) {
      RF.nudgePatron(Q, t.patron, 1);
    }
    Q.month_actions += 1;
    Q.pd_faction_name = NAMES[f];
    RF.normalize(Q);
  };
  // ---- People of the congress ----------------------------------------------
  // KPD leaders and Comintern envoys who appear at Leipzig (class m-<id>).
  Object.assign(RF.people, {
    brandler: {name: 'Heinrich Brandler', party: 'kpd', role: [[1923, 1, 'Leader of the Zentrale\'s majority'], [1923, 2, 'Chairman of the Zentrale']],
               text: [[1923, 1, 'A mason from Chemnitz, union organiser and old Spartacist, back from Moscow with Radek\'s confidence. He believes the German workers must be won before they can be led, and that the party is not yet strong enough to fight alone.']]},
    thalheimer: {name: 'August Thalheimer', party: 'kpd', role: 'Theorist of the Zentrale',
                 text: [[1923, 1, 'Brandler\'s closest comrade and the party\'s best-read Marxist, a Swabian who learned his politics beside Rosa Luxemburg. He writes most of what the Zentrale puts its name to.']]},
    meyer: {name: 'Ernst Meyer', party: 'kpd', role: [[1923, 1, 'Chairman of the Zentrale'], [1923, 2, 'Former chairman of the Zentrale']],
            text: [[1923, 1, 'Has led the Zentrale since Jena. A careful, conciliatory organiser whom the Left blames for every compromise of the past year, and whom the majority is ready to let fall.']]},
    pieck: {name: 'Wilhelm Pieck', party: 'kpd', role: 'Member of the Zentrale',
            text: [[1923, 1, 'A carpenter from Guben and one of the founders of the party, who was arrested with Liebknecht and Luxemburg on the night they were murdered. He has a gift for ending quarrels without settling them.']]},
    fischer: {name: 'Ruth Fischer', party: 'kpd', role: 'Leader of the Berlin organisation',
              text: [[1923, 1, 'Twenty-seven, Viennese, a founder of the Austrian party and now the voice of Berlin-Brandenburg. A dazzling speaker who calls the Zentrale opportunist to its face and is cheered for it in every working-class district of Berlin.']]},
    maslow: {name: 'Arkadi Maslow', party: 'kpd', role: 'Theorist of the Left',
             text: [[1923, 1, 'Born in Russia, trained as a pianist and a mathematician, Ruth Fischer\'s partner and the Left\'s sharpest mind. Many in the Zentrale distrust him as a man from nowhere.']]},
    kolarov: {name: 'Vasil Kolarov', party: 'comintern', role: 'Secretary of the International',
              text: [[1923, 1, 'A Bulgarian lawyer and the International\'s General Secretary, sent to Leipzig with Radek. He speaks for the Executive and says less than Radek does.']]}
  });
}());
