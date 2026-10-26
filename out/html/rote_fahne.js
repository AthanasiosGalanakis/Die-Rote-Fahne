// Die Rote Fahne: shared rules. The player leads the KPD as a whole; the
// factions inside it grow or turn against the party line with each decision.
// Scenes call these through window.RF with the quality object Q.
(function() {
  var FACTIONS = ['right', 'center', 'left', 'ultra', 'stalin'];
  // who would chair the party for each faction: its best-known leader
  var PERSONS = {
    right: 'Heinrich Brandler',
    center: 'Hermann Remmele',
    left: 'Ruth Fischer',
    ultra: 'Werner Scholem',
    stalin: 'Ernst Thälmann'
  };
  var NAMES = {
    right: 'Brandler Right',
    center: 'Middle Group',
    left: 'Fischer–Maslow Left',
    ultra: 'Ultra-Left',
    stalin: 'Thälmann circle'
  };
  // In January 1923 the party has two camps: the Zentrale's majority around
  // Brandler and Thalheimer, and the Left opposition of Berlin and Hamburg
  // (Fischer, Maslow, Thälmann, Scholem). The other three factions only
  // form through events (scenes tagged rf_event in rote_fahne/events).
  var STARTING_FACTIONS = ['right', 'left'];

  // How much the current Comintern line favours each faction.
  var LINE_AFFINITY = {
    united_front: {right: 20, center: 10, left: 0, ultra: -10, stalin: 0},
    insurrection: {right: 5, center: 5, left: 20, ultra: 5, stalin: 10},
    bolshevization: {right: 0, center: 5, left: 20, ultra: -10, stalin: 15},
    class_against_class: {right: -15, center: -5, left: 5, ultra: 0, stalin: 25}
  };

  var clamp = function(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  };

  var RF = {
    factions: FACTIONS,
    names: NAMES,

    // A faction takes part in party life once it has formed and until it
    // is expelled. Saves from before factions could form count as formed.
    active: function(Q, f) {
      return Q[f + '_formed'] !== 0 && !Q[f + '_expelled'];
    },

    startFactions: function(Q) {
      for (var f of FACTIONS) {
        Q[f + '_formed'] = STARTING_FACTIONS.indexOf(f) >= 0 ? 1 : 0;
      }
    },

    // A new faction forms, taking a share of each faction's strength
    // (shares: {faction: fraction}).
    formFaction: function(Q, f, shares, dissent) {
      Q[f + '_formed'] = 1;
      Q[f + '_strength'] = 0;
      for (var g in shares) {
        var moved = Q[g + '_strength'] * shares[g];
        Q[g + '_strength'] -= moved;
        Q[f + '_strength'] += moved;
      }
      Q[f + '_dissent'] = dissent;
      RF.normalize(Q);
    },

    // A decision pleases some factions and angers others. A positive value
    // adds strength and calms the faction; a negative one costs it a little
    // strength and raises its dissent more.
    lean: function(Q, effects) {
      for (var f in effects) {
        if (!RF.active(Q, f)) {
          continue;
        }
        var v = effects[f];
        if (v > 0) {
          Q[f + '_strength'] += v;
          Q[f + '_dissent'] -= v;
        } else {
          Q[f + '_strength'] += v / 2;
          Q[f + '_dissent'] -= 1.5 * v;
        }
      }
    },

    // Normalise faction strength to 100 and keep every stat in range.
    normalize: function(Q) {
      var total = 0;
      for (var f of FACTIONS) {
        if (!RF.active(Q, f)) {
          Q[f + '_strength'] = 0;
        }
        Q[f + '_strength'] = Math.max(0, Q[f + '_strength']);
        total += Q[f + '_strength'];
      }
      for (var g of FACTIONS) {
        Q[g + '_strength'] = Math.round(100 * Q[g + '_strength'] / total);
        Q[g + '_dissent'] = Math.round(clamp(Q[g + '_dissent'], 0, 99));
        Q[g + '_moscow'] = Math.round(clamp(Q[g + '_moscow'], 0, 100));
      }
      var stats = ['autonomy', 'rev_situation', 'readiness',
                   'spd_relation', 'union_influence', 'repression', 'apparatus',
                   'uspd_relation', 'z_relation', 'ddp_relation', 'dvp_relation',
                   'dnvp_relation', 'nsdap_relation', 'pro_republic', 'nationalism'];
      for (var s of stats) {
        Q[s] = Math.round(clamp(Q[s], 0, 100));
      }
      Q.members = Math.round(Math.max(20, Q.members));
      Q.funds = Math.max(0, Q.funds);
      var dissent = 0;
      for (var h of FACTIONS) {
        dissent += RF.active(Q, h) ? Q[h + '_strength'] * Q[h + '_dissent'] / 100 : 0;
      }
      Q.unity = Math.round(100 - dissent);
      Q.party_dissent = 100 - Q.unity;
      RF.updateNames(Q);
      RF.updateReich(Q);
    },

    updateNames: function(Q) {
      Q.leader_name = NAMES[Q.leader];
      Q.leader_person = PERSONS[Q.leader];
      Q.favourite = RF.moscowFavourite(Q);
      Q.favourite_name = NAMES[Q.favourite];
      Q.leader_dissent = Q[Q.leader + '_dissent'];
    },

    // How Moscow rates a faction: its own standing, how well it fits the
    // line, and how powerful its patron in the Kremlin is.
    moscowScore: function(Q, f) {
      var patron = RF.patronOf(Q, f);
      return Q[f + '_moscow'] + LINE_AFFINITY[Q.line][f] + (patron ? 0.5 * RF.patronPower(Q, patron) : 0);
    },

    moscowFavourite: function(Q, exclude) {
      var best = null;
      for (var f of FACTIONS) {
        if (!RF.active(Q, f) || f == exclude) {
          continue;
        }
        if (best === null || RF.moscowScore(Q, f) > RF.moscowScore(Q, best)) {
          best = f;
        }
      }
      return best;
    },

    // A party congress votes: delegates follow strength, the sitting
    // leadership gets an apparatus bonus, and a split congress turns to the
    // Middle Group. Moscow may then demand that its favourite takes over
    // (Q.moscow_demand); the congress scene lets the party accept or refuse.
    congressVote: function(Q) {
      var winner = null, best = -1;
      var delegates = {};
      var total = 0;
      for (var f of FACTIONS) {
        if (!RF.active(Q, f)) {
          continue;
        }
        var weight = Q[f + '_strength'];
        if (f == Q.leader) {
          weight += 5 + Q.apparatus / 10;
        }
        // a faction that prepared its challenge since the last congress
        if (f == Q.congress_challenger) {
          weight += 5;
        }
        delegates[f] = weight;
        total += weight;
        if (weight > best) {
          best = weight;
          winner = f;
        }
      }
      for (var g in delegates) {
        delegates[g] = Math.round(100 * delegates[g] / total);
      }
      // delegates' shares in percent, as JSON (qualities stay plain values)
      Q.delegates = JSON.stringify(delegates);
      Q.congress_compromise = 0;
      if (Q[winner + '_strength'] < 40 && winner != 'center' && Q.center_strength >= 20 && RF.active(Q, 'center')) {
        winner = 'center';
        Q.congress_compromise = 1;
      }
      Q.congress_challenger = '';
      Q.congress_before = Q.leader;
      Q.congress_winner = winner;
      Q.congress_winner_name = NAMES[winner];
      Q.leader = winner;
      Q.moscow_overruled = 0;
      Q.moscow_rejected = 0;
      var preferred = RF.moscowFavourite(Q);
      Q.moscow_demand = preferred != winner && (Q.open_letter || RF.overruleChance(Q) >= 1) ? 1 : 0;
      if (Q.moscow_demand) {
        Q.demand_for = preferred;
        Q.demand_for_name = NAMES[preferred];
        // the delegates can refuse if the winners are strong and the party
        // still runs its own affairs; an Open Letter makes it harder
        Q.reject_strength = Math.round(Q[winner + '_strength'] + Q.autonomy / 2 + Q.apparatus / 5);
        Q.reject_needed = Q.open_letter ? 75 : 60;
        Q.can_reject = Q.reject_strength >= Q.reject_needed ? 1 : 0;
      } else if (preferred != winner) {
        Q.autonomy -= 3;
      } else {
        Q.open_letter = 0;
      }
      RF.updateNames(Q);
    },

    // The party bows to Moscow: its favourite takes the Zentrale.
    acceptDemand: function(Q) {
      Q.open_letter = 0;
      Q.moscow_rebukes = 0;
      Q[Q.leader + '_dissent'] += 20;
      Q.overruled_name = NAMES[Q.leader];
      Q.leader = Q.demand_for;
      Q.autonomy -= 10;
      Q.moscow_overruled = 1;
      Q.moscow_demand = 0;
      RF.normalize(Q);
    },

    // The congress stands by its vote. The party keeps its leadership and
    // some independence, and Moscow does not forget.
    rejectDemand: function(Q) {
      Q.autonomy += 8;
      Q[Q.leader + '_moscow'] -= 15;
      Q[Q.demand_for + '_dissent'] += 15;
      // the defiance counts as a rebuke; the next plenum decides whether
      // Moscow escalates to an Open Letter
      Q.moscow_rebukes = 1;
      Q.open_letter = 0;
      Q.moscow_rejected = 1;
      Q.defied_moscow = (Q.defied_moscow || 0) + 1;
      Q.moscow_demand = 0;
      RF.normalize(Q);
    },

    // Wraps up a congress: the news line and the date of the next one.
    congressDone: function(Q) {
      var t = Q.year * 12 + Q.month;
      Q.congress_news = RF.congressName(Q) + ', ' + RF.congressPlace(Q) + ': ' +
          (Q.moscow_overruled ? 'Moscow overturned the vote and installed the ' + NAMES[Q.leader] + '.' :
           Q.moscow_rejected ? 'the delegates defied Moscow and kept the ' + NAMES[Q.leader] + '.' :
           Q.leader == Q.congress_before ? 'the ' + NAMES[Q.leader] + ' keeps the Zentrale.' :
           'the ' + NAMES[Q.leader] + ' takes over the Zentrale.');
      Q.congress_number += 1;
      Q.congress_due = t + 14;
      Q.congress_pending = 0;
      Q.congress_postponed = 0;
      RF.normalize(Q);
    },

    // The old one-step congress, used by code that does not offer the
    // choice: the party always bows to Moscow.
    congress: function(Q) {
      RF.congressVote(Q);
      if (Q.moscow_demand) {
        RF.acceptDemand(Q);
      }
      RF.updateNames(Q);
    },

    // Obeying Moscow pleases the Thälmann circle; defying it feeds the
    // Ultra-Left and costs the leadership Moscow's favour.
    obey: function(Q, amount) {
      Q[Q.leader + '_moscow'] += amount / 2;
      Q.stalin_moscow += amount / 2;
      Q.autonomy -= amount / 2;
      RF.lean(Q, {stalin: Math.round(amount / 2), ultra: -Math.round(amount / 3)});
    },

    defy: function(Q, amount) {
      Q[Q.leader + '_moscow'] -= amount / 2;
      Q.stalin_moscow -= amount / 2;
      Q.autonomy += amount / 3;
      RF.lean(Q, {ultra: Math.round(amount / 2), stalin: -Math.round(amount / 2)});
    },

    // Move strength from one faction to another.
    shift: function(Q, from, to, amount) {
      var moved = Math.min(amount, Q[from + '_strength']);
      Q[from + '_strength'] -= moved;
      Q[to + '_strength'] += moved;
    },

    // A faction leaves the party, taking members with it.
    expel: function(Q, f) {
      Q.members -= Math.round(Q[f + '_strength'] * 1.2);
      Q.union_influence -= 4;
      Q[f + '_expelled'] = 1;
      Q.splits += 1;
      if (Q.leader == f) {
        Q.leader = RF.moscowFavourite(Q);
      }
      RF.normalize(Q);
    },

    // An armed rising against the Reich. The Reichswehr and police set the
    // bar at 140; most historians think 1923 never came close.
    rising: function(Q) {
      var score = Q.readiness + 0.5 * Q.rev_situation + 0.3 * Q.union_influence
          - 0.3 * Q.repression;
      if (Q.spd_relation >= 60) {
        score += 20;
      }
      if (Q.workers_govt) {
        score += 10;
      }
      if (Q.october_plan) {
        score += 5;
      }
      score += Math.random() * 30;
      Q.rising_score = Math.round(score);
      Q.rising_needed = 140;
      return score >= Q.rising_needed;
    }
  };


  // ---- The Reich around the party -------------------------------------
  // Act I follows the historical calendar for the Reich government; the
  // party's own choices move relations, polls and the revolutionary mood.

  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

  // Monthly average dollar rate of the paper mark in 1923, rounded
  // (after the standard tables, e.g. Holtfrerich).
  var DOLLAR_1923 = ['', 'about 18,000 marks', 'about 28,000 marks',
                     'about 21,000 marks', 'about 24,000 marks', 'about 48,000 marks',
                     'about 110,000 marks', 'about 350,000 marks',
                     'about 4.6 million marks', 'about 99 million marks',
                     'about 25 billion marks', 'about 2.2 trillion marks',
                     '4.2 trillion marks (fixed)'];

  RF.monthName = function(m) {
    return MONTHS[m];
  };

  RF.updateReich = function(Q) {
    var y = Q.year, m = Q.month;
    var t = y * 12 + m;
    var at = function(yy, mm) {
      return yy * 12 + mm;
    };
    // party names in the government line get their colours and hover cards
    var P = function(id, label) {
      return '<span class="p-' + id + '">' + label + '</span>';
    };
    // the President and the cabinet of the day, from RF.cabinets; their
    // names carry hover cards about the person and the cabinet
    var cab = RF.cabinet(Q);
    var pres = t < at(1925, 3) ? 'ebert' : t < at(1925, 5) ? 'simons' : 'hindenburg';
    Q.president = RF.personSpan(pres);
    Q.president_party = PARTY_INFO[PEOPLE_PARTY(pres)] ? PARTY_INFO[PEOPLE_PARTY(pres)].name : 'non-party';
    Q.chancellor = RF.personSpan(cab.chancellor);
    Q.chancellor_party = cab.party == 'other' ? 'non-party' : PARTY_INFO[cab.party].name;
    var parts = cab.parties.map(function(id) { return P(id, PARTY_INFO[id].name); });
    var list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts.join('');
    Q.government = '<span class="cab-' + cab.id + ' rf-person col-' + cab.party + '">' + cab.name + '</span>: ' +
        cab.line.replace('%', list);
    // Ebert's state of emergency ran from 26 September 1923; Seeckt held
    // executive power from November 1923 to the end of February 1924.
    Q.emergency = '';
    if (t >= at(1923, 10) && t < at(1923, 11)) {
      Q.emergency = 'State of emergency';
    } else if (t >= at(1923, 11) && t < at(1924, 3)) {
      Q.emergency = 'State of emergency: executive power lies with General von Seeckt';
    }

    if (Q.party_banned) {
      Q.kpd_position = 'Banned';
    } else if (Q.workers_govt) {
      Q.kpd_position = 'Opposition in the Reich; in government in Saxony and Thuringia';
    } else if (y == 1923 && m >= 3 && m <= 10) {
      Q.kpd_position = 'Opposition; tolerating the SPD government in Saxony';
    } else {
      Q.kpd_position = 'Opposition';
    }

    Q.next_election = 'May 1924';
    if (t < at(1924, 1)) {
      Q.currency = 'Paper mark, in hyperinflation';
      Q.dollar_rate = y == 1923 ? DOLLAR_1923[m] : '';
      if (m == 11 && y == 1923) {
        Q.currency = 'Rentenmark introduced on 15 November';
      }
      if (m == 12 && y == 1923) {
        Q.currency = 'Rentenmark (1 Rentenmark = 1 trillion paper marks)';
      }
    } else {
      Q.currency = 'Rentenmark: prices stable, wages cut, unemployment high';
      Q.dollar_rate = '4.2 Rentenmark';
    }
  };

  // Chance that Moscow overturns the current leadership at the next congress.
  // Moscow's pressure on the leadership, from 0 to 1. At 1 the next
  // congress is overturned. A party that keeps its autonomy can stand a
  // larger gap between the leadership and Moscow's favourite.
  RF.overruleChance = function(Q) {
    var preferred = RF.moscowFavourite(Q);
    if (preferred == Q.leader) {
      return 0;
    }
    if (Q.open_letter) {
      return 1;
    }
    var gap = RF.moscowScore(Q, preferred) - RF.moscowScore(Q, Q.leader);
    var tolerance = 10 + 0.6 * Q.autonomy;
    return clamp(gap / tolerance, 0, 1);
  };

  // The rising score without the dice (the dice add up to 30).
  // Support for a revolution among the people, 0 to 100: a rough guide to
  // whether a rising would carry the working class with it. It counts for
  // a little in the chance of a rising; plans, allies and arms count more.
  RF.revSupport = function(Q) {
    var kpd = RF.polls(Q).total.kpd;
    var v = 10 + 0.35 * Q.rev_situation + 1.2 * kpd + 0.15 * Q.union_influence + 0.15 * Q.spd_relation +
        0.1 * Q.readiness - 0.25 * Q.pro_republic - 0.1 * Q.repression;
    return Math.round(clamp(v, 0, 100));
  };

  RF.risingBase = function(Q) {
    var score = Q.readiness + 0.5 * Q.rev_situation + 0.3 * Q.union_influence
        - 0.3 * Q.repression + 0.2 * RF.revSupport(Q);
    if (Q.spd_relation >= 60) {
      score += 20;
    }
    if (Q.workers_govt) {
      score += 10;
    }
    if (Q.october_plan) {
      score += 5;
    }
    return score;
  };

  // Exact numbers next to the words in the sidebar, when the player has
  // turned them on in the options. Each value V gets a string n_V.
  var NUMBERED = ['right_strength', 'center_strength', 'left_strength', 'ultra_strength',
                  'stalin_strength', 'right_dissent', 'center_dissent', 'left_dissent',
                  'ultra_dissent', 'stalin_dissent', 'party_dissent', 'repression',
                  'autonomy', 'overrule_risk', 'readiness', 'rev_situation',
                  'union_influence', 'spd_relation', 'rising_chance', 'rev_support', 'uspd_relation',
                  'z_relation', 'ddp_relation', 'dvp_relation', 'dnvp_relation',
                  'nsdap_relation'];
  var PERCENT = {right_strength: 1, center_strength: 1, left_strength: 1, ultra_strength: 1,
                 stalin_strength: 1, overrule_risk: 1, rising_chance: 1};

  RF.numbers = function(Q) {
    for (var v of NUMBERED) {
      Q['n_' + v] = Q.show_numbers ?
          '&nbsp;(' + Math.round(Q[v] || 0) + (PERCENT[v] ? '%' : '') + ')' : '<span></span>';
    }
  };

  // ---- Polls ------------------------------------------------------------
  // There were no opinion polls in Weimar Germany. These are the game's
  // estimate of how each group would vote, starting near the 1920 and
  // 1924 Reichstag results.

  var PARTIES = ['kpd', 'spd', 'z', 'ddp', 'dvp', 'dnvp', 'nsdap', 'other'];
  var PARTY_LABEL = {kpd: 'KPD', spd: 'SPD', z: 'Z + BVP', ddp: 'DDP', dvp: 'DVP',
                     dnvp: 'DNVP', nsdap: 'NSDAP', other: 'Others'};
  var PARTY_FULL = {
    kpd: 'Communist Party of Germany',
    spd: 'Social Democratic Party of Germany',
    z: 'Centre Party and Bavarian People\'s Party',
    ddp: 'German Democratic Party',
    dvp: 'German People\'s Party',
    dnvp: 'German National People\'s Party',
    nsdap: 'National Socialists and other völkisch groups',
    other: 'Regional, agrarian and splinter parties, and the rump USPD'
  };
  var DEMOGRAPHICS = [
    // name, share of the electorate, baseline vote in the order of PARTIES
    ['workers', 'Workers', 0.38, [16, 48, 12, 3, 4, 8, 3, 6]],
    ['unemployed', 'Unemployed', 0.04, [30, 40, 8, 2, 2, 7, 5, 6]],
    ['new_middle', 'New middle class', 0.16, [4, 22, 12, 16, 18, 17, 4, 7]],
    ['old_middle', 'Old middle class', 0.14, [2, 8, 14, 10, 20, 28, 8, 10]],
    ['rural', 'Rural', 0.16, [3, 12, 10, 4, 8, 38, 6, 19]],
    ['catholics', 'Catholics', 0.12, [5, 12, 60, 3, 4, 7, 2, 7]]
  ];

  RF.parties = PARTIES;
  RF.partyLabel = PARTY_LABEL;

  // How each party is doing against the start of 1923 (1 = as then). The
  // polls and the state elections both scale their base shares by this.
  RF.pollMult = function(Q) {
    var kpd = clamp(1 + (Q.rev_situation - 45) / 50 + (Q.union_influence - 35) / 120
                    + (Q.members - 220) / 500 - Q.repression / 200 - 0.08 * Q.splits
                    + (Q.spd_discredit || 0) / 40, 0.3, 3);
    var spd = clamp(1 + (Q.pro_republic - 50) / 150 - (Q.spd_discredit || 0) / 100
                    - (Q.rev_situation - 45) / 200, 0.4, 2);
    var republic = clamp(1 + (Q.pro_republic - 50) / 100, 0.4, 2);
    var dnvp = clamp(1 + (Q.nationalism - 50) / 80, 0.4, 2.5);
    var nsdap = clamp(1 + (Q.nationalism - 50) / 40, 0.2, 4);
    return {kpd: kpd, spd: spd, z: 1, ddp: republic, dvp: republic,
            dnvp: dnvp, nsdap: nsdap, other: 1,
            // the parties that only stand in the states
            bvp: 1, agr: 1, burg: (republic + dnvp) / 2, vlk: nsdap};
  };

  RF.polls = function(Q) {
    var mult = RF.pollMult(Q);
    var result = {total: {}, groups: []};
    for (var p of PARTIES) {
      result.total[p] = 0;
    }
    for (var d of DEMOGRAPHICS) {
      var raw = {}, sum = 0;
      for (var i = 0; i < PARTIES.length; i++) {
        raw[PARTIES[i]] = d[3][i] * mult[PARTIES[i]];
        sum += raw[PARTIES[i]];
      }
      var shares = {};
      for (var q of PARTIES) {
        shares[q] = 100 * raw[q] / sum;
        result.total[q] += d[2] * shares[q];
      }
      result.groups.push({id: d[0], name: d[1], shares: shares});
    }
    return result;
  };

  // ---- Sidebar rendering -------------------------------------------------
  // Scenes leave empty placeholders; these fill them with coloured,
  // sorted bars, which Dendry's text markup cannot build on its own.

  var esc = function(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var sorted = function(shares) {
    return PARTIES.slice().sort(function(a, b) {
      if (a == 'other') {
        return 1;
      }
      if (b == 'other') {
        return -1;
      }
      return shares[b] - shares[a];
    });
  };

  var stackedBar = function(order, shares, total) {
    var html = '<div class="rf-stack">';
    for (var p of order) {
      var w = 100 * shares[p] / total;
      if (w > 0) {
        html += '<span class="bg-' + p + '" style="width: ' + w.toFixed(2) + '%"></span>';
      }
    }
    return html + '</div>';
  };

  var partyName = function(p, plain) {
    if (plain) {
      return '<span class="p-' + p + '">' + esc(PARTY_LABEL[p]) + '</span>';
    }
    return '<span class="p-' + p + ' tooltip-text" title="' + esc(PARTY_FULL[p]) + '">' +
        esc(PARTY_LABEL[p]) + '</span>';
  };

  RF.renderPolls = function(Q) {
    var el = document.getElementById('rf-polls');
    if (!el) {
      return;
    }
    var poll = RF.polls(Q);
    var order = sorted(poll.total);
    var html = stackedBar(order, poll.total, 100);
    html += '<table class="rf-table">';
    for (var p of order) {
      html += '<tr><td>' + partyName(p) + '</td><td class="rf-num">' +
          poll.total[p].toFixed(1) + '%</td><td class="rf-cell-bar"><span class="bg-' + p +
          '" style="width: ' + Math.min(100, 2 * poll.total[p]).toFixed(1) + '%"></span></td></tr>';
    }
    html += '</table>';
    el.innerHTML = html;

    var demo = document.getElementById('rf-demographics');
    if (!demo) {
      return;
    }
    var out = '';
    for (var g of poll.groups) {
      var gOrder = sorted(g.shares);
      out += '<div class="rf-demo"><div class="rf-demo-name">' + esc(g.name) + '</div>';
      out += stackedBar(gOrder, g.shares, 100);
      var parts = [];
      for (var q of gOrder) {
        if (g.shares[q] >= 0.5) {
          parts.push(partyName(q, true) + '&nbsp;' + Math.round(g.shares[q]) + '%');
        }
      }
      out += '<div class="rf-demo-list">' + parts.join(' · ') + '</div></div>';
    }
    demo.innerHTML = out;
  };

  // The Reichstag as elected on 6 June 1920. Seat counts are approximate:
  // sources differ by a few seats depending on the later by-elections.
  var REICHSTAG_1920 = [
    ['spd', 'SPD', 102, 'Social Democratic Party of Germany'],
    ['uspd', 'USPD', 84, 'Independent Social Democrats. The left of the party joined the KPD in December 1920; most of the rest reunited with the SPD in September 1922.'],
    ['dnvp', 'DNVP', 71, 'German National People\'s Party'],
    ['dvp', 'DVP', 65, 'German People\'s Party'],
    ['z', 'Z', 64, 'Centre Party'],
    ['ddp', 'DDP', 39, 'German Democratic Party'],
    ['bvp', 'BVP', 21, 'Bavarian People\'s Party'],
    ['kpd', 'KPD', 4, 'Communist Party of Germany. Its Reichstag group grew when the left USPD joined in December 1920.'],
    ['other', 'Others', 9, 'Bavarian Peasants\' League, German-Hanoverian Party']
  ];

  // A party's share of the 1920 Reichstag, as a percentage of all seats.
  RF.seatShare = function(seats) {
    var total = 0;
    for (var r of REICHSTAG_1920) {
      total += r[2];
    }
    return (100 * seats / total).toFixed(1) + '%';
  };

  RF.renderReichstag = function() {
    var el = document.getElementById('rf-reichstag');
    if (!el) {
      return;
    }
    var shares = {}, order = [];
    for (var r of REICHSTAG_1920) {
      shares[r[0]] = r[2];
      order.push(r[0]);
    }
    var html = stackedBar(order, shares, 459) + '<table class="rf-table">';
    for (var s of REICHSTAG_1920) {
      html += '<tr><td><span class="p-' + s[0] + ' tooltip-text" title="' + esc(s[3]) + '">' +
          s[1] + '</span></td><td class="rf-num">' + RF.seatShare(s[2]) + '</td></tr>';
    }
    el.innerHTML = html + '</table>';
  };


  // ---- Leadership, congresses and colours -------------------------------
  // The KPD's leadership changes only at party congresses. The statutes
  // call for a congress about once a year; in practice they came every
  // twelve to twenty months, and the Zentrale could bring one forward or
  // put it off. The game opens with the Eighth Congress at Leipzig due at
  // the end of January 1923; after that the next falls due 14 months after
  // the last one (Q.congress_due), unless moved from the Executive card.
  // Places follow the real congresses while they last, then other party
  // strongholds.
  var CONGRESS_PLACES = ['Leipzig', 'Frankfurt am Main', 'Berlin', 'Essen', 'Berlin-Wedding',
                         'Chemnitz', 'Hamburg', 'Halle', 'Düsseldorf', 'Leipzig'];
  var ORDINALS = ['Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth',
                  'Fifteenth', 'Sixteenth', 'Seventeenth'];

  RF.congressName = function(Q) {
    return (ORDINALS[Q.congress_number - 8] || 'Next') + ' Party Congress';
  };

  RF.congressPlace = function(Q) {
    return CONGRESS_PLACES[Q.congress_number - 8] || 'Berlin';
  };

  // Due date of the next congress, as text.
  RF.nextCongressText = function(Q) {
    var d = Q.congress_due;
    var y = Math.floor((d - 1) / 12), m = d - 12 * y;
    if (Q.congress_number == 8) {
      return 'Leipzig, end of January 1923';
    }
    return RF.congressPlace(Q) + ', due ' + MONTHS[m] + ' ' + y;
  };

  // Called once a month: a congress that has fallen due meets (the
  // rf_congress event picks it up).
  RF.monthlyCongress = function(Q) {
    var t = Q.year * 12 + Q.month;
    if (Q.congress_number > 8 && t >= Q.congress_due && !Q.congress_pending) {
      Q.congress_pending = 1;
    }
    // an Open Letter brings a special congress within two months
    if (Q.open_letter && Q.congress_due > t + 2) {
      Q.congress_due = t + 2;
    }
  };

  // The KPD's colour follows the faction in the Zentrale.
  var KPD_COLOURS = {
    right: ['#b5452a', '#f07a5a'],
    center: ['#8b3a2e', '#d98a7a'],
    left: ['#b00020', '#ff5c6e'],
    ultra: ['#4a0d0d', '#c86a6a'],
    stalin: ['#700000', '#e05050']
  };

  // Other parties: leaders, outlook and colour. A party's colour belongs
  // to its leadership, so a new leadership can bring a new colour.
  var PARTY_INFO = {
    kpd: {name: 'KPD', full: 'Communist Party of Germany',
          ideology: 'Revolutionary Marxism, section of the Communist International.'},
    spd: {name: 'SPD', full: 'Social Democratic Party of Germany',
          ideology: 'Reformist social democracy: defend the Republic, work with the bourgeois centre. The largest party of the working class.',
          leaders: [{until: null, name: 'Otto Wels, Hermann Müller', colours: ['#c00000', '#ff5c5c']}]},
    uspd: {name: 'USPD', full: 'Independent Social Democratic Party of Germany',
           ideology: 'Left socialists who stayed out of both the KPD (1920) and the reunited SPD (1922). A small group by now.',
           leaders: [{until: null, name: 'Georg Ledebour, Theodor Liebknecht', colours: ['#9B0000', '#ff7070']}]},
    z: {name: 'Z', full: 'Centre Party',
        ideology: 'The Catholic party of the centre, with its Bavarian sister the BVP. A partner in almost every Reich government.',
        leaders: [{until: null, name: 'Wilhelm Marx', colours: ['#1A1A1A', '#d0d0d0']}]},
    bvp: {name: 'BVP', full: 'Bavarian People\'s Party',
          ideology: 'Bavarian Catholic conservatives, federalist and further right than the Centre.',
          leaders: [{until: null, name: '', colours: ['#4a6fa5', '#8fb0e0']}]},
    ddp: {name: 'DDP', full: 'German Democratic Party',
          ideology: 'Left liberals, one of the founding parties of the Republic.',
          leaders: [{until: null, name: 'Carl Petersen', colours: ['#B8A000', '#f0d64a']}]},
    dvp: {name: 'DVP', full: 'German People\'s Party',
          ideology: 'National liberals close to industry. Stresemann is moving them towards accepting the Republic.',
          leaders: [{until: null, name: 'Gustav Stresemann', colours: ['#C0A054', '#e0c070']}]},
    dnvp: {name: 'DNVP', full: 'German National People\'s Party',
           ideology: 'Monarchist conservatives of the landowners, the officer corps and the old elites.',
           leaders: [{until: null, name: 'Oskar Hergt', colours: ['#3E88B3', '#6fb3dc']}]},
    nsdap: {name: 'NSDAP', full: 'National Socialist German Workers\' Party',
            ideology: 'Völkisch nationalists, strongest in Bavaria.',
            leaders: [
              {until: 'beer_hall_seen', name: 'Adolf Hitler', colours: ['#7A3C00', '#c8874a']},
              {until: null, name: 'banned; Hitler in prison', colours: ['#8c6a4f', '#b89a7f']}
            ]},
    agr: {name: 'Agrarians', full: 'Agrarian leagues',
          ideology: 'Farmers\' and rural leagues standing in the state elections: the Landbund, the peasants\' leagues and their allies. Mostly conservative, some close to the DNVP.',
          leaders: [{until: null, name: '', colours: ['#3f7f3f', '#7fc07f']}]},
    burg: {name: 'Bourgeois lists', full: 'Bourgeois unity lists',
           ideology: 'Joint lists of the bourgeois parties and middle-class associations in the smaller states, formed to keep the Social Democrats out of power.',
           leaders: [{until: null, name: '', colours: ['#7a6a9a', '#b0a0d0']}]},
    vlk: {name: 'Völkisch', full: 'Völkisch lists',
          ideology: 'Antisemitic nationalists of the German Völkisch Freedom Party and their allies.',
          leaders: [{until: null, name: '', colours: ['#5a3a1a', '#a07a50']}]},
    other: {name: 'Others', full: 'Other parties',
            ideology: 'Regional, agrarian and splinter parties, and the rump USPD.',
            leaders: [{until: null, name: '', colours: ['#777777', '#b0b0b0']}]},
    comintern: {name: 'Comintern', full: 'Communist International',
                ideology: 'The world party of revolution, run from Moscow by its Executive Committee (ECCI).',
                leaders: [{until: null, name: 'Grigory Zinoviev', colours: ['#b8000f', '#ff6060']}]},
    reichswehr: {name: 'Reichswehr', full: 'The Reichswehr',
                 ideology: 'The army of the Republic, limited to 100,000 men by the Treaty of Versailles. Loyal to its generals more than to the Republic.',
                 leaders: [{until: null, name: 'General Hans von Seeckt', colours: ['#555555', '#aaaaaa']}]},
    kapd: {name: 'KAPD', full: 'Communist Workers\' Party of Germany',
           ideology: 'Council communists who left the KPD in 1920 rejecting parliament and the unions.',
           leaders: [{until: null, name: '', colours: ['#3a3a3a', '#b0b0b0']}]},
    pcf: {name: 'PCF', full: 'French Communist Party',
          ideology: 'The French section of the International, campaigning against the Ruhr occupation.',
          leaders: [{until: null, name: '', colours: ['#b3004b', '#ff5c9a']}]}
  };
  RF.partyInfo = PARTY_INFO;

  // The current leadership of a party: its leader names and colours.
  RF.partyLeadership = function(Q, p) {
    if (p == 'kpd') {
      var lead = Q.leader || 'right';
      return {name: Q.leader_person ? Q.leader_person + ' (' + NAMES[lead] + ')' : '',
              colours: KPD_COLOURS[lead]};
    }
    var info = PARTY_INFO[p];
    if (!info || !info.leaders) {
      return null;
    }
    for (var l of info.leaders) {
      if (l.until === null || !Q[l.until]) {
        return l;
      }
    }
    return info.leaders[info.leaders.length - 1];
  };

  // Party colours live in CSS variables so every coloured name follows
  // the party's current leadership.
  RF.applyColours = function(Q) {
    var root = document.documentElement;
    for (var p in PARTY_INFO) {
      var l = RF.partyLeadership(Q, p);
      if (l && l.colours) {
        root.style.setProperty('--c-' + p, l.colours[0]);
        root.style.setProperty('--c-' + p + '-dark', l.colours[1]);
      }
    }
  };

  RF.renderLeaders = function(Q) {
    var el = document.getElementById('rf-leaders');
    if (!el) {
      return;
    }
    var html = '';
    for (var p of ['kpd', 'spd', 'uspd', 'z', 'ddp', 'dvp', 'dnvp', 'nsdap']) {
      var l = RF.partyLeadership(Q, p);
      html += '<p><span class="p-' + p + '">' + PARTY_INFO[p].name + '</span>: ' +
          esc(l && l.name ? l.name : '') + '</p>';
    }
    el.innerHTML = html;
  };

  // ---- Data files: images and achievements --------------------------------
  // Edited from the admin panel (admin/). Missing files leave the game as it is.

  RF.data = {images: {}, achievements: []};

  RF.loadData = function(done) {
    var bust = '?v=' + Date.now();
    var pending = 2;
    var finish = function() {
      pending -= 1;
      if (pending == 0 && done) {
        done();
      }
    };
    var load = function(url, key) {
      fetch(url + bust).then(function(r) {
        return r.ok ? r.json() : null;
      }).then(function(json) {
        if (json) {
          RF.data[key] = json;
        }
      }).catch(function() {}).then(finish);
    };
    load('data/images.json', 'images');
    load('data/achievements.json', 'achievements');
  };

  // Image keys: card:<scene>, event:<scene>, advisor:<scene>, leader:<faction>,
  // party:<party>, achievement:<id>.
  RF.image = function(key) {
    return RF.data.images[key] || null;
  };

  var unlockedKey = 'rf_achievements_unlocked';
  RF.unlocked = function() {
    try {
      return JSON.parse(localStorage[unlockedKey] || '{}');
    } catch (e) {
      return {};
    }
  };

  // Achievement conditions are JavaScript expressions over Q, for example
  // "Q.rf_ending == 'revolution'". "end" ones are checked when the game
  // ends, "anytime" ones every month.
  RF.checkAchievements = function(Q, when) {
    if (Q.numbers_shown) {
      return;
    }
    var unlocked = RF.unlocked();
    var fresh = [];
    for (var a of RF.data.achievements) {
      if (unlocked[a.id] || (a.when || 'end') != when && when != 'end') {
        continue;
      }
      var ok = false;
      try {
        ok = !!(new Function('Q', 'return (' + a.condition + ');'))(Q);
      } catch (e) {
        console.warn('Achievement ' + a.id + ': ' + e.message);
      }
      if (ok) {
        unlocked[a.id] = new Date().toISOString().slice(0, 10);
        fresh.push(a);
      }
    }
    if (fresh.length) {
      try {
        localStorage[unlockedKey] = JSON.stringify(unlocked);
      } catch (e) {}
      for (var f of fresh) {
        RF.toast(f);
      }
    }
  };

  RF.toast = function(a) {
    var box = document.createElement('div');
    box.className = 'rf-toast';
    var icon = RF.image('achievement:' + a.id);
    box.innerHTML = (icon ? '<img src="' + esc(icon) + '" alt="">' : '<span class="rf-toast-star">★</span>') +
        '<div><div class="rf-toast-head">Achievement unlocked</div><div class="rf-toast-name">' +
        esc(a.name) + '</div></div>';
    document.body.appendChild(box);
    setTimeout(function() {
      box.classList.add('rf-toast-out');
    }, 4000);
    setTimeout(function() {
      box.remove();
    }, 5000);
  };

  RF.renderAchievements = function() {
    var el = document.getElementById('rf-achievements');
    if (!el) {
      return;
    }
    var list = RF.data.achievements;
    if (!list.length) {
      el.innerHTML = '<p>There are no achievements yet.</p>';
      return;
    }
    var unlocked = RF.unlocked();
    var count = 0;
    var html = '<div class="rf-ach-grid">';
    for (var a of list) {
      var got = !!unlocked[a.id];
      count += got ? 1 : 0;
      var secret = a.hidden && !got;
      var icon = RF.image('achievement:' + a.id);
      html += '<div class="rf-ach' + (got ? ' rf-ach-got' : '') + '">' +
          '<div class="rf-ach-icon">' + (icon && !secret ? '<img src="' + esc(icon) + '" alt="">' : (got ? '★' : '?')) + '</div>' +
          '<div class="rf-ach-text"><div class="rf-ach-name">' + esc(secret ? 'Hidden achievement' : a.name) + '</div>' +
          '<div class="rf-ach-desc">' + esc(secret ? 'Keep playing to find out.' : a.description || '') + '</div>' +
          (got ? '<div class="rf-ach-date">Unlocked ' + esc(unlocked[a.id]) + '</div>' : '') +
          '</div></div>';
    }
    el.innerHTML = '<p class="rf-ach-count">' + count + ' of ' + list.length + ' unlocked</p>' + html + '</div>';
  };

  // Images from the data file: card art, event pictures, the leader's portrait.
  RF.decorate = function(Q) {
    $('#content a.card').each(function() {
      var id = this.getAttribute('card-id');
      if (!id || this.querySelector('img.card-img')) {
        return;
      }
      var base = id.split('.')[0];
      var src = RF.image('card:' + id) || RF.image('card:' + base) ||
          (this.closest('li.deck') ? RF.image('deck:' + id.split('.').pop()) : null);
      if (src) {
        $(this).prepend($('<img>').addClass('card-img').attr({src: src, alt: ''}));
      }
    });
    RF.layoutMain();
    RF.decorateAdvisors(Q);
    var portrait = document.querySelector('#content .rf-portrait-img');
    if (portrait && Q.leader) {
      var p = RF.image('leader:' + Q.leader);
      if (p && !portrait.querySelector('img')) {
        portrait.innerHTML = '<img src="' + esc(p) + '" alt="">';
        portrait.classList.add('rf-has-img');
      }
    }
    var scene = (window.dendryUI.dendryEngine.state.sceneId || '').split('.')[0];
    var ev = RF.image('event:' + scene);
    var heading = document.querySelector('#content h1');
    if (ev && heading && !document.querySelector('#content .rf-event-img[data-scene="' + scene + '"]')) {
      $(heading).after($('<figure>').addClass('rf-event-img').attr('data-scene', scene)
          .append($('<img>').attr({src: ev, alt: ''})));
    }
    RF.renderAchievements();
  };

  // ---- Advisors -------------------------------------------------------------
  // Three posts in the Zentrale. Each holder can act once every six months;
  // the holder's faction gains a little from every action. Who held which
  // post, and when, is simplified: treat the dates as approximate.
  var ADVISOR_SLOTS = {
    org: {name: 'Organisation', role: 'Organisation secretary'},
    unions: {name: 'Trade Unions', role: 'Head of trade-union work'},
    military: {name: 'Military Affairs', role: 'Head of the military apparatus'}
  };
  var ADVISORS = {
    eberlein: {name: 'Hugo Eberlein', slot: 'org', faction: 'center',
               note: 'Founding member and the party\'s organiser since 1919.'},
    pieck: {name: 'Wilhelm Pieck', slot: 'org', faction: 'center',
            note: 'A veteran of the Zentrale who keeps his distance from every faction.'},
    geschke: {name: 'Ottomar Geschke', slot: 'org', faction: 'left',
              note: 'A Berlin metalworker and organiser of the Left.'},
    scholem: {name: 'Werner Scholem', slot: 'org', faction: 'ultra',
              note: 'A sharp-tongued Berlin organiser of the Left.'},
    walcher: {name: 'Jacob Walcher', slot: 'unions', faction: 'right',
              note: 'Head of the party\'s trade-union department, close to Brandler.'},
    heckert: {name: 'Fritz Heckert', slot: 'unions', faction: 'center',
              note: 'A bricklayer and union man who bends with the majority.'},
    merker: {name: 'Paul Merker', slot: 'unions', faction: 'stalin',
             note: 'A young union militant who distrusts the reformist union leaders.'},
    skoblevsky: {name: 'Pyotr Skoblevsky', slot: 'military', faction: 'moscow', from: 1923 * 12 + 8,
                 note: 'A Red Army officer sent by Moscow to advise the party on military matters.'},
    schneller: {name: 'Ernst Schneller', slot: 'military', faction: 'left',
                note: 'A former officer who trains the party\'s defence units.'},
    kippenberger: {name: 'Hans Kippenberger', slot: 'military', faction: 'stalin',
                   note: 'A young Hamburg Communist with a talent for conspiracy.'}
  };

  // An advisor whose faction has not formed yet sits with the camp it
  // comes from: the Middle Group's men with the majority, the Ultra-Left
  // and Thälmann's men with the Left.
  var ADV_FALLBACK = {center: 'right', ultra: 'left', stalin: 'left'};
  var advFaction = function(Q, a) {
    var f = a.faction;
    return f == 'moscow' || RF.active(Q, f) ? f : ADV_FALLBACK[f];
  };
  RF.advFaction = advFaction;

  RF.advisorSlots = ADVISOR_SLOTS;
  RF.advisors = ADVISORS;

  RF.advisorStart = function(Q) {
    Q.adv_org = 'eberlein';
    Q.adv_unions = 'walcher';
    Q.adv_military = '';
    for (var s in ADVISOR_SLOTS) {
      Q['adv_' + s + '_next'] = 0;
    }
  };

  var factionLabel = function(f) {
    return f == 'moscow' ? '<span class="p-comintern">Comintern</span>' :
        '<span class="f-' + f + '">' + NAMES[f] + '</span>';
  };

  // Months until the post can act again (0 = ready).
  RF.advisorWait = function(Q, slot) {
    return Math.max(0, (Q['adv_' + slot + '_next'] || 0) - Q.time);
  };

  // Called when the player opens an advisor's card.
  RF.advisorView = function(Q, slot) {
    var id = Q['adv_' + slot];
    var a = ADVISORS[id];
    var wait = RF.advisorWait(Q, slot);
    Q.adv_slot = slot;
    Q.adv_vacant = a ? 0 : 1;
    Q.adv_ready = a && wait == 0 ? 1 : 0;
    var img = a && RF.image('advisor:' + id);
    var html = '<div class="rf-adv">' +
        '<div class="rf-adv-img">' + (img ? '<img src="' + esc(img) + '" alt="">' : (a ? esc(a.name.split(' ').pop()) : '?')) + '</div><div>';
    if (a) {
      html += '<div class="rf-adv-name">' + esc(a.name) + '</div>' +
          '<div>' + ADVISOR_SLOTS[slot].role + ' · ' + factionLabel(advFaction(Q, a)) + '</div>' +
          '<div class="rf-adv-note">' + esc(a.note) + '</div>' +
          '<div class="rf-adv-status">' + (wait ? 'Can act again in ' + wait + (wait == 1 ? ' month.' : ' months.') :
                                          'Ready to act. Each action pleases ' + factionLabel(advFaction(Q, a)) + '.') + '</div>';
    } else {
      html += '<div class="rf-adv-name">Vacant</div><div>No one holds this post yet.</div>';
    }
    Q.adv_text = html + '</div></div>';
  };

  // An advisor acts: the post waits six months and the holder's faction gains.
  RF.advisorUse = function(Q, slot) {
    var a = ADVISORS[Q['adv_' + slot]];
    Q['adv_' + slot + '_next'] = Q.time + 6;
    if (a && advFaction(Q, a) == 'moscow') {
      Q[Q.leader + '_moscow'] += 3;
      Q.autonomy -= 2;
    } else if (a) {
      var e = {};
      e[advFaction(Q, a)] = 2;
      RF.lean(Q, e);
    }
    RF.normalize(Q);
  };

  // Who can be appointed to a post now.
  RF.advisorCandidates = function(Q, slot) {
    var t = Q.year * 12 + Q.month;
    var out = [];
    for (var id in ADVISORS) {
      var a = ADVISORS[id];
      Q['pick_' + id] = 0;
      if (a.slot != slot || Q['adv_' + slot] == id || (a.from && t < a.from) ||
          (a.faction != 'moscow' && Q[advFaction(Q, a) + '_expelled'])) {
        continue;
      }
      Q['pick_' + id] = 1;
      Q['pick_' + id + '_desc'] = factionLabel(advFaction(Q, a)) + '. ' + a.note;
      out.push(id);
    }
    Q.adv_slot = slot;
    Q.adv_slot_name = ADVISOR_SLOTS[slot].name;
    var cur = ADVISORS[Q['adv_' + slot]];
    Q.adv_current = cur ? cur.name + ' (' + factionLabel(advFaction(Q, cur)) + ')' : 'no one';
    return out;
  };

  // Replacing an advisor angers the old holder's faction and pleases the new
  // one's. It does not reset the six-month wait.
  RF.appoint = function(Q, slot, id) {
    var old = ADVISORS[Q['adv_' + slot]];
    var a = ADVISORS[id];
    if (old && advFaction(Q, old) != 'moscow') {
      Q[advFaction(Q, old) + '_dissent'] += 4;
    }
    if (advFaction(Q, a) == 'moscow') {
      Q[Q.leader + '_moscow'] += 4;
      Q.autonomy -= 3;
    } else {
      Q[advFaction(Q, a) + '_dissent'] -= 3;
      Q[advFaction(Q, a) + '_strength'] += 1;
    }
    Q['adv_' + slot] = id;
    Q.appointed_name = a.name;
    Q.appointed_faction = factionLabel(advFaction(Q, a));
    RF.normalize(Q);
  };

  // Advisor cards on the main page: the holder's portrait, name and wait.
  // The other cards without a picture get a word on their face.
  RF.decorateAdvisors = function(Q) {
    var faces = {
      'rf_advisors.replace': '⇄',
      'rf_main.rf_party': 'Draw',
      'rf_provinces': 'States',
      'rf_executive': 'Zentrale'
    };
    for (var cid in faces) {
      var c = document.querySelector('#content a.card[card-id="' + cid + '"]');
      if (c && !c.querySelector('img, .rf-card-face')) {
        $(c).prepend($('<span>').addClass('rf-card-face').text(faces[cid]));
      }
    }
    $('#content li.pinned-card').each(function() {
      var link = this.querySelector('a.card');
      var id = link && link.getAttribute('card-id');
      var slot = id && id.indexOf('rf_advisors.') == 0 ? id.split('.')[1] : null;
      if (!slot || !ADVISOR_SLOTS[slot] || this.querySelector('.rf-card-sub')) {
        return;
      }
      var a = ADVISORS[Q['adv_' + slot]];
      var wait = RF.advisorWait(Q, slot);
      var img = a && RF.image('advisor:' + Q['adv_' + slot]);
      if (img && !link.querySelector('img')) {
        $(link).prepend($('<img>').addClass('card-img').attr({src: img, alt: ''}));
      } else if (!img) {
        $(link).prepend($('<span>').addClass('rf-card-face').text(a ? a.name.split(' ').pop() : 'Vacant'));
      }
      if (a && wait) {
        this.classList.add('rf-cooldown');
        $(link).append($('<span>').addClass('rf-card-badge').text(wait + ' mo'));
      }
      $(this).append($('<span>').addClass('rf-card-sub').text(a ? a.name : 'Vacant'));
    });
  };

  // The main page: the leader with the Provinces and Executive cards
  // beside him, the Party Affairs deck above the hand, and the advisors
  // with "Replace an advisor" below.
  RF.layoutMain = function() {
    var content = document.getElementById('content');
    var portrait = content.querySelector('.rf-portrait');
    if (!portrait || content.querySelector('.rf-top')) {
      return;
    }
    var top = $('<div>').addClass('rf-top');
    $(portrait).before(top);
    top.append(portrait);
    var topCards = $('<ul>').addClass('pinned-cards rf-top-cards');
    for (var id of ['rf_provinces', 'rf_executive']) {
      $(content).find('ul.pinned-cards a.card[card-id="' + id + '"]').closest('li').appendTo(topCards);
    }
    top.append(topCards);
    // the deck sits right above the hand
    var deck = $(content).find('ul.decks li.deck');
    var deckRow = $('<ul>').addClass('decks rf-deck-row').append(deck);
    var handDesc = $(content).children('p.hand-description');
    if (handDesc.length) {
      handDesc.before(deckRow);
    } else {
      top.after(deckRow);
    }
    $(content).children('ul.decks:not(.rf-deck-row)').remove();
    $(content).children('p.deck-description').prev('hr').remove();
    $(content).children('p.deck-description').remove();
    // the advisors: the replace card goes last in their row
    var pinned = $(content).children('ul.pinned-cards');
    var replace = $(content).find('a.card[card-id="rf_advisors.replace"]').closest('li');
    if (pinned.length && replace.length) {
      pinned.append(replace);
    }
    $(content).children('p.pinned-text-description').text('Advisors');
  };

  // ---- Moscow: the Kremlin patrons and the Comintern plenums -----------
  // The Russian leadership is four patrons whose power follows the
  // succession struggle (keyframes by year and month, linearly in between).
  // Each KPD faction leans on one patron. Dates are approximate.
  var PATRONS = {
    zinoviev: {name: 'Zinoviev', person: 'zinoviev',
               curve: [[1923, 1, 90], [1924, 12, 85], [1925, 12, 55], [1926, 10, 20], [1927, 11, 3], [1934, 1, 0]]},
    trotsky: {name: 'Trotsky and Radek', person: 'trotsky',
              curve: [[1923, 1, 55], [1923, 12, 45], [1924, 2, 25], [1925, 1, 15], [1926, 6, 20], [1927, 11, 2], [1934, 1, 0]]},
    bukharin: {name: 'Bukharin', person: 'bukharin',
               curve: [[1923, 1, 40], [1925, 6, 55], [1926, 10, 70], [1927, 12, 72], [1928, 7, 50], [1929, 4, 25], [1929, 11, 5], [1934, 1, 0]]},
    stalin: {name: 'Stalin', person: 'stalin',
             curve: [[1923, 1, 35], [1924, 6, 50], [1925, 12, 70], [1926, 10, 80], [1927, 12, 90], [1929, 12, 100], [1934, 1, 100]]}
  };
  RF.patrons = PATRONS;

  // Which patron each faction leans on. Brandler's Right went down with
  // Radek in 1924 and from about 1927 looked to Bukharin (the date is a
  // judgement call); the Ultra-Left had none.
  RF.patronOf = function(Q, f) {
    var t = Q.year * 12 + Q.month;
    if (f == 'right') {
      return t < 1927 * 12 + 1 ? 'trotsky' : 'bukharin';
    }
    return {center: 'bukharin', left: 'zinoviev', ultra: null, stalin: 'stalin'}[f];
  };

  // A patron's power now: history, nudged by the KPD (patron_<id>_mod).
  RF.patronPower = function(Q, id) {
    var t = Q.year * 12 + Q.month;
    var c = PATRONS[id].curve;
    var v = c[c.length - 1][2];
    for (var i = 0; i + 1 < c.length; i++) {
      var a = c[i][0] * 12 + c[i][1], b = c[i + 1][0] * 12 + c[i + 1][1];
      if (t <= a) {
        v = c[i][2];
        break;
      }
      if (t < b) {
        v = c[i][2] + (c[i + 1][2] - c[i][2]) * (t - a) / (b - a);
        break;
      }
    }
    return clamp(v + (Q['patron_' + id + '_mod'] || 0), 0, 100);
  };

  // Plenums and congresses of the Comintern on the historical calendar.
  // Each sets the line and a directive with a target the KPD is judged on
  // at the next plenum. Dates are the month the meeting opened.
  // The first entry is the directive the game starts with.
  var PLENUMS = [
    {year: 1922, month: 11, name: 'Fourth World Congress', line: 'united_front',
     directive: 'Win Social Democratic workers for the united front', stat: 'spd_relation', op: '>=', target: 45},
    {year: 1923, month: 6, name: 'Third Enlarged Plenum of the ECCI', line: 'united_front',
     directive: 'Rally the masses against the Cuno government', stat: 'rev_situation', op: '>=', target: 55},
    {year: 1923, month: 9, name: 'ECCI conference on the German revolution', line: 'insurrection',
     directive: 'Prepare the armed rising', stat: 'readiness', op: '>=', target: 40},
    {year: 1924, month: 1, name: 'ECCI Presidium on the German events', line: 'bolshevization',
     directive: 'Rebuild the party around its factory cells', stat: 'apparatus', op: '>=', target: 20},
    {year: 1924, month: 6, name: 'Fifth World Congress', line: 'bolshevization',
     directive: 'Bolshevise the party', stat: 'apparatus', op: '>=', target: 30},
    {year: 1925, month: 3, name: 'Fifth Enlarged Plenum of the ECCI', line: 'united_front',
     directive: 'Win the trade unions back', stat: 'union_influence', op: '>=', target: 45},
    {year: 1926, month: 2, name: 'Sixth Enlarged Plenum of the ECCI', line: 'united_front',
     directive: 'Work inside the trade unions', stat: 'union_influence', op: '>=', target: 50},
    {year: 1926, month: 11, name: 'Seventh Enlarged Plenum of the ECCI', line: 'united_front',
     directive: 'Close ranks behind the leadership', stat: 'party_dissent', op: '<=', target: 30},
    {year: 1927, month: 5, name: 'Eighth Plenum of the ECCI', line: 'united_front',
     directive: 'Build mass campaigns against the war danger', stat: 'members', op: '>=', target: 130},
    {year: 1928, month: 2, name: 'Ninth Plenum of the ECCI', line: 'class_against_class',
     directive: 'Break with the Social Democrats', stat: 'spd_relation', op: '<=', target: 20},
    {year: 1928, month: 7, name: 'Sixth World Congress', line: 'class_against_class',
     directive: 'Fight the right danger in the party', stat: 'right_strength', op: '<=', target: 10},
    {year: 1929, month: 7, name: 'Tenth Plenum of the ECCI', line: 'class_against_class',
     directive: 'Lead the strikes against social fascism', stat: 'spd_relation', op: '<=', target: 10}
  ];
  RF.plenums = PLENUMS;

  RF.nextPlenum = function(Q) {
    var t = Q.year * 12 + Q.month;
    for (var p of PLENUMS) {
      if (p.year * 12 + p.month > t) {
        return p;
      }
    }
    return null;
  };

  // What the Party tab shows about the plenums and the current directive.
  RF.moscowStatus = function(Q) {
    var p = PLENUMS[Q.directive_index] || PLENUMS[0];
    var next = RF.nextPlenum(Q);
    Q.directive = p.directive;
    Q.directive_from = p.name + ' (' + MONTHS[p.month] + ' ' + p.year + ')';
    Q.directive_on_track = RF.directiveMet(Q, p) ? 1 : 0;
    Q.next_plenum = next ? next.name + ', ' + MONTHS[next.month] + ' ' + next.year : 'none planned';
  };

  RF.directiveMet = function(Q, p) {
    var v = Q[p.stat] || 0;
    return p.op == '>=' ? v >= p.target : v <= p.target;
  };

  // Called once a month, after the date moves on: plenums judge the last
  // directive and set a new one; party congresses elect the Zentrale.
  RF.monthlyMoscow = function(Q) {
    var t = Q.year * 12 + Q.month;
    Q.moscow_news = '';
    Q.stalin_power = Math.round(RF.patronPower(Q, 'stalin'));
    Q.trotsky_power = Math.round(RF.patronPower(Q, 'trotsky'));
    // a faction's standing in Moscow drifts towards its patron's power
    for (var f of FACTIONS) {
      var pa = RF.patronOf(Q, f);
      var goal = pa ? RF.patronPower(Q, pa) : 10;
      Q[f + '_moscow'] += (goal - Q[f + '_moscow']) * 0.05;
    }
    for (var i = 0; i < PLENUMS.length; i++) {
      var p = PLENUMS[i];
      if (p.year * 12 + p.month != t) {
        continue;
      }
      var prev = Q.directive_index >= 0 ? PLENUMS[Q.directive_index] : null;
      if (prev) {
        if (RF.directiveMet(Q, prev)) {
          Q[Q.leader + '_moscow'] += 8;
          Q.autonomy += 3;
          Q.moscow_rebukes = Math.max(0, Q.moscow_rebukes - 1);
          Q.moscow_news = p.name + ': Moscow praises the KPD for its work on "' + prev.directive + '".';
        } else {
          Q[Q.leader + '_moscow'] -= 10;
          Q.autonomy -= 5;
          Q.moscow_rebukes += 1;
          Q.moscow_news = p.name + ': Moscow rebukes the leadership for failing to "' + prev.directive.toLowerCase() + '".';
          if (Q.moscow_rebukes >= 2) {
            Q.open_letter = 1;
            Q.moscow_news += ' An Open Letter condemns the leadership; Moscow will replace it at the next congress.';
          }
        }
      }
      Q.line = p.line;
      Q.directive_index = i;
    }
    RF.monthlyCongress(Q);
    RF.normalize(Q);
  };

  RF.patronWord = function(Q, id) {
    var power = RF.patronPower(Q, id);
    var word = power >= 75 ? 'dominant' : power >= 50 ? 'strong' : power >= 25 ? 'weakening' : power >= 5 ? 'beaten' : 'gone';
    return word + (Q.show_numbers ? ' (' + Math.round(power) + ')' : '');
  };

  RF.renderKremlin = function(Q) {
    var el = document.getElementById('rf-kremlin');
    if (!el) {
      return;
    }
    var backs = {};
    for (var f of FACTIONS) {
      var pa = RF.patronOf(Q, f);
      if (pa && RF.active(Q, f)) {
        (backs[pa] = backs[pa] || []).push('<span class="f-' + f + '">' + NAMES[f] + '</span>');
      }
    }
    var ids = Object.keys(PATRONS).sort(function(a, b) { return RF.patronPower(Q, b) - RF.patronPower(Q, a); });
    var html = '<table class="rf-table rf-kremlin">';
    for (var id of ids) {
      html += '<tr><td><span class="m-' + PATRONS[id].person + '">' + PATRONS[id].name + '</span>' +
          (backs[id] ? '<div class="rf-kremlin-backs">backs ' + backs[id].join(', ') + '</div>' : '') +
          '</td><td class="rf-num">' + RF.patronWord(Q, id) + '</td></tr>';
    }
    el.innerHTML = html + '</table>';
  };

  // ---- Reich cabinets ------------------------------------------------------
  // Each cabinet from its first full month. `line` is the text after the
  // name, with % for the list of parties; `text` is its hover card.
  var CABINETS = [
    {id: 'cuno', name: 'Cuno cabinet', from: [1922, 11], chancellor: 'cuno', party: 'other',
     parties: ['z', 'ddp', 'dvp', 'bvp'], line: 'non-party experts backed by %',
     text: 'A "cabinet of business" around the shipping director Wilhelm Cuno. Experts sit beside ministers from the bourgeois parties; the SPD stays outside but does not bring it down. Its answer to the occupation of the Ruhr is passive resistance, paid for with the printing press.'},
    {id: 'stresemann1', name: 'Stresemann cabinet', from: [1923, 8], chancellor: 'stresemann', party: 'dvp',
     parties: ['spd', 'z', 'ddp', 'dvp'], line: 'grand coalition of %',
     text: 'A grand coalition from the SPD to the DVP, formed as the strike wave brought Cuno down. It must end passive resistance, save the currency and hold the Reich together against Bavaria, the Rhineland separatists and the workers\' governments in central Germany.'},
    {id: 'stresemann2', name: 'Stresemann rump cabinet', from: [1923, 11], chancellor: 'stresemann', party: 'dvp',
     parties: ['z', 'ddp', 'dvp'], line: '% after the SPD walked out',
     text: 'The SPD left the coalition in protest at the army\'s action against Saxony while Bavaria went unpunished. Stresemann governs on without a majority.'},
    {id: 'marx1', name: 'Marx cabinet', from: [1923, 12], chancellor: 'marx', party: 'z',
     parties: ['z', 'bvp', 'ddp', 'dvp'], line: 'bourgeois minority of %',
     text: 'A minority cabinet of the bourgeois centre under the Centre Party\'s chairman. It governs by enabling act and decree while the new currency is defended with deep cuts.'},
    {id: 'marx2', name: 'Second Marx cabinet', from: [1924, 6], chancellor: 'marx', party: 'z',
     parties: ['z', 'ddp', 'dvp'], line: 'bourgeois minority of %',
     text: 'The bourgeois minority carries on after the May election, its main task the new reparations settlement.'},
    {id: 'luther1', name: 'Luther cabinet', from: [1925, 1], chancellor: 'luther', party: 'other',
     parties: ['z', 'dvp', 'dnvp', 'bvp'], line: 'centre-right coalition of %',
     text: 'A non-party chancellor at the head of the first cabinet with the German Nationals.'},
    {id: 'luther2', name: 'Second Luther cabinet', from: [1926, 2], chancellor: 'luther', party: 'other',
     parties: ['z', 'ddp', 'dvp', 'bvp'], line: 'bourgeois minority of %',
     text: 'Luther again, now without the German Nationals.'},
    {id: 'marx3', name: 'Third Marx cabinet', from: [1926, 5], chancellor: 'marx', party: 'z',
     parties: ['z', 'ddp', 'dvp', 'bvp'], line: 'bourgeois minority of %',
     text: 'The Centre\'s chairman returns at the head of the same minority.'},
    {id: 'marx4', name: 'Fourth Marx cabinet', from: [1927, 2], chancellor: 'marx', party: 'z',
     parties: ['z', 'dnvp', 'dvp', 'bvp'], line: 'centre-right coalition of %',
     text: 'A "bourgeois bloc" with the German Nationals.'},
    {id: 'muller2', name: 'Müller cabinet', from: [1928, 7], chancellor: 'muller', party: 'spd',
     parties: ['spd', 'z', 'ddp', 'dvp', 'bvp'], line: 'grand coalition of %',
     text: 'A grand coalition under a Social Democratic chancellor.'},
    {id: 'bruning1', name: 'Brüning cabinet', from: [1930, 4], chancellor: 'bruning', party: 'z',
     parties: ['z', 'ddp', 'dvp', 'bvp'], line: 'presidential cabinet backed by %',
     text: 'A cabinet that rules by the President\'s emergency decrees rather than a Reichstag majority.'},
    {id: 'papen', name: 'Papen cabinet', from: [1932, 6], chancellor: 'papen', party: 'other',
     parties: ['dnvp'], line: 'presidential cabinet of barons, backed only by the %',
     text: 'A cabinet of aristocrats and officers with almost no support in the Reichstag.'},
    {id: 'schleicher', name: 'Schleicher cabinet', from: [1932, 12], chancellor: 'schleicher', party: 'other',
     parties: ['dnvp'], line: 'presidential cabinet of the general, tolerated by the %',
     text: 'The general who made and unmade chancellors now holds the office himself.'}
  ];
  RF.cabinets = CABINETS;

  RF.cabinet = function(Q) {
    var t = Q.year * 12 + Q.month;
    var cur = CABINETS[0];
    for (var c of CABINETS) {
      if (c.from[0] * 12 + c.from[1] <= t) {
        cur = c;
      }
    }
    return cur;
  };

  var PEOPLE_PARTY = function(id) {
    return RF.people[id] ? RF.people[id].party : 'other';
  };

  // A person's name with their hover card, in their party's colour.
  RF.personSpan = function(id) {
    var p = RF.people[id];
    return '<span class="m-' + id + ' rf-person col-' + p.party + '">' + esc(p.short || p.name) + '</span>';
  };

  // A value that changes with the date: a string, or a list of
  // [year, month, value] where each value applies from its date on. Hover
  // cards use it so they never know more than the player could.
  var timed = function(Q, v) {
    if (typeof v == 'string') {
      return v;
    }
    var t = Q.year * 12 + Q.month;
    var out = v[0][2];
    for (var e of v) {
      if (e[0] * 12 + e[1] <= t) {
        out = e[2];
      }
    }
    return out;
  };
  RF.timed = timed;

  RF.personText = function(Q, id) {
    return timed(Q, RF.people[id].text);
  };

  RF.personRole = function(Q, id) {
    return timed(Q, RF.people[id].role);
  };

  // People outside the KPD who get a hover card (class m-<id>).
  RF.people = {
    zinoviev: {name: 'Grigory Zinoviev', party: 'comintern',
               role: [[1919, 1, 'Chairman of the Communist International'], [1926, 11, 'Former chairman of the International']],
               text: [[1923, 1, 'Chairman of the International\'s Executive Committee and master of the Petrograd party, one of the three men who rule while Lenin lies ill. He distrusts Brandler\'s caution and listens to the Berlin Left.'],
                      [1924, 1, 'With Lenin dead he shares power with Kamenev and Stalin and leads the attack on Trotsky. He blames the German defeat on Brandler and Radek.'],
                      [1925, 12, 'Beaten by Stalin and Bukharin at the Russian party congress, he has lost Leningrad and is looking to Trotsky for an alliance.'],
                      [1926, 11, 'Removed from the head of the International. He fights on in the United Opposition with Trotsky.'],
                      [1927, 12, 'Expelled from the Russian party with the Opposition. He recants and asks to be readmitted.']]},
    radek: {name: 'Karl Radek', party: 'comintern',
            role: [[1919, 1, 'The International\'s expert on Germany'], [1924, 1, 'Member of the Left Opposition'], [1927, 12, 'Exiled oppositionist']],
            text: [[1923, 1, 'Brandler\'s closest ally in Moscow. A brilliant journalist who believes in the united front and is not above flirting with German nationalists.'],
                   [1924, 1, 'Blamed with Brandler for the German defeat. He has sided with Trotsky.'],
                   [1927, 12, 'Expelled with the Opposition and sent into exile in Siberia.']]},
    trotsky: {name: 'Leon Trotsky', party: 'comintern',
              role: [[1918, 1, 'People\'s Commissar for War'], [1925, 1, 'Member of the Politburo'], [1927, 11, 'Expelled from the party'], [1929, 2, 'In exile']],
              text: [[1923, 1, 'Creator of the Red Army and Lenin\'s best-known comrade. The rest of the Politburo fears his ambition; he has begun to attack the party bureaucracy.'],
                     [1923, 11, 'Leader of the Left Opposition, attacked by Zinoviev, Kamenev and Stalin. He blames the German defeat on the International\'s leaders.'],
                     [1925, 1, 'Removed as Commissar for War. He keeps a seat in the Politburo but little power.'],
                     [1927, 11, 'Expelled from the party and banished to Alma-Ata.'],
                     [1929, 2, 'Deported from the Soviet Union. He writes from exile in Turkey.']]},
    bukharin: {name: 'Nikolai Bukharin', party: 'comintern',
               role: [[1918, 1, 'Editor of Pravda'], [1926, 11, 'Head of the Communist International'], [1929, 7, 'Removed from the International']],
               text: [[1923, 1, 'The party\'s best-known theorist. Once a Left Communist, he now defends the New Economic Policy and the alliance with the peasants.'],
                      [1925, 1, 'Stalin\'s partner against Zinoviev and Trotsky, and the voice of the peasant alliance.'],
                      [1926, 11, 'He runs the International in Zinoviev\'s place, still allied with Stalin.'],
                      [1928, 7, 'Stalin\'s men are attacking "the right danger", and everyone knows whom they mean.'],
                      [1929, 7, 'Removed from the International and the Politburo as leader of the "right deviation".']]},
    stalin: {name: 'Joseph Stalin', party: 'comintern',
             role: 'General Secretary of the Russian party',
             text: [[1923, 1, 'The General Secretary decides who is appointed to what in the Russian party. Few abroad know much about him. He works with Zinoviev and Kamenev against Trotsky.'],
                    [1925, 12, 'Allied with Bukharin, he has beaten Zinoviev and Kamenev at the Russian party congress.'],
                    [1927, 12, 'With the Opposition expelled, he is the strongest man in the Politburo.'],
                    [1929, 12, 'Master of the Russian party. His fiftieth birthday is celebrated like a cult.']]},
    ebert: {name: 'Friedrich Ebert', party: 'spd', role: 'President of the Reich',
            text: 'A saddler\'s son who rose to lead the SPD. In November 1918 he struck a pact with the army to stop the revolution; to Communists he is the man who let the Freikorps loose on Berlin.'},
    simons: {name: 'Walter Simons', party: 'other', role: 'Acting President of the Reich',
             text: 'President of the Reich Court, standing in until a new President is elected.'},
    hindenburg: {name: 'Paul von Hindenburg', party: 'other', role: 'President of the Reich',
                 text: 'The field marshal of the war, elected as the candidate of the right. A monarchist who has sworn to uphold the Republic\'s constitution.'},
    cuno: {name: 'Wilhelm Cuno', party: 'other', role: 'Chancellor',
           text: 'Director-general of the Hamburg-America Line, with no party behind him. Industry trusts him; to the workers his is a cabinet of businessmen.'},
    stresemann: {name: 'Gustav Stresemann', party: 'dvp', role: 'Chancellor',
                 text: 'Leader of the DVP. An annexationist during the war, he now calls himself a republican of reason and wants Germany back among the powers.'},
    marx: {name: 'Wilhelm Marx', party: 'z', role: 'Chancellor',
           text: 'Chairman of the Centre Party, a Catholic judge from the Rhineland. Careful, colourless and hard to bring down.'},
    luther: {name: 'Hans Luther', party: 'other', role: 'Chancellor',
             text: 'The former mayor of Essen and finance minister of the new currency, a man without a party.'},
    muller: {name: 'Hermann Müller', party: 'spd', role: 'Chancellor',
             text: 'Co-chairman of the SPD, who signed the Treaty of Versailles as foreign minister.'},
    bruning: {name: 'Heinrich Brüning', party: 'z', role: 'Chancellor',
              text: 'A Centre Party finance expert and war veteran who governs by decree and balances the budget at any cost.'},
    papen: {name: 'Franz von Papen', party: 'other', role: 'Chancellor',
            text: 'A Catholic aristocrat from the Centre\'s right edge, chosen by the President\'s circle.'},
    schleicher: {name: 'Kurt von Schleicher', party: 'reichswehr', role: 'Chancellor',
                 text: 'The army\'s political general, who has made and unmade chancellors.'}
  };


  RF.factionPersons = PERSONS;
  RF.reichstag1920 = REICHSTAG_1920;

  RF.renderSidebar = function(Q) {
    RF.applyColours(Q);
    if (!Q.rf_mode) {
      return;
    }
    RF.renderLeaders(Q);
    RF.renderKremlin(Q);
    RF.renderReichstag();
    RF.renderPolls(Q);
  };

  window.RF = RF;
}());
