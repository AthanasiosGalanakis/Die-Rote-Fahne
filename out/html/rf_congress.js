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
  // are certain; the Rhineland, Hesse-Frankfurt and Halle are best guesses.
  var DISTRICTS = [
    {id: 'berlin', name: 'Berlin-Brandenburg', weight: 12, base: {right: 25, left: 70, minor: 5}},
    {id: 'wasserkante', name: 'Wasserkante (Hamburg)', weight: 7, base: {right: 30, left: 65, minor: 5}},
    {id: 'ruhr', name: 'Ruhr', weight: 11, base: {right: 50, left: 42, minor: 8}},
    {id: 'niederrhein', name: 'Lower Rhine', weight: 6, base: {right: 60, left: 30, minor: 10}},
    {id: 'mittelrhein', name: 'Middle Rhine (Cologne)', weight: 5, base: {right: 45, left: 48, minor: 7}},
    {id: 'frankfurt', name: 'Hesse-Frankfurt', weight: 5, base: {right: 50, left: 43, minor: 7}},
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
  // KPD's public appeal, `seats` sets the Zentrale) and Moscow's reaction
  // (`moscow`: Kremlin patrons nudged; `standing`: the leadership's
  // standing). A leadership cannot table a version its own faction is
  // against; a version it is split on angers its own members.
  var MOTIONS = {
    leipzig: [
      {id: 'wg', title: 'The workers\' government',
       text: 'The main fight of the congress. The Zentrale\'s theses say that governments of Communists and left Social Democrats, like the one the party props up in Saxony, can lead the working class towards power. The Left calls them coalitions with reformists that will tie the party\'s hands.',
       options: {
         theses: {stances: {right: 'for', left: 'against', minor: 'split'},
                  effects: {spd_relation: 4, appeal: 2}, moscow: {trotsky: 3, zinoviev: -2}, standing: 2,
                  news: 'the Zentrale\'s theses on the workers\' government'},
         amended: {stances: {right: 'for', left: 'split', minor: 'for'},
                   effects: {spd_relation: 2, readiness: 2, appeal: 1}, moscow: {trotsky: 2, zinoviev: 2}, standing: 3,
                   news: 'the workers\' government theses with the commission\'s amendments'},
         counter: {stances: {right: 'against', left: 'for', minor: 'split'},
                   effects: {spd_relation: -6, readiness: 3, appeal: -1}, moscow: {zinoviev: 3, trotsky: -3}, standing: 0,
                   news: 'the Left\'s counter-theses'}
       }},
      {id: 'uf', title: 'The united front',
       text: 'How far should the united front go? The Zentrale wants to approach the SPD\'s leaders as well as its members. The Left wants to appeal to Social Democratic workers over the heads of their leaders.',
       options: {
         above: {stances: {right: 'for', left: 'against', minor: 'split'},
                 effects: {spd_relation: 5, appeal: 1}, moscow: {trotsky: 2, bukharin: 1}, standing: 1,
                 news: 'the united front from above and below'},
         below: {stances: {right: 'split', left: 'for', minor: 'for'},
                 effects: {spd_relation: -2, union_influence: 2}, moscow: {zinoviev: 3}, standing: 1,
                 news: 'the united front from below only'}
       }},
      {id: 'def', title: 'Workers\' defence',
       text: 'Fascist bands are arming in Bavaria and the occupation has inflamed the nationalists. The party proposes defence units of its own, the Proletarian Hundreds, built in the factories.',
       options: {
         hundreds: {stances: {right: 'for', left: 'for', minor: 'for'},
                    effects: {readiness: 4, repression: 2, appeal: 1}, moscow: {zinoviev: 1}, standing: 2,
                    news: 'Proletarian Hundreds in the factories'},
         unions: {stances: {right: 'split', left: 'against', minor: 'split'},
                  effects: {appeal: -1}, moscow: {zinoviev: -2}, standing: -1,
                  news: 'leaving defence to the unions'}
       }},
      {id: 'ruhr', title: 'The Ruhr',
       text: 'French and Belgian troops hold the Ruhr. The Cuno government calls for passive resistance; the nationalists call for a holy war. What is the party\'s answer?',
       options: {
         both: {stances: {right: 'for', left: 'for', minor: 'for'},
                effects: {rev_situation: 2, nationalism: -1, appeal: 1}, moscow: {}, standing: 2,
                news: '"Beat Poincaré on the Ruhr and Cuno on the Spree"'},
         french: {stances: {right: 'split', left: 'against', minor: 'against'},
                  effects: {nationalism: -3, appeal: 2, spd_relation: -1}, moscow: {trotsky: 2, zinoviev: -3}, standing: -1,
                  news: 'putting the fight against the occupiers first'}
       }},
      {id: 'zentrale', title: 'The new Zentrale',
       text: 'The congress elects the Zentrale. The majority draws up the list, and it decides how much room the opposition gets.',
       options: {
         closed: {stances: {right: 'for', left: 'against', minor: 'split'},
                  effects: {appeal: -1}, seats: {right: 19, left: 0, minor: 2}, moscow: {zinoviev: -2}, standing: -3,
                  news: 'a Zentrale of the majority alone'},
         moderate: {stances: {right: 'for', left: 'split', minor: 'for'},
                    effects: {}, seats: {right: 17, left: 3, minor: 1}, moscow: {trotsky: 1}, standing: 1,
                    news: 'a Zentrale with three moderate Leftists'},
         leaders: {stances: {right: 'split', left: 'for', minor: 'for'},
                   effects: {appeal: 1}, seats: {right: 14, left: 6, minor: 1}, moscow: {zinoviev: 3, trotsky: 1}, standing: 3,
                   news: 'a Zentrale with Fischer and Maslow in it'}
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

  // Before a motion: its text, and which versions the leadership may table
  // (Q.mo_ok_<version> = 1 or 0).
  RF.motionIntro = function(Q, congress, id) {
    var m = findMotion(congress, id);
    Q.mo_title = m.title;
    Q.mo_text = m.text;
    for (var k in m.options) {
      Q['mo_ok_' + k] = stanceOf(m.options[k], Q.leader) == 'against' ? 0 : 1;
    }
  };

  var STANCE_WORD = {'for': 'for', 'against': 'against', split: 'divided'};

  // The leadership tables a version and the delegates vote. Results go to
  // Q.mo_result (HTML) and Q.mo_passed.
  RF.motionVote = function(Q, congress, id, key) {
    var m = findMotion(congress, id);
    var o = m.options[key];
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
      for (var q in o.effects) {
        if (q == 'appeal') {
          Q.kpd_appeal = (Q.kpd_appeal || 0) + o.effects[q];
        } else {
          Q[q] = (Q[q] || 0) + o.effects[q];
        }
      }
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
    Q.mo_result = '<p><b>' + verdict + '</b></p><p class="rf-stances">' + lines.join(' · ') + '</p>';
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
}());
