// Die Rote Fahne: shared rules. The player leads the KPD as a whole; the
// factions inside it grow or turn against the party line with each decision.
// Scenes call these through window.RF with the quality object Q.
(function() {
  var FACTIONS = ['right', 'center', 'left', 'ultra', 'stalin'];
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
    bolshevization: {right: 0, center: 5, left: 20, ultra: -10, stalin: 15}
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
      var stats = ['autonomy', 'moscow_trust', 'rev_situation', 'readiness',
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
      Q.favourite = RF.moscowFavourite(Q);
      Q.favourite_name = NAMES[Q.favourite];
      Q.leader_dissent = Q[Q.leader + '_dissent'];
    },

    // Stalin had little say in the International before 1925, so standing
    // with his circle counts for less until then.
    moscowScore: function(Q, f) {
      var standing = Q[f + '_moscow'];
      if (f == 'stalin' && Q.year < 1925) {
        standing *= 0.8;
      }
      return standing + LINE_AFFINITY[Q.line][f];
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
      Q.congress_winner = winner;
      Q.congress_winner_name = NAMES[winner];
      Q.leader = winner;
      RF.verdict(Q);
      RF.updateNames(Q);
    },

    // The Comintern may overturn the result. The chance grows with the gap
    // in standing and with every earlier loss of party autonomy.
    verdict: function(Q) {
      var preferred = RF.moscowFavourite(Q);
      Q.moscow_overruled = 0;
      if (preferred == Q.leader) {
        return;
      }
      var gap = RF.moscowScore(Q, preferred) - RF.moscowScore(Q, Q.leader);
      var chance = clamp((gap / 100) * (100 - Q.autonomy) / 50, 0, 0.9);
      if (Math.random() < chance) {
        Q[Q.leader + '_dissent'] += 20;
        Q.overruled_name = NAMES[Q.leader];
        Q.leader = preferred;
        Q.autonomy -= 10;
        Q.moscow_overruled = 1;
      } else {
        Q.autonomy -= 3;
      }
      Q.leader_name = NAMES[Q.leader];
    },

    // Obeying Moscow pleases the Thälmann circle; defying it feeds the
    // Ultra-Left and costs the party Moscow's trust.
    obey: function(Q, amount) {
      Q.moscow_trust += amount;
      Q.stalin_moscow += amount / 2;
      Q.autonomy -= amount / 2;
      RF.lean(Q, {stalin: Math.round(amount / 2), ultra: -Math.round(amount / 3)});
    },

    defy: function(Q, amount) {
      Q.moscow_trust -= amount;
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
    Q.president = 'Friedrich Ebert';
    Q.president_party = 'spd';
    if (t < at(1923, 8)) {
      Q.chancellor = 'Wilhelm Cuno';
      Q.chancellor_party = 'non-party';
      Q.chancellor_class = 'p-other';
      Q.government = 'Cuno cabinet: non-party experts backed by Z, DDP, DVP and BVP';
    } else if (t < at(1923, 11)) {
      Q.chancellor = 'Gustav Stresemann';
      Q.chancellor_party = 'DVP';
      Q.chancellor_class = 'p-dvp';
      Q.government = 'Grand coalition: SPD, Z, DDP and DVP';
    } else if (t < at(1923, 12)) {
      Q.chancellor = 'Gustav Stresemann';
      Q.chancellor_party = 'DVP';
      Q.chancellor_class = 'p-dvp';
      Q.government = 'Rump cabinet: Z, DDP and DVP, after the SPD walked out';
    } else {
      Q.chancellor = 'Wilhelm Marx';
      Q.chancellor_party = 'Z';
      Q.chancellor_class = 'p-z';
      Q.government = 'Bourgeois minority: Z, BVP, DDP and DVP';
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
  RF.overruleChance = function(Q) {
    var preferred = RF.moscowFavourite(Q);
    if (preferred == Q.leader) {
      return 0;
    }
    var gap = RF.moscowScore(Q, preferred) - RF.moscowScore(Q, Q.leader);
    return clamp((gap / 100) * (100 - Q.autonomy) / 50, 0, 0.9);
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
          parts.push(partyName(q, true) + '&nbsp;' + Math.round(g.shares[q]));
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
          s[1] + '</span></td><td class="rf-num">' + s[2] + ' seats</td></tr>';
    }
    el.innerHTML = html + '</table>';
  };

  RF.renderSidebar = function(Q) {
    if (!Q.rf_mode) {
      return;
    }
    RF.renderReichstag();
    RF.renderPolls(Q);
  };

  window.RF = RF;
}());
