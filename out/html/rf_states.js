// Die Rote Fahne: the German states (Länder). Each state has its Landtag
// as elected before January 1923, its government, and the party's local
// standing (Q.st_<id>_mod, in points of the vote). Elections come on their
// due dates; the first ones after the game opens use the real results as
// their baseline, so a party that changes nothing sees roughly what
// happened. Loaded after rote_fahne.js.
//
// Sources: the English Wikipedia articles "<State> Landtag elections in the
// Weimar Republic" and the single-election articles, read October 2026.
// The USPD reunited with the SPD in September 1922, so its seats and votes
// are counted with the SPD here (most of its deputies went over; a few
// stayed in the rump USPD or had joined the KPD earlier). Regional lists
// are grouped: agr = farmers' and rural leagues, burg = joint bourgeois
// lists, vlk = völkisch lists, other = everything else.
(function() {
  var RF = window.RF;

  // Parties in seating order, left to right.
  var ORDER = ['kpd', 'spd', 'ddp', 'z', 'bvp', 'agr', 'burg', 'dvp', 'other', 'dnvp', 'vlk', 'nsdap'];

  // votes: % of the vote; seats: seats in the Landtag. next: the next
  // election [year, month]; term: years between elections afterwards.
  var STATES = [
    {id: 'prussia', name: 'Prussia', capital: 'Berlin', elected: 'February 1921',
     votes: {spd: 32.9, z: 17.2, dnvp: 18.1, dvp: 14.2, kpd: 7.4, ddp: 6.2, other: 3.9},
     seats: {spd: 142, z: 81, dnvp: 75, dvp: 58, kpd: 31, ddp: 26, other: 15},
     gov: 'Grand coalition of the SPD, Centre, DDP and DVP under Otto Braun (SPD)', govParty: 'spd', left: 0,
     note: 'Three fifths of the Reich. Its police, under the Social Democrat Carl Severing, is the strongest in Germany.',
     next: [1924, 12], term: 4},
    {id: 'bavaria', name: 'Bavaria', capital: 'Munich', elected: 'June 1920',
     votes: {bvp: 39.4, spd: 29.3, dnvp: 13.5, ddp: 8.1, agr: 7.9, kpd: 1.7},
     seats: {bvp: 65, spd: 45, dnvp: 19, ddp: 12, agr: 12, kpd: 2},
     gov: 'Right-wing coalition under Eugen von Knilling (BVP)', govParty: 'bvp', left: 0,
     note: 'A "cell of order" since the Soviet Republic was crushed in 1919. The völkisch leagues drill openly; Communists are watched and harassed.',
     next: [1924, 4], term: 4},
    {id: 'saxony', name: 'Saxony', capital: 'Dresden', elected: 'November 1922',
     votes: {spd: 41.8, dnvp: 19.0, dvp: 18.7, kpd: 10.5, ddp: 8.4, other: 1.6},
     seats: {spd: 40, dnvp: 19, dvp: 19, kpd: 10, ddp: 8},
     gov: 'SPD minority government under Wilhelm Buck, which needs Communist votes', govParty: 'spd', left: 1,
     note: 'Red Saxony: the most industrial state, where the left of the SPD is strongest. Without the KPD\'s ten seats no workers\' majority exists.',
     next: [1926, 10], term: 3},
    {id: 'wurttemberg', name: 'Württemberg', capital: 'Stuttgart', elected: 'June 1920',
     votes: {spd: 29.3, z: 22.5, agr: 17.7, ddp: 14.7, dnvp: 9.3, dvp: 3.4, kpd: 3.0},
     seats: {spd: 31, z: 23, agr: 18, ddp: 15, dnvp: 10, dvp: 4, kpd: 0},
     gov: 'Coalition of the DDP and the Centre under Johannes von Hieber (DDP)', govParty: 'ddp', left: 0,
     note: 'Small farmers, craftsmen and the Stuttgart metal works. The KPD narrowly missed a seat in 1920.',
     next: [1924, 5], term: 4},
    {id: 'baden', name: 'Baden', capital: 'Karlsruhe', elected: 'October 1921',
     votes: {z: 37.9, spd: 25.7, ddp: 8.5, dnvp: 8.5, agr: 8.3, dvp: 6.0, kpd: 3.9, other: 1.3},
     seats: {z: 34, spd: 22, ddp: 7, dnvp: 7, agr: 7, dvp: 5, kpd: 3, other: 1},
     gov: 'Weimar coalition of the Centre, SPD and DDP', govParty: 'z', left: 0,
     note: 'Catholic and liberal; the Centre leads and the SPD shares power.',
     next: [1925, 10], term: 4},
    {id: 'thuringia', name: 'Thuringia', capital: 'Weimar', elected: 'September 1921',
     votes: {spd: 39.2, agr: 18.9, dvp: 16.2, kpd: 10.9, dnvp: 7.5, ddp: 5.6, other: 1.7},
     seats: {spd: 22, agr: 10, dvp: 9, kpd: 6, dnvp: 4, ddp: 3},
     gov: 'Socialist minority government under August Frölich (SPD), tolerated by the KPD', govParty: 'spd', left: 1,
     note: 'A young state of small towns and cottage industry. The socialist government lives on Communist votes.',
     next: [1924, 2], term: 3},
    {id: 'hesse', name: 'Hesse', capital: 'Darmstadt', elected: 'November 1921',
     votes: {spd: 36.4, z: 17.4, agr: 15.1, dvp: 14.6, ddp: 7.3, dnvp: 5.3, kpd: 3.9},
     seats: {spd: 26, z: 13, agr: 11, dvp: 10, ddp: 5, dnvp: 3, kpd: 2},
     gov: 'Weimar coalition under Carl Ulrich (SPD)', govParty: 'spd', left: 0,
     note: 'Part of it is occupied by the French. A stable Weimar coalition.',
     next: [1924, 12], term: 3},
    {id: 'hamburg', name: 'Hamburg', capital: 'Hamburg', elected: 'February 1921',
     votes: {spd: 42.0, ddp: 14.1, dvp: 13.9, dnvp: 11.3, kpd: 11.0, other: 7.7},
     seats: {spd: 69, ddp: 23, dvp: 23, dnvp: 18, kpd: 18, other: 9},
     gov: 'Senate of the SPD and DDP', govParty: 'spd', left: 0,
     note: 'The great port and the shipyards. The Hamburg party is a stronghold of the Left opposition.',
     next: [1924, 10], term: 3},
    {id: 'mschwerin', name: 'Mecklenburg-Schwerin', capital: 'Schwerin', elected: 'March 1921',
     votes: {spd: 42.5, dnvp: 22.2, dvp: 17.5, agr: 5.9, kpd: 4.6, ddp: 4.3, other: 3.0},
     seats: {spd: 28, dnvp: 15, dvp: 12, agr: 4, kpd: 3, ddp: 3, other: 2},
     gov: 'SPD-led government under Johannes Stelling (SPD)', govParty: 'spd', left: 0,
     note: 'Great estates and farm labourers. The landowners have not forgiven the revolution.',
     next: [1924, 2], term: 3},
    {id: 'oldenburg', name: 'Oldenburg', capital: 'Oldenburg', elected: 'June 1920',
     votes: {spd: 36.9, z: 20.2, dvp: 15.1, ddp: 14.6, burg: 7.4, agr: 3.2, dnvp: 1.3, kpd: 1.3},
     seats: {spd: 18, z: 10, dvp: 8, ddp: 6, burg: 5, agr: 1},
     gov: 'Coalition of the DDP, Centre and SPD under Theodor Tantzen (DDP)', govParty: 'ddp', left: 0,
     note: 'Farmland, the port of Wilhelmshaven and two scattered exclaves.',
     next: [1923, 6], term: 2,
     hist: {at: [1923, 6], votes: {spd: 24.9, dvp: 22.6, z: 20.7, ddp: 18.6, dnvp: 6.9, kpd: 6.2}}},
    {id: 'brunswick', name: 'Brunswick', capital: 'Brunswick', elected: 'January 1922',
     votes: {spd: 47.4, burg: 38.0, ddp: 10.7, kpd: 4.0},
     seats: {spd: 29, burg: 23, ddp: 6, kpd: 2},
     gov: 'SPD government under Heinrich Jasper (SPD)', govParty: 'spd', left: 0,
     note: 'A workers\' town in a farming state, where the Independents were strong until last year.',
     next: [1924, 12], term: 3},
    {id: 'anhalt', name: 'Anhalt', capital: 'Dessau', elected: 'June 1920',
     votes: {spd: 54.1, dnvp: 16.9, ddp: 15.7, dvp: 13.4},
     seats: {spd: 19, dnvp: 6, ddp: 6, dvp: 5},
     gov: 'Coalition of the SPD and DDP under Heinrich Deist (SPD)', govParty: 'spd', left: 0,
     note: 'Chemical works and lignite. The KPD has no seat yet.',
     next: [1924, 6], term: 4},
    {id: 'bremen', name: 'Bremen', capital: 'Bremen', elected: 'February 1921',
     votes: {spd: 41.9, dvp: 23.3, ddp: 16.8, dnvp: 6.7, kpd: 6.2, other: 5.2},
     seats: {spd: 51, dvp: 30, ddp: 21, dnvp: 7, kpd: 6, other: 5},
     gov: 'Bourgeois Senate', govParty: 'dvp', left: 0,
     note: 'Port and shipyards. The Bremen Left Radicals were among the first Communists in 1918.',
     next: [1923, 11], term: 1,
     hist: {at: [1923, 11], votes: {spd: 29.1, dvp: 20.2, kpd: 16.0, ddp: 12.7, dnvp: 10.5, vlk: 6.2, other: 5.3}}},
    {id: 'lippe', name: 'Lippe', capital: 'Detmold', elected: 'January 1921',
     votes: {spd: 35.7, dnvp: 22.8, dvp: 19.6, ddp: 11.5, other: 5.7, kpd: 4.7},
     seats: {spd: 8, dnvp: 5, dvp: 4, ddp: 2, other: 1, kpd: 1},
     gov: 'State presidium under Heinrich Drake (SPD)', govParty: 'spd', left: 0,
     note: 'A small principality of brickmakers who work away from home each summer.',
     next: [1925, 1], term: 4},
    {id: 'lubeck', name: 'Lübeck', capital: 'Lübeck', elected: 'November 1921',
     votes: {spd: 48.7, burg: 31.1, other: 13.5, kpd: 6.8},
     seats: {spd: 39, burg: 25, other: 10, kpd: 6},
     gov: 'Senate of the SPD and the bourgeois list', govParty: 'spd', left: 0,
     note: 'The old Hanseatic city on the Baltic.',
     next: [1924, 2], term: 3},
    {id: 'mstrelitz', name: 'Mecklenburg-Strelitz', capital: 'Neustrelitz', elected: 'May 1920',
     votes: {spd: 47.1, burg: 36.1, ddp: 14.7, other: 2.1},
     seats: {spd: 17, burg: 14, ddp: 5},
     gov: 'SPD-led government', govParty: 'spd', left: 0,
     note: 'The smallest of the agrarian states. Estate labourers here are restless and the KPD has no seat yet.',
     next: [1923, 7], term: 4,
     hist: {at: [1923, 7], votes: {dnvp: 24.1, spd: 22.7, kpd: 20.4, burg: 14.5, vlk: 8.8, dvp: 5.5, agr: 4.0}}},
    {id: 'waldeck', name: 'Waldeck', capital: 'Arolsen', elected: 'May 1922',
     votes: {burg: 50.2, spd: 28.2, ddp: 12.9, other: 8.7},
     seats: {burg: 9, spd: 5, ddp: 2, other: 1},
     gov: 'A Prussian-appointed state director, with a bourgeois majority', govParty: 'burg', left: 0,
     note: 'A tiny state run from Prussia since 1867, where a vote on joining Prussia is in the air.',
     next: [1925, 5], term: 3},
    {id: 'slippe', name: 'Schaumburg-Lippe', capital: 'Bückeburg', elected: 'April 1922',
     votes: {spd: 50.5, dvp: 14.6, dnvp: 10.2, agr: 7.9, other: 11.9, ddp: 4.9},
     seats: {spd: 8, dvp: 2, dnvp: 2, agr: 1, other: 1, ddp: 1},
     gov: 'SPD government under Heinrich Lorenz (SPD)', govParty: 'spd', left: 0,
     note: 'The smallest state in the Reich, with a Social Democratic majority.',
     next: [1925, 5], term: 3}
  ];
  RF.states = STATES;
  RF.stateOrder = ORDER;

  var byId = {};
  for (var st of STATES) {
    byId[st.id] = st;
  }
  RF.stateById = byId;

  var clamp = function(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  };
  var esc = function(text) {
    return String(text).replace(/[&<>"]/g, function(c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  };
  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

  // Current results of a state: stored as JSON in Q after an election.
  RF.stateResults = function(Q, id) {
    var s = byId[id];
    var raw = Q['st_' + id + '_res'];
    if (raw) {
      return JSON.parse(raw);
    }
    return {votes: s.votes, seats: s.seats, elected: s.elected};
  };

  RF.stateNext = function(Q, id) {
    return Q['st_' + id + '_next'] || (byId[id].next[0] * 12 + byId[id].next[1]);
  };

  RF.stateGov = function(Q, id) {
    return Q['st_' + id + '_gov'] || byId[id].gov;
  };

  var dateText = function(t) {
    var y = Math.floor((t - 1) / 12);
    return MONTHS[t - 12 * y] + ' ' + y;
  };

  // D'Hondt: seats from vote shares.
  var dhondt = function(votes, total) {
    var seats = {};
    for (var p in votes) {
      seats[p] = 0;
    }
    for (var i = 0; i < total; i++) {
      var best = null, bestQ = -1;
      for (var q in votes) {
        var quot = votes[q] / (seats[q] + 1);
        if (quot > bestQ) {
          bestQ = quot;
          best = q;
        }
      }
      seats[best] += 1;
    }
    return seats;
  };

  // An election in a state. The base is the real result where the game
  // has one, otherwise the last result; every party is then scaled by how
  // it stands nationally (RF.pollMult), and the KPD gets its local standing.
  RF.stateElection = function(Q, id) {
    var s = byId[id];
    var t = Q.year * 12 + Q.month;
    var cur = RF.stateResults(Q, id);
    var base = s.hist && s.hist.at[0] * 12 + s.hist.at[1] == t ? s.hist.votes : cur.votes;
    var mult = RF.pollMult(Q);
    // a real result already carries the national mood of its day, so the
    // national swing only counts for a third there
    var weight = base === cur.votes ? 1 : 1 / 3;
    var votes = {}, sum = 0;
    for (var p in base) {
      votes[p] = base[p] * (1 + weight * ((mult[p] || 1) - 1));
    }
    votes.kpd = Math.max(0.3, (votes.kpd || 0.5) + (Q['st_' + id + '_mod'] || 0));
    for (var q in votes) {
      sum += votes[q];
    }
    for (var r in votes) {
      votes[r] = Math.round(1000 * votes[r] / sum) / 10;
    }
    var total = 0;
    for (var k in cur.seats) {
      total += cur.seats[k];
    }
    var seats = dhondt(votes, total);
    var before = cur.seats.kpd || 0;
    Q['st_' + id + '_res'] = JSON.stringify({votes: votes, seats: seats, elected: MONTHS[Q.month] + ' ' + Q.year});
    Q['st_' + id + '_next'] = t + 12 * s.term;
    // local standing fades after an election: the campaign is spent
    Q['st_' + id + '_mod'] = (Q['st_' + id + '_mod'] || 0) / 2;
    Q.state_kpd_seats = (Q.state_kpd_seats || 0);
    return {id: id, name: s.name, kpd: votes.kpd, seats: seats.kpd || 0, before: before};
  };

  // Called once a month: run the elections that are due, and announce the
  // ones due next month. Results go to Q.state_news (HTML) for the
  // rf_state_elections event; the next election to Q.upcoming_state for the
  // rf_state_campaign event.
  RF.monthlyStates = function(Q) {
    var t = Q.year * 12 + Q.month;
    var out = [];
    Q.upcoming_state = '';
    for (var s of STATES) {
      // local standing drifts back slowly between elections
      var m = Q['st_' + s.id + '_mod'] || 0;
      Q['st_' + s.id + '_mod'] = Math.round(10 * m * 0.95) / 10;
      var due = RF.stateNext(Q, s.id);
      if (due == t) {
        out.push(RF.stateElection(Q, s.id));
      } else if (due == t + 1 && !Q.upcoming_state) {
        Q.upcoming_state = s.id;
        Q.upcoming_state_name = s.name;
      }
    }
    Q.state_news_pending = out.length ? 1 : 0;
    Q.state_campaign_pending = Q.upcoming_state ? 1 : 0;
    if (out.length) {
      Q.state_news = out.map(function(r) {
        var res = RF.stateResults(Q, r.id);
        return '<div class="rf-state-result"><p><b>' + esc(r.name) + '</b>: the <span class="p-kpd">KPD</span> wins ' +
            r.kpd.toFixed(1) + '% of the vote and ' + r.seats + (r.seats == 1 ? ' seat' : ' seats') +
            (r.before == r.seats ? ', as before.' : ' (before: ' + r.before + ').') + '</p>' +
            RF.hemicycle(res.seats, {label: r.name + ' Landtag'}) + shareList(res) + '</div>';
      }).join('');
    }
  };

  // ---- Drawing -------------------------------------------------------------

  // A parliament as a hemicycle: seats in rows, filled left to right in
  // ORDER (or opts.order). Each seat gets the class bgf-<party> (or
  // opts.cls + id). Returns SVG markup.
  RF.hemicycle = function(seats, opts) {
    opts = opts || {};
    var order = opts.order || ORDER;
    var cls = opts.cls || 'bgf-';
    var n = 0;
    for (var p in seats) {
      n += seats[p];
    }
    if (!n) {
      return '';
    }
    var rows = Math.max(1, Math.min(12, Math.round(Math.sqrt(n / 4))));
    var r0 = 0.4;
    // seats per row in proportion to each row's radius
    var radii = [], sumR = 0;
    for (var i = 0; i < rows; i++) {
      var r = rows == 1 ? 0.75 : r0 + (1 - r0) * i / (rows - 1);
      radii.push(r);
      sumR += r;
    }
    var pts = [], left = n, minArc = Infinity;
    for (var j = 0; j < rows; j++) {
      var k = j == rows - 1 ? left : Math.round(n * radii[j] / sumR);
      k = Math.min(k, left);
      left -= k;
      if (k > 1) {
        minArc = Math.min(minArc, Math.PI * radii[j] / (k - 1));
      }
      for (var a = 0; a < k; a++) {
        var ang = Math.PI * (k == 1 ? 0.5 : a / (k - 1));
        pts.push({ang: ang, x: -Math.cos(ang) * radii[j], y: Math.sin(ang) * radii[j]});
      }
    }
    pts.sort(function(u, v) { return u.ang - v.ang || v.y - u.y; });
    var rowGap = rows > 1 ? (1 - r0) / (rows - 1) : 0.3;
    var dot = 0.42 * Math.min(rowGap, minArc);
    var svg = '<svg class="rf-hemicycle" viewBox="-1.05 -1.05 2.1 1.12" role="img" aria-label="' + esc(opts.label || 'Seats') + '">';
    var idx = 0;
    for (var q of order) {
      for (var b = 0; b < (seats[q] || 0); b++) {
        var pt = pts[idx++];
        svg += '<circle class="seat ' + cls + q + '" cx="' + pt.x.toFixed(3) + '" cy="' + (-pt.y).toFixed(3) + '" r="' + dot.toFixed(3) + '"/>';
      }
    }
    return svg + '</svg>';
  };

  // A congress as a hemicycle of delegates, from shares in percent
  // ({faction: share}); n dots in all.
  RF.delegateHemicycle = function(shares, n, label) {
    var seats = {}, given = 0, keys = [];
    for (var f of ['ultra', 'left', 'stalin', 'minor', 'center', 'right']) {
      if (shares[f]) {
        seats[f] = Math.round(n * shares[f] / 100);
        given += seats[f];
        keys.push(f);
      }
    }
    if (keys.length) {
      seats[keys[0]] += n - given;
    }
    return RF.hemicycle(seats, {order: ['ultra', 'left', 'stalin', 'minor', 'center', 'right'], cls: 'bff-', label: label || 'Delegates'});
  };

  // Seat shares as a list, largest first.
  var shareList = function(res) {
    var total = 0;
    for (var p in res.seats) {
      total += res.seats[p];
    }
    var order = Object.keys(res.votes).sort(function(a, b) { return (res.votes[b] || 0) - (res.votes[a] || 0); });
    var html = '<table class="rf-table rf-state-table"><tr><th></th><th>Votes</th><th>Seats</th></tr>';
    for (var p of order) {
      var info = RF.partyInfo[p];
      html += '<tr><td><span class="p-' + p + '">' + esc(info ? info.name : p) + '</span></td><td class="rf-num">' +
          res.votes[p].toFixed(1) + '%</td><td class="rf-num">' + (100 * (res.seats[p] || 0) / total).toFixed(1) + '%' +
          (window.dendryUI && window.dendryUI.dendryEngine.state.qualities.show_numbers ? ' (' + (res.seats[p] || 0) + ')' : '') +
          '</td></tr>';
    }
    return html + '</table>';
  };

  // The page of one state (Q.st_view, HTML).
  RF.stateView = function(Q, id) {
    var s = byId[id];
    var res = RF.stateResults(Q, id);
    var total = 0;
    for (var p in res.seats) {
      total += res.seats[p];
    }
    Q.state_id = id;
    Q.prov_ready = Q.prov_month == Q.time ? 0 : 1;
    Q.state_left_gov = s.left;
    Q.state_spd_gov = (Q['st_' + id + '_govparty'] || s.govParty) == 'spd' ? 1 : 0;
    Q.state_kpd_seats = res.seats.kpd || 0;
    Q.st_view = '<div class="rf-state">' +
        '<p class="rf-state-note">' + esc(s.note) + '</p>' +
        '<p><b>Government:</b> ' + esc(RF.stateGov(Q, id)) + '</p>' +
        '<p><b>Landtag</b> of ' + total + ' seats, elected ' + esc(res.elected) + '. Next election due ' + dateText(RF.stateNext(Q, id)) + '.</p>' +
        RF.hemicycle(res.seats, {label: s.name + ' Landtag'}) +
        shareList(res) + '</div>';
  };

  // The list of states on the Provinces card (Q.states_view, HTML).
  RF.provincesView = function(Q) {
    Q.prov_ready = Q.prov_month == Q.time ? 0 : 1;
    var html = '<table class="rf-table rf-states"><tr><th>State</th><th>KPD</th><th>Next vote</th></tr>';
    for (var s of STATES) {
      var res = RF.stateResults(Q, s.id);
      html += '<tr><td>' + esc(s.name) + '</td><td class="rf-num">' + (res.votes.kpd || 0).toFixed(1) + '%</td><td class="rf-num">' +
          dateText(RF.stateNext(Q, s.id)) + '</td></tr>';
    }
    Q.states_view = html + '</table>';
  };

  // A decision in a state: local standing and national effects, at most
  // one a month across all states.
  RF.stateAction = function(Q, id, local, effects) {
    Q['st_' + id + '_mod'] = (Q['st_' + id + '_mod'] || 0) + local;
    for (var k in effects || {}) {
      Q[k] = (Q[k] || 0) + effects[k];
    }
    Q.prov_month = Q.time;
    RF.normalize(Q);
  };
}());
