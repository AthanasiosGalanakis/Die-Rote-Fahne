// Die Rote Fahne: the world around the party. What each camp stands on,
// what the other camps did month by month, the record of the party's own
// decisions, and the opening for revolution. Loaded after rote_fahne.js;
// scenes call these through window.RF.
(function() {
  var RF = window.RF;
  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

  var clamp = function(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  };
  var esc = function(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var now = function(Q) {
    return Q.year * 12 + Q.month;
  };
  var readJson = function(text) {
    try {
      var v = JSON.parse(text || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  };

  // ---- The camps ------------------------------------------------------------
  // Whom each party speaks for, what it wants from the state, and at whose
  // cost. These sit in the party's hover card. The texts describe the camp as
  // it stands in January 1923 and say nothing about what comes later.
  RF.camps = {
    spd: {
      base: 'Skilled workers in the free trade unions, clerks and officials who owe their posts to the Republic, and the party\'s own officials and press.',
      wants: 'A republic that lasts, with the unions bargaining and the party taking its turn in office: reform, not rupture.',
      cost: 'Its own rank and file, whenever the party shields a bourgeois government from the left.'
    },
    z: {
      base: 'Catholic peasants, artisans, clergy and Christian trade unionists: a milieu of every class, held together by the Church.',
      wants: 'The Church and the confessional schools protected, the Reich kept together, and a hand on the balance in every government.',
      cost: 'Its own workers\' wing, whenever the party sides with employers and landowners.'
    },
    ddp: {
      base: 'Liberal professionals, publicists, officials and the salaried middle class of the cities.',
      wants: 'A parliamentary republic with property and civil liberties secure, and a peaceful settlement with the Allies.',
      cost: 'Its own voters, who are drifting to the nationalists on one side and the Social Democrats on the other.'
    },
    dvp: {
      base: 'The coal and steel owners of the Ruhr, big merchants and bankers, and their salaried managers.',
      wants: 'Lower taxes and wages, an end to the eight-hour day, and a state that lets business run. The Republic, if it pays.',
      cost: 'Wage earners and the small saver, whose money the inflation is eating.'
    },
    dnvp: {
      base: 'The great landowners east of the Elbe, the officer corps and civil service of the old order, parts of industry, and the Protestant small town.',
      wants: 'The Republic broken, a monarchy or an authoritarian state in its place, the estates protected by tariffs, and the labour movement kept down.',
      cost: 'Farm labourers and consumers, through the tariffs and prices that protect the estates.'
    },
    nsdap: {
      base: 'Ruined small proprietors and shopkeepers, officers and veterans with no place in the new order, students and young men out of work. Strongest in Bavaria.',
      wants: 'The Republic and the labour movement overthrown, Versailles torn up, and the Jews and the Marxists made the scapegoat.',
      cost: 'The Jewish minority, and the labour movement it means to smash.'
    },
    reichswehr: {
      base: 'The officer corps, drawn from the old Prussian elite, and a professional army held to a hundred thousand men.',
      wants: 'Independence from parliament, a strong army again, and a quiet understanding with Soviet Russia against Poland.',
      cost: 'Whoever it is ordered against. In 1920 it was the workers of the Ruhr.'
    }
  };

  // The three lines of a camp's card, for the hover card.
  RF.campCard = function(p) {
    var c = RF.camps[p];
    if (!c) {
      return '';
    }
    return '<div class="rf-camp-row"><b>Speaks for</b> ' + esc(c.base) + '</div>' +
        '<div class="rf-camp-row"><b>Wants</b> ' + esc(c.wants) + '</div>' +
        '<div class="rf-camp-row"><b>At whose cost</b> ' + esc(c.cost) + '</div>';
  };

  // ---- What the other camps did ---------------------------------------------
  // Dated lines: [year, month], who (a party id for the colour, or plain
  // text) and what happened. Written as facts; the party's own choices do
  // not change them. An entry may carry if(Q) to appear only under a
  // condition. Dates are those of the event itself.
  var CAMP_NEWS = [
    {t: [1923, 1], who: 'Cuno government',
     text: 'Passive resistance in the Ruhr is paid for with the printing press. The coal and steel owners are compensated for their idle mines; the wage earners are paid in money that loses its worth by the week.'},
    {t: [1923, 3], who: 'Essen',
     text: 'On 31 March French soldiers fire on Krupp workers in the works yard. Thirteen are killed.'},
    {t: [1923, 5], p: 'dnvp',
     text: 'On 26 May the French shoot Albert Leo Schlageter, a former Freikorps man and saboteur. The nationalist press makes him a martyr.'},
    {t: [1923, 8], p: 'dvp',
     text: 'After strikes across the Reich the Cuno government falls on 12 August. Stresemann forms a grand coalition of the SPD, the Centre, the DDP and his own party.'},
    {t: [1923, 9], p: 'bvp',
     text: 'On 26 September passive resistance is called off. The same day Ebert proclaims a state of emergency, and Bavaria\'s government gives Gustav von Kahr dictatorial powers.'},
    {t: [1923, 11], p: 'nsdap',
     text: 'On 8 and 9 November Hitler and Ludendorff try to seize power in Munich. The putsch collapses before the Feldherrnhalle, and the NSDAP is banned.'},
    {t: [1923, 11], who: 'Reich',
     text: 'The Rentenmark replaces the paper mark on 15 November. The savings of the middle classes are gone; so are the mortgages of the estate owners and the debts of industry.'},
    {t: [1924, 4], p: 'nsdap',
     text: 'On 1 April the Munich court sentences Hitler to five years in fortress detention, with release on parole possible after six months. Ludendorff is acquitted.'}
  ];
  RF.campNews = CAMP_NEWS;

  // Once a month: lines dated this month join the log.
  RF.monthlyCamps = function(Q) {
    var t = now(Q);
    var log = readJson(Q.camps_log);
    for (var e of CAMP_NEWS) {
      if (e.t[0] * 12 + e.t[1] != t || (e.if && !e.if(Q))) {
        continue;
      }
      if (log.some(function(l) { return l.t == t && l.text == e.text; })) {
        continue;
      }
      log.push({t: t, p: e.p || '', who: e.who || '', text: e.text});
    }
    Q.camps_log = JSON.stringify(log.slice(-40));
  };

  RF.renderCamps = function(Q) {
    var el = document.getElementById('rf-camps');
    if (!el) {
      return;
    }
    var log = readJson(Q.camps_log).slice(-6).reverse();
    if (!log.length) {
      el.innerHTML = '<p>Nothing to report yet.</p>';
      return;
    }
    var html = '';
    for (var l of log) {
      var year = Math.floor((l.t - 1) / 12), month = l.t - 12 * year;
      var who = l.p && RF.partyInfo[l.p] ?
          '<span class="p-' + l.p + '">' + esc(RF.partyInfo[l.p].name) + '</span>' : esc(l.who);
      html += '<div class="rf-camp-line"><div class="rf-camp-date">' + MONTHS[month] + ' ' + year +
          (who ? ' · ' + who : '') + '</div><div>' + esc(l.text) + '</div></div>';
    }
    el.innerHTML = html;
  };

  // ---- The record -----------------------------------------------------------
  // A decision worth remembering is marked once. The record lists it in
  // plain words as the game goes; the ending quotes the heaviest ones with
  // a judgement. Judgements are the mod's, and critics are named as such.
  // To add one: define it here, call RF.mark(Q, 'id') where the choice is made.
  var LEDGER = {
    bowed: {
      weight: 3,
      record: 'The congress\'s choice of leadership was overturned, and Moscow\'s candidate took the Zentrale.',
      verdict: 'When the delegates\' vote was overturned in Moscow\'s favour, a leadership of the German party became an appointment of the International\'s apparatus. Critics of the KPD, among them the Left Opposition, held that a party led this way could not answer to its own workers.'
    },
    defied: {
      weight: 2,
      record: 'The congress stood by its vote against Moscow\'s demand.',
      verdict: 'The party kept its leadership and some independence, and lost Moscow\'s confidence. Whether a German party could stand alone in an International run from Moscow was the question that defiance left open.'
    },
    missed_window: {
      weight: 3,
      record: 'A revolutionary opening passed without the party using it.',
      verdict: 'The situation was ripe for a few months and the party let it pass. The Left Opposition would say that the leadership hesitated. Many historians doubt that an opening ever existed. The record cannot settle that, only show that the party did not try to find out.'
    }
  };
  RF.ledger = LEDGER;

  RF.mark = function(Q, id) {
    if (!LEDGER[id] || Q['ledger_' + id]) {
      return;
    }
    Q['ledger_' + id] = 1;
    var log = readJson(Q.ledger);
    log.push({id: id, t: now(Q)});
    Q.ledger = JSON.stringify(log);
  };

  RF.renderRecord = function(Q) {
    var el = document.getElementById('rf-record');
    if (!el) {
      return;
    }
    var log = readJson(Q.ledger).filter(function(l) { return LEDGER[l.id]; });
    if (!log.length) {
      el.innerHTML = '<p>Nothing yet.</p>';
      return;
    }
    var html = '';
    for (var l of log.slice().reverse()) {
      var year = Math.floor((l.t - 1) / 12), month = l.t - 12 * year;
      html += '<div class="rf-camp-line"><div class="rf-camp-date">' + MONTHS[month] + ' ' + year +
          '</div><div>' + esc(LEDGER[l.id].record) + '</div></div>';
    }
    el.innerHTML = html;
  };

  // The heaviest entries of the record with their judgements, for an
  // ending page (up to n, heaviest first, earlier first among equals).
  RF.verdict = function(Q, n) {
    var log = readJson(Q.ledger).filter(function(l) { return LEDGER[l.id]; });
    log.sort(function(a, b) {
      return LEDGER[b.id].weight - LEDGER[a.id].weight || a.t - b.t;
    });
    return log.slice(0, n || 3).map(function(l) {
      return '<p>' + esc(LEDGER[l.id].verdict) + '</p>';
    }).join('');
  };

  // ---- The opening for revolution -------------------------------------------
  // A revolutionary opening needs two things at once: a state in crisis
  // (the situation) and a party able to use it. The opening is open while
  // the situation stands high. If it closes without a rising, it is
  // marked as missed. It opens at 60 and closes below 50, so a single
  // bad month does not shut it.
  var OPEN_AT = 60, CLOSE_AT = 50;

  // The party's strength to use an opening, 0 to 100: arms and plans, a
  // hold on the unions, a united party and a working apparatus.
  RF.subjective = function(Q) {
    return Math.round(clamp(0.3 * Q.readiness + 0.25 * Q.union_influence +
        0.25 * (100 - (Q.party_dissent || 0)) + 0.2 * Q.apparatus, 0, 100));
  };

  RF.monthlyOpening = function(Q) {
    if (!Q.window_open && Q.rev_situation >= OPEN_AT) {
      Q.window_open = 1;
      Q.window_since = now(Q);
      Q.window_used = 0;
    } else if (Q.window_open && Q.rev_situation < CLOSE_AT) {
      Q.window_open = 0;
      Q.windows_seen += 1;
      if (!Q.window_used) {
        Q.windows_missed += 1;
        RF.mark(Q, 'missed_window');
      }
    }
    Q.subjective = RF.subjective(Q);
  };

  RF.openingStatus = function(Q) {
    Q.subjective = RF.subjective(Q);
    if (Q.window_open) {
      var y = Math.floor((Q.window_since - 1) / 12), m = Q.window_since - 12 * y;
      Q.opening_text = 'Open since ' + MONTHS[m] + ' ' + y;
    } else {
      Q.opening_text = Q.windows_seen ? 'Closed' : 'Not yet';
    }
  };
}());
