// Die Rote Fahne: shared rules. The player leads the KPD as a whole; the
// factions inside it grow or turn against the party line with each decision.
// Scenes call these through window.RF with the quality object Q.
(function() {
  var FACTIONS = ['right', 'center', 'left', 'ultra', 'stalin'];
  // who would chair the party for each faction. Brandler and Thälmann
  // chaired it historically; the others are the faction's best-known leader.
  var PERSONS = {
    right: 'Heinrich Brandler',
    center: 'Ernst Meyer',
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

    // A decision pleases some factions and angers others. A positive value
    // adds strength and calms the faction; a negative one costs it a little
    // strength and raises its dissent more.
    lean: function(Q, effects) {
      for (var f in effects) {
        if (Q[f + '_expelled']) {
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
        if (Q[f + '_expelled']) {
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
        dissent += Q[h + '_strength'] * Q[h + '_dissent'] / 100;
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
        if (Q[f + '_expelled'] || f == exclude) {
          continue;
        }
        if (best === null || RF.moscowScore(Q, f) > RF.moscowScore(Q, best)) {
          best = f;
        }
      }
      return best;
    },

    // A party congress: delegates follow strength, the sitting leadership
    // gets an apparatus bonus, and a split congress turns to the Middle Group.
    congress: function(Q) {
      var winner = null, best = -1;
      for (var f of FACTIONS) {
        if (Q[f + '_expelled']) {
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
        if (weight > best) {
          best = weight;
          winner = f;
        }
      }
      Q.congress_compromise = 0;
      if (Q[winner + '_strength'] < 40 && winner != 'center' && Q.center_strength >= 20 && !Q.center_expelled) {
        winner = 'center';
        Q.congress_compromise = 1;
      }
      Q.congress_challenger = '';
      Q.congress_winner = winner;
      Q.congress_winner_name = NAMES[winner];
      Q.leader = winner;
      RF.verdict(Q);
      RF.updateNames(Q);
    },

    // The Comintern overturns the result when the leadership was condemned
    // by an Open Letter, or when Moscow's pressure reaches 100. No dice: the
    // Party tab shows the pressure in advance.
    verdict: function(Q) {
      var preferred = RF.moscowFavourite(Q);
      Q.moscow_overruled = 0;
      if (preferred == Q.leader) {
        Q.open_letter = 0;
        return;
      }
      if (Q.open_letter || RF.overruleChance(Q) >= 1) {
        Q.open_letter = 0;
        Q.moscow_rebukes = 0;
        Q[Q.leader + '_dissent'] += 20;
        Q.overruled_name = NAMES[Q.leader];
        Q.leader = preferred;
        Q.autonomy -= 10;
        Q.moscow_overruled = 1;
      } else {
        Q.autonomy -= 3;
      }
      Q.leader_name = NAMES[Q.leader];
      Q.leader_person = PERSONS[Q.leader];
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
    Q.president = 'Friedrich Ebert';
    Q.president_party = 'spd';
    Q.president_class = 'p-spd';
    if (t < at(1923, 8)) {
      Q.chancellor = 'Wilhelm Cuno';
      Q.chancellor_party = 'non-party';
      Q.chancellor_class = 'p-other';
      Q.government = 'Cuno cabinet: non-party experts backed by ' + P('z', 'Z') + ', ' + P('ddp', 'DDP') + ', ' +
          P('dvp', 'DVP') + ' and ' + P('bvp', 'BVP');
    } else if (t < at(1923, 11)) {
      Q.chancellor = 'Gustav Stresemann';
      Q.chancellor_party = 'DVP';
      Q.chancellor_class = 'p-dvp';
      Q.government = 'Grand coalition: ' + P('spd', 'SPD') + ', ' + P('z', 'Z') + ', ' + P('ddp', 'DDP') + ' and ' + P('dvp', 'DVP');
    } else if (t < at(1923, 12)) {
      Q.chancellor = 'Gustav Stresemann';
      Q.chancellor_party = 'DVP';
      Q.chancellor_class = 'p-dvp';
      Q.government = 'Rump cabinet: ' + P('z', 'Z') + ', ' + P('ddp', 'DDP') + ' and ' + P('dvp', 'DVP') + ', after the ' +
          P('spd', 'SPD') + ' walked out';
    } else {
      Q.chancellor = 'Wilhelm Marx';
      Q.chancellor_party = 'Z';
      Q.chancellor_class = 'p-z';
      Q.government = 'Bourgeois minority: ' + P('z', 'Z') + ', ' + P('bvp', 'BVP') + ', ' + P('ddp', 'DDP') + ' and ' + P('dvp', 'DVP');
    }
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
  RF.risingBase = function(Q) {
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
    return score;
  };

  // Exact numbers next to the words in the sidebar, when the player has
  // turned them on in the options. Each value V gets a string n_V.
  var NUMBERED = ['right_strength', 'center_strength', 'left_strength', 'ultra_strength',
                  'stalin_strength', 'right_dissent', 'center_dissent', 'left_dissent',
                  'ultra_dissent', 'stalin_dissent', 'party_dissent', 'repression',
                  'autonomy', 'overrule_risk', 'readiness', 'rev_situation',
                  'union_influence', 'spd_relation', 'rising_chance', 'uspd_relation',
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

  RF.polls = function(Q) {
    var kpd = clamp(1 + (Q.rev_situation - 45) / 50 + (Q.union_influence - 35) / 120
                    + (Q.members - 220) / 500 - Q.repression / 200 - 0.08 * Q.splits
                    + (Q.spd_discredit || 0) / 40, 0.3, 3);
    var spd = clamp(1 + (Q.pro_republic - 50) / 150 - (Q.spd_discredit || 0) / 100
                    - (Q.rev_situation - 45) / 200, 0.4, 2);
    var republic = clamp(1 + (Q.pro_republic - 50) / 100, 0.4, 2);
    var dnvp = clamp(1 + (Q.nationalism - 50) / 80, 0.4, 2.5);
    var nsdap = clamp(1 + (Q.nationalism - 50) / 40, 0.2, 4);
    var mult = {kpd: kpd, spd: spd, z: 1, ddp: republic, dvp: republic,
                dnvp: dnvp, nsdap: nsdap, other: 1};
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
  // The KPD's leadership changes only at party congresses. The congresses
  // of the other parties are listed for later use but not played yet.

  var KPD_CONGRESSES = [
    {year: 1923, month: 1, name: '8th congress', place: 'Leipzig'},
    {year: 1924, month: 4, name: '9th congress', place: 'Frankfurt am Main'},
    {year: 1925, month: 7, name: '10th congress', place: 'Berlin'},
    {year: 1927, month: 3, name: '11th congress', place: 'Essen'},
    {year: 1929, month: 6, name: '12th congress', place: 'Berlin-Wedding'}
  ];
  RF.kpdCongresses = KPD_CONGRESSES;

  RF.nextCongress = function(Q) {
    var t = Q.year * 12 + Q.month;
    for (var c of KPD_CONGRESSES) {
      if (c.year * 12 + c.month >= t) {
        return c;
      }
    }
    return null;
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
              note: 'Ran the party\'s organisation under the Left in 1924.'},
    walcher: {name: 'Jacob Walcher', slot: 'unions', faction: 'right',
              note: 'Head of the party\'s trade-union department, close to Brandler.'},
    heckert: {name: 'Fritz Heckert', slot: 'unions', faction: 'center',
              note: 'A bricklayer and union man who bends with the majority.'},
    merker: {name: 'Paul Merker', slot: 'unions', faction: 'stalin',
             note: 'A hard-liner for red unions; prominent only later in the decade.'},
    skoblevsky: {name: 'Pyotr Skoblevsky', slot: 'military', faction: 'moscow', from: 1923 * 12 + 8,
                 note: 'A Red Army officer sent by Moscow in 1923 to build the M-Apparat.'},
    schneller: {name: 'Ernst Schneller', slot: 'military', faction: 'left',
                note: 'A former officer who trains the party\'s defence units.'},
    kippenberger: {name: 'Hans Kippenberger', slot: 'military', faction: 'stalin',
                   note: 'Fought in the Hamburg rising; later ran the party\'s secret apparatus.'}
  };

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
          '<div>' + ADVISOR_SLOTS[slot].role + ' · ' + factionLabel(a.faction) + '</div>' +
          '<div class="rf-adv-note">' + esc(a.note) + '</div>' +
          '<div class="rf-adv-status">' + (wait ? 'Can act again in ' + wait + (wait == 1 ? ' month.' : ' months.') :
                                          'Ready to act. Each action pleases ' + factionLabel(a.faction) + '.') + '</div>';
    } else {
      html += '<div class="rf-adv-name">Vacant</div><div>No one holds this post yet.</div>';
    }
    Q.adv_text = html + '</div></div>';
  };

  // An advisor acts: the post waits six months and the holder's faction gains.
  RF.advisorUse = function(Q, slot) {
    var a = ADVISORS[Q['adv_' + slot]];
    Q['adv_' + slot + '_next'] = Q.time + 6;
    if (a && a.faction == 'moscow') {
      Q[Q.leader + '_moscow'] += 3;
      Q.autonomy -= 2;
    } else if (a) {
      var e = {};
      e[a.faction] = 2;
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
          (a.faction != 'moscow' && Q[a.faction + '_expelled'])) {
        continue;
      }
      Q['pick_' + id] = 1;
      Q['pick_' + id + '_desc'] = factionLabel(a.faction) + '. ' + a.note;
      out.push(id);
    }
    Q.adv_slot = slot;
    Q.adv_slot_name = ADVISOR_SLOTS[slot].name;
    var cur = ADVISORS[Q['adv_' + slot]];
    Q.adv_current = cur ? cur.name + ' (' + factionLabel(cur.faction) + ')' : 'no one';
    return out;
  };

  // Replacing an advisor angers the old holder's faction and pleases the new
  // one's. It does not reset the six-month wait.
  RF.appoint = function(Q, slot, id) {
    var old = ADVISORS[Q['adv_' + slot]];
    var a = ADVISORS[id];
    if (old && old.faction != 'moscow') {
      Q[old.faction + '_dissent'] += 4;
    }
    if (a.faction == 'moscow') {
      Q[Q.leader + '_moscow'] += 4;
      Q.autonomy -= 3;
    } else {
      Q[a.faction + '_dissent'] -= 3;
      Q[a.faction + '_strength'] += 1;
    }
    Q['adv_' + slot] = id;
    Q.appointed_name = a.name;
    Q.appointed_faction = factionLabel(a.faction);
    RF.normalize(Q);
  };

  // Advisor cards on the main page: the holder's portrait, name and wait.
  // The other cards without a picture get a word on their face.
  RF.decorateAdvisors = function(Q) {
    var faces = {
      'rf_advisors.replace': '⇄',
      'rf_main.rf_party': 'Draw'
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

  // The main page: the leader, the deck and "Replace an advisor" side by side,
  // then the hand and the advisors in rows of four.
  RF.layoutMain = function() {
    var content = document.getElementById('content');
    var portrait = content.querySelector('.rf-portrait');
    if (!portrait || content.querySelector('.rf-top')) {
      return;
    }
    var top = $('<div>').addClass('rf-top');
    $(portrait).before(top);
    top.append(portrait);
    var decks = $('<ul>').addClass('decks rf-top-cards');
    $(content).find('ul.decks li.deck').appendTo(decks);
    top.append(decks);
    var replace = $(content).find('ul.pinned-cards a.card[card-id="rf_advisors.replace"]').closest('li');
    if (replace.length) {
      top.append($('<ul>').addClass('pinned-cards rf-top-cards').append(replace));
    }
    // the old deck row and its divider are empty now
    $(content).children('ul.decks:not(.rf-top-cards)').remove();
    $(content).children('p.deck-description').prev('hr').remove();
    $(content).children('p.deck-description').remove();
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
    for (var c of KPD_CONGRESSES) {
      if (c.year * 12 + c.month == t) {
        var before = Q.leader;
        RF.congress(Q);
        Q.congress_news = c.place + ' (' + c.name + '): ' +
            (Q.moscow_overruled ? 'Moscow overturned the vote and installed the ' + NAMES[Q.leader] + '.' :
             Q.leader == before ? 'the ' + NAMES[Q.leader] + ' keeps the Zentrale.' :
             'the ' + NAMES[Q.leader] + ' takes over the Zentrale.');
      }
    }
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
      if (pa && !Q[f + '_expelled']) {
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

  // People outside the KPD who get a hover card (class m-<id>).
  RF.people = {
    zinoviev: {name: 'Grigory Zinoviev', party: 'comintern',
               role: 'Chairman of the Comintern\'s Executive Committee, 1919–1926',
               text: 'Head of the International and the patron of the KPD\'s Left. He pushed for the German October in 1923 and looked for others to blame when it failed.'},
    radek: {name: 'Karl Radek', party: 'comintern',
            role: 'The Comintern\'s expert on Germany',
            text: 'Backed Brandler and the united front, and in June 1923 courted German nationalists with his Schlageter speech. After the failed October he fell with Brandler.'},
    trotsky: {name: 'Leon Trotsky', party: 'comintern',
              role: 'People\'s Commissar for War until January 1925',
              text: 'Leader of the Left Opposition from late 1923, with Radek at his side. Removed from his posts, expelled from the party in November 1927 and deported in 1929.'},
    bukharin: {name: 'Nikolai Bukharin', party: 'comintern',
               role: 'Led the Comintern in practice, 1926–1929',
               text: 'Stalin\'s ally against Zinoviev and Trotsky, then branded the leader of the \'right deviation\' and removed in 1929. Brandler\'s KPO looked to him.'},
    stalin: {name: 'Joseph Stalin', party: 'comintern',
             role: 'General Secretary of the Russian party from 1922',
             text: 'Allied with Zinoviev against Trotsky, then with Bukharin against Zinoviev, and stood alone by 1929. Thälmann\'s patron from 1925.'}
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
