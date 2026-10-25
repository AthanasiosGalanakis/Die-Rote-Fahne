// Die Rote Fahne: shared rules for the KPD faction mode (scenes prefixed rf_).
// Scenes call these through window.RF with the quality object Q.
(function() {
  var FACTIONS = ['right', 'left', 'center', 'stalin'];
  var NAMES = {
    right: 'Brandler Right',
    left: 'Fischer–Maslow Left',
    center: 'Middle Group',
    stalin: 'Thälmann circle'
  };

  // How much the current Comintern line favours each faction.
  var LINE_AFFINITY = {
    united_front: {right: 20, left: 0, center: 10, stalin: 0},
    insurrection: {right: 5, left: 20, center: 5, stalin: 10},
    bolshevization: {right: 0, left: 20, center: 5, stalin: 15}
  };

  var clamp = function(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  };

  var RF = {
    factions: FACTIONS,
    names: NAMES,

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
      var stats = ['autonomy', 'rev_situation', 'readiness', 'spd_relation',
                   'union_influence', 'repression', 'apparatus'];
      for (var s of stats) {
        Q[s] = Math.round(clamp(Q[s], 0, 100));
      }
      Q.members = Math.round(Math.max(20, Q.members));
      Q.funds = Math.max(0, Q.funds);
      RF.updateNames(Q);
    },

    updateNames: function(Q) {
      Q.player_name = NAMES[Q.player];
      Q.leader_name = NAMES[Q.leader];
      Q.favourite = RF.moscowFavourite(Q);
      Q.favourite_name = NAMES[Q.favourite];
      Q.player_strength = Q[Q.player + '_strength'];
      Q.player_dissent = Q[Q.player + '_dissent'];
      Q.player_moscow = Q[Q.player + '_moscow'];
      Q.player_leads = Q.player == Q.leader ? 1 : 0;
    },

    // Moscow backs the faction with the best standing for the current line.
    // Stalin had little say in the International before 1925, so standing
    // with his circle counts for less until then.
    moscowScore: function(Q, f) {
      var standing = Q[f + '_moscow'];
      if (f == 'stalin' && Q.year < 1925) {
        standing *= 0.6;
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
      if (best < 38 && winner != 'center' && Q.center_strength >= 15 && !Q.center_expelled) {
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

    // Move strength from one faction to another.
    shift: function(Q, from, to, amount) {
      var moved = Math.min(amount, Q[from + '_strength']);
      Q[from + '_strength'] -= moved;
      Q[to + '_strength'] += moved;
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

  window.RF = RF;
}());
