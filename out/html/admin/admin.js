// Die Rote Fahne admin panel.
// Edits achievements, images and the game's text files, and publishes them
// to GitHub as one commit. The GitHub Pages workflow then rebuilds the site.
(function() {
  'use strict';

  var API = 'https://api.github.com';
  var CFG_KEY = 'rf_admin_cfg';
  var SITE = 'out/html/';                       // the web root inside the repository
  var IMAGES_JSON = SITE + 'data/images.json';
  var ACH_JSON = SITE + 'data/achievements.json';
  var RF = window.RF || {names: {}, factionPersons: {}, partyInfo: {}, factions: []};

  // ---- small helpers --------------------------------------------------------

  var $ = function(sel, el) { return (el || document).querySelector(sel); };
  var $$ = function(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var esc = function(text) {
    return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var h = function(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  var debounce = function(fn, ms) {
    var timer;
    return function() {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(self, args); }, ms);
    };
  };
  var slug = function(text) {
    return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  };
  var ago = function(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) { return 'just now'; }
    if (s < 3600) { return Math.round(s / 60) + ' min ago'; }
    if (s < 86400) { return Math.round(s / 3600) + ' h ago'; }
    return Math.round(s / 86400) + ' days ago';
  };
  var toast = function(text, isError) {
    var el = h('<div class="toast' + (isError ? ' err' : '') + '"></div>');
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(function() { el.remove(); }, isError ? 7000 : 3500);
  };
  var utf8ToB64 = function(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  };
  var b64ToUtf8 = function(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return new TextDecoder().decode(bytes);
  };

  // ---- state ----------------------------------------------------------------

  var state = {
    cfg: null,
    tree: [],               // [{path, sha, type}]
    files: {},              // path -> {original, text, sha}
    staged: {},             // path -> {text | base64 | remove, label}
    previews: {},           // staged image path -> data URL
    images: {}, imagesOriginal: '{}',
    achievements: [], achOriginal: '[]',
    game: null,             // ../game.json, for scene titles and tags
    runs: [],
    view: 'dashboard'
  };

  // ---- GitHub ---------------------------------------------------------------

  var gh = function(path, opts) {
    opts = opts || {};
    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + state.cfg.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) { headers['Content-Type'] = 'application/json'; }
    return fetch(API + path, {method: opts.method || 'GET', headers: headers,
                              body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store'})
      .then(function(r) {
        if (r.status == 404 && opts.allow404) { return null; }
        return r.json().catch(function() { return {}; }).then(function(json) {
          if (!r.ok) {
            var err = new Error((json && json.message) || ('GitHub answered ' + r.status));
            err.status = r.status;
            throw err;
          }
          return json;
        });
      });
  };
  var repoPath = function(rest) {
    return '/repos/' + state.cfg.owner + '/' + state.cfg.repo + rest;
  };

  var loadTree = function() {
    return gh(repoPath('/git/trees/' + encodeURIComponent(state.cfg.branch) + '?recursive=1')).then(function(json) {
      state.tree = json.tree.filter(function(e) { return e.type == 'blob'; });
    });
  };
  var treeEntry = function(path) {
    for (var e of state.tree) { if (e.path == path) { return e; } }
    return null;
  };

  // Read a text file (cached). Returns null when the file does not exist.
  var readFile = function(path) {
    if (state.files[path]) { return Promise.resolve(state.files[path]); }
    var entry = treeEntry(path);
    if (!entry) { return Promise.resolve(null); }
    return gh(repoPath('/git/blobs/' + entry.sha)).then(function(blob) {
      var text = b64ToUtf8(blob.content);
      state.files[path] = {original: text, text: text, sha: entry.sha};
      return state.files[path];
    });
  };

  // One commit with every staged change, through the Git Data API.
  var commitStaged = function(message) {
    var paths = Object.keys(state.staged);
    var branchRef = repoPath('/git/ref/heads/' + encodeURIComponent(state.cfg.branch));
    var headSha;
    return gh(branchRef).then(function(ref) {
      headSha = ref.object.sha;
      return gh(repoPath('/git/commits/' + headSha));
    }).then(function(head) {
      // refuse to overwrite a file someone changed on GitHub (another tab,
      // another person) after this panel loaded it
      return gh(repoPath('/git/trees/' + head.tree.sha + '?recursive=1')).then(function(now) {
        var current = {};
        now.tree.forEach(function(e) { current[e.path] = e.sha; });
        var stale = paths.filter(function(path) {
          var mine = treeEntry(path);
          return (mine ? mine.sha : undefined) !== current[path];
        });
        if (stale.length) {
          var err = new Error('changed on GitHub since this panel loaded it: ' + stale.join(', ') +
                              '. Reload the panel to get the latest version, then make this edit again.');
          throw err;
        }
        return head;
      });
    }).then(function(head) {
      return Promise.all(paths.map(function(path) {
        var c = state.staged[path];
        if (c.remove) {
          return Promise.resolve({path: path, mode: '100644', type: 'blob', sha: null});
        }
        var body = c.base64 != null ? {content: c.base64, encoding: 'base64'} : {content: c.text, encoding: 'utf-8'};
        return gh(repoPath('/git/blobs'), {method: 'POST', body: body}).then(function(blob) {
          return {path: path, mode: '100644', type: 'blob', sha: blob.sha};
        });
      })).then(function(entries) {
        return gh(repoPath('/git/trees'), {method: 'POST', body: {base_tree: head.tree.sha, tree: entries}});
      });
    }).then(function(tree) {
      return gh(repoPath('/git/commits'), {method: 'POST', body: {message: message, tree: tree.sha, parents: [headSha]}});
    }).then(function(commit) {
      return gh(repoPath('/git/refs/heads/' + encodeURIComponent(state.cfg.branch)),
                {method: 'PATCH', body: {sha: commit.sha}}).then(function() { return commit; });
    });
  };

  // ---- staging --------------------------------------------------------------

  var stage = function(path, change) {
    state.staged[path] = change;
    updatePublishButton();
  };
  var unstage = function(path) {
    delete state.staged[path];
    delete state.previews[path];
    updatePublishButton();
  };
  var stagedCount = function() { return Object.keys(state.staged).length; };
  var updatePublishButton = function() {
    var n = stagedCount();
    var btn = $('#publish-btn');
    btn.disabled = n == 0;
    btn.innerHTML = 'Publish' + (n ? ' <span class="badge">' + n + '</span>' : '');
  };
  var stageText = function(path, text, original, label) {
    if (text == original) {
      unstage(path);
    } else {
      stage(path, {text: text, label: label});
    }
  };
  var stageImagesJson = function() {
    var text = JSON.stringify(state.images, null, 2) + '\n';
    stageText(IMAGES_JSON, text, state.imagesOriginal, 'Image list');
  };
  var stageAchievementsJson = function() {
    var text = JSON.stringify(state.achievements, null, 2) + '\n';
    stageText(ACH_JSON, text, state.achOriginal, 'Achievements');
  };

  // ---- deploy status --------------------------------------------------------

  var deployTimer = null;
  var refreshDeploy = function() {
    return gh(repoPath('/actions/runs?per_page=6&branch=' + encodeURIComponent(state.cfg.branch)))
      .then(function(json) {
        state.runs = json.workflow_runs || [];
        var run = state.runs[0];
        var pill = $('#deploy-pill');
        if (!run) {
          pill.className = 'pill';
          pill.textContent = 'No deploys yet';
        } else if (run.status != 'completed') {
          pill.className = 'pill run dot';
          pill.textContent = 'Deploying…';
        } else if (run.conclusion == 'success') {
          pill.className = 'pill ok dot';
          pill.textContent = 'Live · ' + ago(run.updated_at);
        } else {
          pill.className = 'pill fail dot';
          pill.textContent = 'Deploy failed';
        }
        pill.title = run ? run.display_title : '';
        pill.onclick = run ? function() { window.open(run.html_url, '_blank'); } : null;
        if (state.view == 'dashboard') { renderDashboard(); }
        clearTimeout(deployTimer);
        if (run && run.status != 'completed') {
          deployTimer = setTimeout(refreshDeploy, 8000);
        }
      }).catch(function(e) {
        $('#deploy-pill').textContent = e.status == 403 ? 'No access to Actions' : 'Status unknown';
      });
  };

  // ---- publish dialog -------------------------------------------------------

  // A short line diff, enough to review a text change.
  var diffLines = function(a, b) {
    var x = a.split('\n'), y = b.split('\n');
    var start = 0;
    while (start < x.length && start < y.length && x[start] == y[start]) { start++; }
    var ex = x.length - 1, ey = y.length - 1;
    while (ex >= start && ey >= start && x[ex] == y[ey]) { ex--; ey--; }
    var out = [];
    if (start > 0) { out.push('<div class="gap">… ' + start + ' unchanged lines</div>'); }
    for (var i = start; i <= ex; i++) { out.push('<div class="del">- ' + esc(x[i]) + '</div>'); }
    for (var j = start; j <= ey; j++) { out.push('<div class="add">+ ' + esc(y[j]) + '</div>'); }
    if (ex < x.length - 1) { out.push('<div class="gap">… ' + (x.length - 1 - ex) + ' unchanged lines</div>'); }
    return out.join('');
  };

  var openPublish = function() {
    var list = $('#publish-list');
    list.innerHTML = '';
    var labels = [];
    Object.keys(state.staged).sort().forEach(function(path) {
      var c = state.staged[path];
      labels.push(c.label || path.split('/').pop());
      var kind = c.remove ? 'deleted' : (treeEntry(path) ? 'changed' : 'new');
      var row = h('<div class="pl"><div class="pl-head"><div><code>' + esc(path) + '</code></div>' +
                  '<div><span class="pill">' + kind + '</span> <button type="button" class="btn small ghost">Undo</button></div></div></div>');
      $('button', row).onclick = function() {
        revertStaged(path);
        if (stagedCount()) { openPublish(); } else { $('#publish-dialog').close(); }
      };
      if (c.text != null) {
        var before = state.files[path] ? state.files[path].original :
            (path == IMAGES_JSON ? state.imagesOriginal : path == ACH_JSON ? state.achOriginal : '');
        row.appendChild(h('<div class="diff">' + diffLines(before, c.text) + '</div>'));
      } else if (state.previews[path]) {
        row.appendChild(h('<img src="' + esc(state.previews[path]) + '" style="max-height:80px;margin-top:6px;border-radius:6px">'));
      }
      list.appendChild(row);
    });
    $('#publish-branch').textContent = state.cfg.branch;
    var uniq = labels.filter(function(l, i) { return labels.indexOf(l) == i; });
    $('#publish-message').value = 'Admin: update ' + uniq.slice(0, 4).join(', ') + (uniq.length > 4 ? ' and more' : '');
    if (!$('#publish-dialog').open) { $('#publish-dialog').showModal(); }
  };

  // Undo one staged change and put the editors back as they were.
  var revertStaged = function(path) {
    if (path == IMAGES_JSON) {
      state.images = JSON.parse(state.imagesOriginal);
      Object.keys(state.staged).forEach(function(p) { if (p.indexOf(SITE + 'img/') == 0) { unstage(p); } });
    } else if (path == ACH_JSON) {
      state.achievements = JSON.parse(state.achOriginal);
    } else if (state.files[path]) {
      state.files[path].text = state.files[path].original;
    }
    unstage(path);
    renderView();
  };

  var publish = function() {
    var message = $('#publish-message').value.trim() || 'Admin update';
    var btn = $('#publish-confirm');
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    commitStaged(message).then(function(commit) {
      // what was staged is now the original
      Object.keys(state.staged).forEach(function(path) {
        var c = state.staged[path];
        if (c.remove) {
          delete state.files[path];
        } else if (state.files[path]) {
          state.files[path].original = c.text;
          state.files[path].sha = state.files[path].sha || 'new';
        }
      });
      state.imagesOriginal = JSON.stringify(state.images, null, 2) + '\n';
      state.achOriginal = JSON.stringify(state.achievements, null, 2) + '\n';
      state.staged = {};
      updatePublishButton();
      $('#publish-dialog').close();
      toast('Published. The site is rebuilding.');
      return loadTree().then(function() {
        // the deploy run appears a few seconds after the push
        setTimeout(refreshDeploy, 4000);
        renderView();
      });
    }).catch(function(e) {
      toast('Publishing failed: ' + e.message, true);
    }).then(function() {
      btn.disabled = false;
      btn.textContent = 'Publish';
    });
  };

  // ---- dashboard ------------------------------------------------------------

  var commitsCache = null;
  var renderDashboard = function() {
    var v = $('#view-dashboard');
    var imgCount = Object.keys(state.images).length;
    var run = state.runs[0];
    v.innerHTML = '';
    v.appendChild(h('<div class="stats">' +
      '<div class="stat"><span class="muted">Achievements</span><b>' + state.achievements.length + '</b></div>' +
      '<div class="stat"><span class="muted">Images</span><b>' + imgCount + '</b></div>' +
      '<div class="stat"><span class="muted">Unpublished changes</span><b>' + stagedCount() + '</b></div>' +
      '<div class="stat"><span class="muted">Last deploy</span><b style="font-size:16px">' +
        (run ? esc(run.status != 'completed' ? 'running' : run.conclusion) + '</b><span class="muted small">' + ago(run.updated_at) : '–</b>') +
      '</span></div></div>'));
    var grid = h('<div class="grid2"></div>');
    var deploys = h('<div class="panel"><div class="panel-head"><h2>Deploys</h2><button class="btn small">Refresh</button></div><ul class="list"></ul></div>');
    $('button', deploys).onclick = refreshDeploy;
    var ul = $('ul', deploys);
    if (!state.runs.length) { ul.appendChild(h('<li class="muted">No workflow runs found.</li>')); }
    state.runs.forEach(function(r) {
      var cls = r.status != 'completed' ? 'run' : r.conclusion == 'success' ? 'ok' : 'fail';
      var label = r.status != 'completed' ? 'running' : r.conclusion;
      ul.appendChild(h('<li><span class="pill dot ' + cls + '">' + esc(label) + '</span><div class="grow ellipsis">' +
        esc(r.display_title) + '</div><a class="small" target="_blank" rel="noopener" href="' + esc(r.html_url) + '">' + ago(r.updated_at) + '</a></li>'));
    });
    var commits = h('<div class="panel"><div class="panel-head"><h2>Recent changes</h2></div><ul class="list"><li class="muted">Loading…</li></ul></div>');
    grid.appendChild(deploys);
    grid.appendChild(commits);
    v.appendChild(grid);
    var quick = h('<div class="panel"><h2 style="margin-bottom:10px">Quick actions</h2>' +
      '<button class="btn" data-go="achievements">★ New achievement</button> ' +
      '<button class="btn" data-go="images">▣ Add an image</button> ' +
      '<button class="btn" data-go="texts">¶ Edit an event or card</button></div>');
    $$('[data-go]', quick).forEach(function(b) {
      b.onclick = function() {
        location.hash = b.getAttribute('data-go');
        if (b.getAttribute('data-go') == 'achievements') { setTimeout(newAchievement, 50); }
      };
    });
    v.appendChild(quick);
    var fill = function(list) {
      var cu = $('ul', commits);
      cu.innerHTML = '';
      list.forEach(function(c) {
        cu.appendChild(h('<li><div class="grow"><div class="ellipsis">' + esc(c.commit.message.split('\n')[0]) + '</div>' +
          '<div class="muted small">' + esc(c.commit.author.name) + ' · ' + ago(c.commit.author.date) + '</div></div>' +
          '<a class="small" target="_blank" rel="noopener" href="' + esc(c.html_url) + '">' + c.sha.slice(0, 7) + '</a></li>'));
      });
    };
    if (commitsCache) { fill(commitsCache); }
    gh(repoPath('/commits?per_page=8&sha=' + encodeURIComponent(state.cfg.branch))).then(function(list) {
      commitsCache = list;
      fill(list);
    }).catch(function() {});
  };

  // ---- achievements ---------------------------------------------------------

  var FACTION_VALUES = ['right', 'center', 'left', 'ultra', 'stalin'];
  var QUALITIES = [
    {q: 'rf_ending', label: 'Ending', values: ['revolution', 'frankfurt', 'collapse']},
    {q: 'grade', label: 'Ending grade (0 broken – 3 revolution)'},
    {q: 'leader', label: 'Faction leading the party', values: FACTION_VALUES},
    {q: 'members', label: 'Members (thousands)'},
    {q: 'splits', label: 'Factions that split off'},
    {q: 'unity', label: 'Party unity (0–100)'},
    {q: 'autonomy', label: 'Party autonomy (0–100)'},
    {q: 'moscow_trust', label: "Moscow's trust (0–100)"},
    {q: 'rev_situation', label: 'Revolutionary situation (0–100)'},
    {q: 'readiness', label: 'Armed readiness (0–100)'},
    {q: 'union_influence', label: 'Union influence (0–100)'},
    {q: 'repression', label: 'State repression (0–100)'},
    {q: 'spd_relation', label: 'Relations with the SPD (0–100)'},
    {q: 'october_outcome', label: 'Outcome of October 1923', values: ['retreat', 'crushed']},
    {q: 'workers_govt', label: "In the Saxon/Thuringian workers' governments (0/1)"},
    {q: 'party_banned', label: 'Party banned (0/1)'},
    {q: 'line', label: 'Comintern line', values: ['united_front', 'insurrection', 'bolshevization']},
    {q: 'year', label: 'Year'},
    {q: 'month', label: 'Month (1–12)'},
    {q: 'funds', label: 'Party funds'}
  ];
  FACTION_VALUES.forEach(function(f) {
    QUALITIES.push({q: f + '_strength', label: (RF.names[f] || f) + ' strength (%)'});
    QUALITIES.push({q: f + '_dissent', label: (RF.names[f] || f) + ' dissent (0–99)'});
    QUALITIES.push({q: f + '_expelled', label: (RF.names[f] || f) + ' left the party (0/1)'});
  });
  var OPS = ['==', '!=', '>=', '>', '<=', '<'];
  var formatValue = function(v) {
    v = String(v).trim();
    if (v === '') { return '0'; }
    if (/^-?\d+(\.\d+)?$/.test(v) || v == 'true' || v == 'false') { return v; }
    return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  };
  var buildCondition = function(rules, join) {
    if (!rules || !rules.length) { return 'false'; }
    return rules.map(function(r) {
      return 'Q.' + r.q + ' ' + r.op + ' ' + formatValue(r.v);
    }).join(join == 'or' ? ' || ' : ' && ');
  };
  var checkCondition = function(cond) {
    try {
      new Function('Q', 'return (' + cond + ');');
      return null;
    } catch (e) {
      return e.message;
    }
  };

  var achSelected = null;   // index into state.achievements, or 'new'
  var achDraft = null;

  var newAchievement = function() {
    achSelected = 'new';
    achDraft = {id: '', name: '', description: '', when: 'end', hidden: false,
                rules: [{q: 'rf_ending', op: '==', v: 'revolution'}], join: 'and', mode: 'simple', condition: ''};
    renderAchievements();
  };

  var renderAchievements = function() {
    var v = $('#view-achievements');
    v.innerHTML = '';
    var split = h('<div class="split"></div>');
    var side = h('<div class="side-list"><div class="tools"><button class="btn primary small">+ New achievement</button></div><div class="items"></div></div>');
    $('button', side).onclick = newAchievement;
    var items = $('.items', side);
    if (!state.achievements.length) {
      items.appendChild(h('<div class="empty">No achievements yet.</div>'));
    }
    state.achievements.forEach(function(a, i) {
      var icon = imageSrc('achievement:' + a.id);
      var row = h('<div class="side-item' + (achSelected === i ? ' active' : '') + '">' +
        '<div class="ach-icon">' + (icon ? '<img src="' + esc(icon) + '">' : '★') + '</div>' +
        '<div class="grow"><div class="ellipsis"><b>' + esc(a.name) + '</b></div><div class="meta ellipsis">' +
        esc(a.description || '') + '</div></div>' +
        (a.hidden ? '<span class="pill">hidden</span>' : '') + '</div>');
      row.onclick = function() {
        achSelected = i;
        achDraft = JSON.parse(JSON.stringify(a));
        if (!achDraft.mode) { achDraft.mode = achDraft.rules ? 'simple' : 'custom'; }
        renderAchievements();
      };
      items.appendChild(row);
    });
    split.appendChild(side);
    split.appendChild(achDraft ? achievementEditor() :
      h('<div class="panel empty">Choose an achievement on the left, or create a new one.<br><br>' +
        'Achievements are checked when a game ends (or every month), unless the player turned on exact numbers.</div>'));
    v.appendChild(split);
  };

  var achievementEditor = function() {
    var d = achDraft;
    var isNew = achSelected === 'new';
    var panel = h('<div class="panel"></div>');
    var icon = d.id ? imageSrc('achievement:' + d.id) : null;
    panel.innerHTML =
      '<div class="panel-head"><h2>' + (isNew ? 'New achievement' : esc(d.name)) + '</h2><div>' +
        (isNew ? '' : '<button class="btn small" data-act="up">↑</button> <button class="btn small" data-act="down">↓</button> ' +
        '<button class="btn small danger-ghost" data-act="delete">Delete</button>') + '</div></div>' +
      '<div style="display:flex;gap:16px;align-items:flex-start">' +
        '<div><div class="ach-icon" style="width:84px;height:84px;font-size:32px;cursor:pointer" title="Upload an icon">' +
          (icon ? '<img src="' + esc(icon) + '">' : '★') + '</div>' +
          '<button class="btn small" data-act="icon" style="margin-top:6px;width:84px;justify-content:center">Icon…</button></div>' +
        '<div style="flex:1">' +
          '<div class="row2"><label>Name<input data-f="name" value="' + esc(d.name) + '"></label>' +
          '<label>ID<input data-f="id" value="' + esc(d.id) + '" placeholder="made from the name"' + (isNew ? '' : ' readonly') + '></label></div>' +
          '<label>Description<textarea data-f="description" rows="2">' + esc(d.description) + '</textarea></label>' +
          '<div class="row2"><label>Checked<select data-f="when"><option value="end">when the game ends</option>' +
          '<option value="anytime">every month</option></select></label>' +
          '<label class="check" style="margin-top:24px"><input type="checkbox" data-f="hidden"' + (d.hidden ? ' checked' : '') + '> Hidden until unlocked</label></div>' +
        '</div></div>' +
      '<h3 style="margin:8px 0">Condition</h3>' +
      '<div class="seg" style="margin-bottom:10px"><button data-mode="simple">Rules</button><button data-mode="custom">JavaScript</button></div>' +
      '<div data-part="simple"></div>' +
      '<div data-part="custom"><textarea data-f="condition" rows="3" style="font-family:var(--mono)" placeholder="Q.rf_ending == \'revolution\' && Q.splits == 0"></textarea>' +
        '<p class="muted small">Any JavaScript expression over <code>Q</code>, the game state.</p></div>' +
      '<div class="code-preview" data-part="preview"></div><p class="error small" data-part="err"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" data-act="cancel">Cancel</button>' +
      '<button class="btn primary" data-act="save">' + (isNew ? 'Add achievement' : 'Save changes') + '</button></div>';
    $('[data-f="when"]', panel).value = d.when || 'end';
    $('[data-f="condition"]', panel).value = d.mode == 'custom' ? (d.condition || '') : '';

    var refresh = function() {
      $$('[data-mode]', panel).forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-mode') == d.mode); });
      $('[data-part="simple"]', panel).classList.toggle('hidden', d.mode != 'simple');
      $('[data-part="custom"]', panel).classList.toggle('hidden', d.mode != 'custom');
      var cond = d.mode == 'simple' ? buildCondition(d.rules, d.join) : (d.condition || '');
      $('[data-part="preview"]', panel).textContent = cond || '(empty)';
      $('[data-part="err"]', panel).textContent = cond ? (checkCondition(cond) ? 'Syntax error: ' + checkCondition(cond) : '') : '';
    };
    var renderRules = function() {
      var box = $('[data-part="simple"]', panel);
      box.innerHTML = '';
      (d.rules || []).forEach(function(r, i) {
        var known = QUALITIES.filter(function(x) { return x.q == r.q; })[0];
        var row = h('<div class="cond-row"><select></select><select></select><span></span><button class="btn small ghost">✕</button></div>');
        var qs = row.children[0], os = row.children[1], vs = row.children[2];
        QUALITIES.forEach(function(x) { qs.appendChild(h('<option value="' + x.q + '">' + esc(x.label) + '</option>')); });
        qs.appendChild(h('<option value="__other">Other quality…</option>'));
        qs.value = known ? r.q : '__other';
        OPS.forEach(function(o) { os.appendChild(h('<option>' + o + '</option>')); });
        os.value = r.op;
        if (known && known.values) {
          var sel = h('<select></select>');
          known.values.forEach(function(x) {
            sel.appendChild(h('<option value="' + esc(x) + '">' + esc(RF.names[x] || x) + '</option>'));
          });
          sel.value = r.v;
          sel.onchange = function() { r.v = sel.value; refresh(); };
          vs.appendChild(sel);
        } else {
          var inp = h('<input placeholder="value">');
          inp.value = r.v;
          inp.oninput = function() { r.v = inp.value; refresh(); };
          vs.appendChild(inp);
          if (!known) {
            var other = h('<input placeholder="quality name" style="margin-top:4px">');
            other.value = r.q;
            other.oninput = function() { r.q = other.value.replace(/[^\w]/g, ''); refresh(); };
            vs.appendChild(other);
          }
        }
        qs.onchange = function() {
          r.q = qs.value == '__other' ? '' : qs.value;
          var k = QUALITIES.filter(function(x) { return x.q == r.q; })[0];
          r.v = k && k.values ? k.values[0] : '';
          renderRules();
          refresh();
        };
        os.onchange = function() { r.op = os.value; refresh(); };
        row.children[3].onclick = function() { d.rules.splice(i, 1); renderRules(); refresh(); };
        box.appendChild(row);
      });
      var foot = h('<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">' +
        '<button class="btn small">+ Rule</button><span class="muted small">Combine with</span>' +
        '<select style="width:auto"><option value="and">all rules (AND)</option><option value="or">any rule (OR)</option></select></div>');
      foot.children[0].onclick = function() { d.rules.push({q: 'members', op: '>=', v: '200'}); renderRules(); refresh(); };
      foot.children[2].value = d.join || 'and';
      foot.children[2].onchange = function() { d.join = foot.children[2].value; refresh(); };
      box.appendChild(foot);
    };
    renderRules();

    $$('[data-mode]', panel).forEach(function(b) {
      b.onclick = function() {
        var m = b.getAttribute('data-mode');
        if (m == 'custom' && d.mode == 'simple') {
          d.condition = buildCondition(d.rules, d.join);
          $('[data-f="condition"]', panel).value = d.condition;
        }
        d.mode = m;
        refresh();
      };
    });
    $$('[data-f]', panel).forEach(function(inp) {
      var f = inp.getAttribute('data-f');
      var on = function() {
        d[f] = inp.type == 'checkbox' ? inp.checked : inp.value;
        if (f == 'name' && isNew && !panel.dataset.idTouched) {
          d.id = slug(inp.value);
          $('[data-f="id"]', panel).value = d.id;
        }
        if (f == 'id') { panel.dataset.idTouched = '1'; }
        refresh();
      };
      inp.addEventListener('input', on);
      inp.addEventListener('change', on);
    });
    var act = function(name, fn) {
      var b = $('[data-act="' + name + '"]', panel);
      if (b) { b.onclick = fn; }
    };
    var pickIcon = function() {
      if (!d.id) { toast('Give the achievement a name first.', true); return; }
      pickImage('achievement:' + d.id, CATEGORIES.achievements, d.name, function() { renderAchievements(); });
    };
    act('icon', pickIcon);
    $('.ach-icon', panel).onclick = pickIcon;
    act('cancel', function() { achDraft = null; achSelected = null; renderAchievements(); });
    act('delete', function() {
      if (!confirm('Delete the achievement "' + d.name + '"?')) { return; }
      state.achievements.splice(achSelected, 1);
      removeImage('achievement:' + d.id);
      achDraft = null;
      achSelected = null;
      stageAchievementsJson();
      renderAchievements();
    });
    var move = function(delta) {
      var i = achSelected, j = i + delta;
      if (j < 0 || j >= state.achievements.length) { return; }
      var list = state.achievements;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      achSelected = j;
      stageAchievementsJson();
      renderAchievements();
    };
    act('up', function() { move(-1); });
    act('down', function() { move(1); });
    act('save', function() {
      d.id = slug(d.id || d.name);
      if (!d.name.trim() || !d.id) { toast('An achievement needs a name.', true); return; }
      var clash = state.achievements.some(function(a, i) { return a.id == d.id && i !== achSelected; });
      if (clash) { toast('Another achievement already uses the ID "' + d.id + '".', true); return; }
      var cond = d.mode == 'simple' ? buildCondition(d.rules, d.join) : (d.condition || '').trim();
      var err = checkCondition(cond);
      if (err) { toast('The condition has an error: ' + err, true); return; }
      var out = {id: d.id, name: d.name.trim(), description: (d.description || '').trim(), condition: cond,
                 when: d.when || 'end', hidden: !!d.hidden};
      if (d.mode == 'simple') { out.rules = d.rules; out.join = d.join || 'and'; }
      if (achSelected === 'new') {
        state.achievements.push(out);
        achSelected = state.achievements.length - 1;
      } else {
        state.achievements[achSelected] = out;
      }
      achDraft = JSON.parse(JSON.stringify(out));
      achDraft.mode = out.rules ? 'simple' : 'custom';
      stageAchievementsJson();
      toast('Saved. Publish to put it on the site.');
      renderAchievements();
    });
    refresh();
    return panel;
  };

  // ---- images ---------------------------------------------------------------

  // Image size and shape for each kind of picture.
  var CATEGORIES = {
    events: {label: 'Events', w: 1200, h: 675, shape: 'wide', type: 'image/jpeg', dir: 'events'},
    cards: {label: 'Cards', w: 480, h: 600, shape: '', type: 'image/jpeg', dir: 'cards'},
    advisors: {label: 'Advisors', w: 480, h: 600, shape: '', type: 'image/jpeg', dir: 'advisors'},
    leaders: {label: 'Leaders', w: 480, h: 600, shape: '', type: 'image/jpeg', dir: 'leaders'},
    parties: {label: 'Party logos', w: 256, h: 256, shape: 'square', type: 'image/png', dir: 'parties'},
    achievements: {label: 'Achievement icons', w: 256, h: 256, shape: 'square', type: 'image/png', dir: 'achievements'}
  };
  var categoryOfKey = function(key) {
    var prefix = key.split(':')[0];
    return {event: 'events', card: 'cards', deck: 'cards', advisor: 'advisors', leader: 'leaders', person: 'leaders', party: 'parties',
            achievement: 'achievements'}[prefix] || 'cards';
  };
  var imgCat = 'events';

  // The picture to show for an image key: a staged upload, else the site's file.
  var imageSrc = function(key) {
    var rel = state.images[key];
    if (!rel) { return null; }
    var repoFile = SITE + rel.split('?')[0];
    if (state.previews[repoFile]) { return state.previews[repoFile]; }
    return '../' + rel;
  };

  var slots = function(cat) {
    var out = [];
    var scenes = state.game ? state.game.scenes : {};
    var byTag = function(tags) {
      Object.keys(scenes).sort().forEach(function(id) {
        var s = scenes[id];
        if ((s.tags || []).some(function(t) { return tags.indexOf(t) >= 0; })) {
          out.push({key: null, id: id, title: s.title || id});
        }
      });
    };
    if (cat == 'events') { byTag(['rf_event']); out.forEach(function(s) { s.key = 'event:' + s.id; }); }
    if (cat == 'cards') {
      out.push({key: 'deck:rf_party', id: 'rf_party', title: 'Party Affairs (the deck)'});
      byTag(['rf_party']);
      out.forEach(function(s) { s.key = s.key || 'card:' + s.id; });
    }
    if (cat == 'advisors') {
      Object.keys(RF.advisors || {}).forEach(function(id) {
        var a = RF.advisors[id];
        out.push({key: 'advisor:' + id, id: id, title: a.name + ' · ' + ((RF.advisorSlots || {})[a.slot] || {}).name});
      });
    }
    if (cat == 'leaders') {
      (RF.factions || FACTION_VALUES).forEach(function(f) {
        out.push({key: 'leader:' + f, id: f, title: (RF.factionPersons[f] || f) + ' · ' + (RF.names[f] || f)});
      });
    }
    if (cat == 'leaders') {
      Object.keys(RF.people || {}).forEach(function(id) {
        out.push({key: 'person:' + id, id: id, title: RF.people[id].name + ' · ' + RF.people[id].role});
      });
    }
    if (cat == 'parties') {
      Object.keys(RF.partyInfo || {}).forEach(function(p) {
        out.push({key: 'party:' + p, id: p, title: RF.partyInfo[p].name + ' · ' + RF.partyInfo[p].full});
      });
    }
    if (cat == 'achievements') {
      state.achievements.forEach(function(a) { out.push({key: 'achievement:' + a.id, id: a.id, title: a.name}); });
    }
    // keys in the image list that no slot covers (renamed scenes and the like)
    Object.keys(state.images).forEach(function(k) {
      if (categoryOfKey(k) == cat && !out.some(function(s) { return s.key == k; })) {
        out.push({key: k, id: k.split(':')[1], title: k.split(':')[1] + ' (not in the game)'});
      }
    });
    return out;
  };

  var renderImages = function() {
    var v = $('#view-images');
    v.innerHTML = '';
    var tabs = h('<div class="tabs"></div>');
    Object.keys(CATEGORIES).forEach(function(c) {
      var count = Object.keys(state.images).filter(function(k) { return categoryOfKey(k) == c; }).length;
      var b = h('<button class="' + (c == imgCat ? 'on' : '') + '">' + CATEGORIES[c].label +
                (count ? ' · ' + count : '') + '</button>');
      b.onclick = function() { imgCat = c; renderImages(); };
      tabs.appendChild(b);
    });
    v.appendChild(tabs);
    var cat = CATEGORIES[imgCat];
    v.appendChild(h('<p class="muted">Drop a picture on a slot, or click it. Pictures are cropped to ' + cat.w + ' × ' + cat.h +
      ' and appear in the game after publishing.' + (state.game ? '' : ' <b>Could not load the game\'s scene list; only existing images are shown.</b>') + '</p>'));
    var grid = h('<div class="img-grid"></div>');
    var list = slots(imgCat);
    if (!list.length) { grid.appendChild(h('<div class="empty">Nothing here yet.</div>')); }
    list.forEach(function(s) {
      var src = imageSrc(s.key);
      var tile = h('<div class="img-tile"><div class="thumb ' + cat.shape + '">' +
        (src ? '<img src="' + esc(src) + '" alt="">' : '<span>No image</span>') + '</div>' +
        '<div class="cap"><div class="t ellipsis" title="' + esc(s.title) + '">' + esc(s.title) + '</div>' +
        '<div class="k ellipsis">' + esc(s.key) + '</div></div><div class="acts">' +
        '<button class="btn small">' + (src ? 'Replace' : 'Upload') + '</button>' +
        (src ? '<button class="btn small danger-ghost">Remove</button>' : '') + '</div></div>');
      var thumb = $('.thumb', tile);
      var pick = function() { pickImage(s.key, cat, s.title, renderImages); };
      thumb.onclick = pick;
      $('.acts .btn', tile).onclick = pick;
      var rm = $('.acts .danger-ghost', tile);
      if (rm) {
        rm.onclick = function() {
          if (confirm('Remove the image for "' + s.title + '"?')) { removeImage(s.key); renderImages(); }
        };
      }
      thumb.addEventListener('dragover', function(e) { e.preventDefault(); thumb.classList.add('drag'); });
      thumb.addEventListener('dragleave', function() { thumb.classList.remove('drag'); });
      thumb.addEventListener('drop', function(e) {
        e.preventDefault();
        thumb.classList.remove('drag');
        var file = e.dataTransfer.files[0];
        if (file) { openCropper(file, s.key, cat, s.title, renderImages); }
      });
      grid.appendChild(tile);
    });
    v.appendChild(grid);
  };

  var pickImage = function(key, cat, title, done) {
    var input = h('<input type="file" accept="image/*" style="display:none">');
    input.onchange = function() {
      if (input.files[0]) { openCropper(input.files[0], key, cat, title, done); }
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  };

  var removeImage = function(key) {
    var rel = state.images[key];
    if (!rel) { return; }
    var path = SITE + rel.split('?')[0];
    delete state.images[key];
    if (treeEntry(path)) {
      stage(path, {remove: true, label: 'Image ' + key});
    } else {
      unstage(path);
    }
    stageImagesJson();
  };

  // Crop, scale and preview a picture before staging it.
  var openCropper = function(file, key, cat, title, done) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      var dlg = h('<dialog class="dialog" style="width:min(860px,94vw)"><div class="dialog-body">' +
        '<h2>' + esc(title) + '</h2><p class="muted">' + esc(key) + ' · ' + cat.w + ' × ' + cat.h + '</p>' +
        '<div class="cropper"><canvas></canvas><div>' +
        '<div class="seg" style="margin-bottom:12px"><button data-m="fill" class="on">Fill</button><button data-m="fit">Fit</button></div>' +
        '<div class="range-row"><span>Zoom</span><input type="range" min="1" max="4" step="0.01" value="1" data-r="zoom"></div>' +
        '<div class="range-row"><span>Left/right</span><input type="range" min="-1" max="1" step="0.01" value="0" data-r="x"></div>' +
        '<div class="range-row"><span>Up/down</span><input type="range" min="-1" max="1" step="0.01" value="0" data-r="y"></div>' +
        '<div class="range-row"><span>Backdrop</span><input type="color" value="#ffffff" data-r="bg"></div>' +
        '<p class="muted small">Drag the picture to move it. The backdrop shows in Fit mode' +
        (cat.type == 'image/png' ? ' and can be left transparent by choosing white with the checkbox below.' : '.') + '</p>' +
        (cat.type == 'image/png' ? '<label class="check"><input type="checkbox" data-r="transparent" checked> Transparent backdrop</label>' : '') +
        '</div></div><div class="dialog-actions"><button class="btn" data-a="cancel">Cancel</button>' +
        '<button class="btn primary" data-a="ok">Use this picture</button></div></div></dialog>');
      document.body.appendChild(dlg);
      var canvas = $('canvas', dlg);
      canvas.width = cat.w;
      canvas.height = cat.h;
      var ctx = canvas.getContext('2d');
      var o = {mode: 'fill', zoom: 1, x: 0, y: 0, bg: '#ffffff', transparent: cat.type == 'image/png'};
      var draw = function() {
        ctx.clearRect(0, 0, cat.w, cat.h);
        if (!(o.mode == 'fit' && o.transparent) || cat.type != 'image/png') {
          ctx.fillStyle = o.mode == 'fit' ? o.bg : '#000';
          ctx.fillRect(0, 0, cat.w, cat.h);
        }
        var base = o.mode == 'fill' ? Math.max(cat.w / img.width, cat.h / img.height) :
            Math.min(cat.w / img.width, cat.h / img.height);
        var s = base * o.zoom;
        var w = img.width * s, hh = img.height * s;
        var spareX = Math.abs(w - cat.w) / 2, spareY = Math.abs(hh - cat.h) / 2;
        var dx = (cat.w - w) / 2 + o.x * spareX, dy = (cat.h - hh) / 2 + o.y * spareY;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, dx, dy, w, hh);
      };
      $$('[data-m]', dlg).forEach(function(b) {
        b.onclick = function() {
          o.mode = b.getAttribute('data-m');
          $$('[data-m]', dlg).forEach(function(x) { x.classList.toggle('on', x == b); });
          draw();
        };
      });
      $$('[data-r]', dlg).forEach(function(inp) {
        inp.addEventListener('input', function() {
          var r = inp.getAttribute('data-r');
          o[r] = inp.type == 'checkbox' ? inp.checked : (r == 'bg' ? inp.value : parseFloat(inp.value));
          draw();
        });
      });
      // drag to move
      var dragging = null;
      canvas.addEventListener('pointerdown', function(e) { dragging = {x: e.clientX, y: e.clientY, ox: o.x, oy: o.y}; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', function(e) {
        if (!dragging) { return; }
        var rect = canvas.getBoundingClientRect();
        o.x = Math.max(-1, Math.min(1, dragging.ox + 2 * (e.clientX - dragging.x) / rect.width));
        o.y = Math.max(-1, Math.min(1, dragging.oy + 2 * (e.clientY - dragging.y) / rect.height));
        $('[data-r="x"]', dlg).value = o.x;
        $('[data-r="y"]', dlg).value = o.y;
        draw();
      });
      canvas.addEventListener('pointerup', function() { dragging = null; });
      var close = function() { dlg.close(); dlg.remove(); URL.revokeObjectURL(url); };
      $('[data-a="cancel"]', dlg).onclick = close;
      $('[data-a="ok"]', dlg).onclick = function() {
        var dataUrl = canvas.toDataURL(cat.type, 0.88);
        var ext = cat.type == 'image/png' ? 'png' : 'jpg';
        var id = key.split(':').slice(1).join(':').replace(/[^\w.-]/g, '_');
        var rel = 'img/' + cat.dir + '/' + id + '.' + ext;
        var path = SITE + rel;
        // a replaced picture may have had another extension
        var old = state.images[key];
        if (old && old.split('?')[0] != rel) { removeImage(key); }
        state.images[key] = rel + '?v=' + Date.now().toString(36);
        state.previews[path] = dataUrl;
        stage(path, {base64: dataUrl.split(',')[1], label: 'Image ' + key});
        stageImagesJson();
        close();
        toast('Image ready. Publish to put it on the site.');
        if (done) { done(); }
      };
      dlg.addEventListener('cancel', close);
      dlg.showModal();
      draw();
    };
    img.onerror = function() { toast('That file is not a picture this browser can read.', true); };
    img.src = url;
  };

  // ---- texts: Dendry scene files --------------------------------------------

  var TEXT_GROUPS = [
    {label: 'Events', test: /^source\/scenes\/rote_fahne\/events\/.+\.dry$/},
    {label: 'Cards', test: /^source\/scenes\/rote_fahne\/cards\/.+\.dry$/},
    {label: 'Game scenes', test: /^source\/scenes\/rote_fahne\/[^/]+\.dry$/},
    {label: 'Title screen and credits', test: /^source\/(scenes\/(root|credits)\.scene\.dry|info\.dry)$/},
    {label: 'Word lists (sidebar)', test: /^source\/qdisplays\/rf_.+\.dry$/},
    {label: 'Website (advanced)', test: /^out\/html\/(game\.css|index\.html|rote_fahne\.js|game\.js)$/}
  ];
  var textFile = null;          // current path
  var textMode = 'structured';  // or 'code'
  var textFilter = '';
  var searchHits = null;

  var textFiles = function() {
    return state.tree.filter(function(e) {
      return TEXT_GROUPS.some(function(g) { return g.test.test(e.path); });
    }).map(function(e) { return e.path; }).concat(
      Object.keys(state.staged).filter(function(p) { return !treeEntry(p) && /\.dry$/.test(p) && state.staged[p].text != null; })
    );
  };
  var shortName = function(path) {
    return path.split('/').pop().replace(/\.scene\.dry$|\.qdisplay\.dry$|\.dry$/, '');
  };

  // Split a scene file into sections: a header of "key: value" lines, body
  // text, and a block of options ("- @target: label").
  var parseDry = function(text) {
    var lines = text.split('\n');
    var starts = [0];
    lines.forEach(function(l, i) { if (/^@[\w.-]+\s*$/.test(l)) { starts.push(i); } });
    var sections = [];
    for (var k = 0; k < starts.length; k++) {
      var from = starts[k], to = k + 1 < starts.length ? starts[k + 1] : lines.length;
      var sec = {id: null, from: from, to: to, props: {}, propOrder: []};
      var j = from;
      if (/^@[\w.-]+\s*$/.test(lines[from] || '')) {
        sec.id = lines[from].trim().slice(1);
        j = from + 1;
      }
      if (k == 0 && from == to) { continue; }
      var inJs = false, lastProp = null;
      while (j < to) {
        var line = lines[j];
        if (inJs) {
          lastProp.end = j;
          if (line.indexOf('!}') >= 0) { inJs = false; }
          j++;
          continue;
        }
        var m = /^([a-z][a-z-]*)\s*:\s?(.*)$/.exec(line);
        if (!m) { break; }
        lastProp = {key: m[1], idx: j, end: j, value: m[2]};
        sec.props[m[1]] = lastProp;
        sec.propOrder.push(m[1]);
        if (m[2].indexOf('{!') >= 0 && m[2].indexOf('!}') < 0) { inJs = true; }
        j++;
      }
      sec.headerEnd = j;
      var bodyEnd = to;
      for (var x = j; x < to; x++) {
        if (/^- [@#]/.test(lines[x])) { bodyEnd = x; break; }
      }
      sec.bodyEnd = bodyEnd;
      sec.body = lines.slice(j, bodyEnd).join('\n');
      sec.options = [];
      for (var y = bodyEnd; y < to; y++) {
        var om = /^- ([@#][\w.-]+)(?:\s*:\s*(.*))?$/.exec(lines[y]);
        if (om) { sec.options.push({idx: y, target: om[1], label: om[2] || ''}); }
      }
      sections.push(sec);
    }
    return {lines: lines, sections: sections};
  };

  // Apply one structured edit to the file text and return the new text.
  var applyEdit = function(text, secIndex, field, value) {
    var doc = parseDry(text);
    var sec = doc.sections[secIndex];
    var lines = doc.lines;
    if (!sec) { return text; }
    if (field.indexOf('prop:') == 0) {
      var key = field.slice(5);
      var v = value.replace(/\n/g, ' ');
      if (sec.props[key]) {
        if (v.trim() === '') {
          lines.splice(sec.props[key].idx, 1);
        } else {
          lines[sec.props[key].idx] = key + ': ' + v;
        }
      } else if (v.trim() !== '') {
        var at = sec.props.title ? sec.props.title.idx + 1 : (sec.id ? sec.from + 1 : sec.from);
        lines.splice(at, 0, key + ': ' + v);
      }
    } else if (field == 'body') {
      var old = sec.body;
      var core = value.replace(/^\n+|\n+$/g, '');
      if (!old.trim() && !core) { return text; }
      var hasHeader = sec.headerEnd > (sec.id ? sec.from + 1 : sec.from);
      var lead = Math.max(/^\n*/.exec(old)[0].length, hasHeader ? 1 : 0);
      var trail = Math.max(/\n*$/.exec(old)[0].length, sec.bodyEnd < sec.to || sec.to < lines.length ? 1 : 0);
      if (!old.trim() && old.length) { lead = 1; trail = 1; }
      var parts = [];
      for (var a = 0; a < lead; a++) { parts.push(''); }
      parts = parts.concat(core.split('\n'));
      for (var b = 0; b < trail; b++) { parts.push(''); }
      Array.prototype.splice.apply(lines, [sec.headerEnd, sec.bodyEnd - sec.headerEnd].concat(parts));
    } else if (field.indexOf('opt:') == 0) {
      var o = sec.options[parseInt(field.slice(4), 10)];
      if (o) {
        lines[o.idx] = '- ' + o.target + (value.trim() ? ': ' + value.replace(/\n/g, ' ') : '');
      }
    }
    return lines.join('\n');
  };

  // Problems the build would reject, or text that would show up wrong.
  var lintDry = function(text) {
    var out = [];
    var count = function(re) { return (text.match(re) || []).length; };
    if (count(/\{!/g) != count(/!\}/g)) { out.push('The {! and !} markers do not pair up.'); }
    if (count(/\[\?/g) != count(/\?\]/g)) { out.push('The [? and ?] markers do not pair up.'); }
    if (count(/\[\+/g) != count(/\+\]/g)) { out.push('The [+ and +] markers do not pair up.'); }
    var doc = parseDry(text);
    var ids = {};
    doc.sections.forEach(function(s) {
      if (s.id) {
        if (ids[s.id]) { out.push('The section @' + s.id + ' appears twice.'); }
        ids[s.id] = 1;
      }
      s.body.split('\n').forEach(function(l) {
        if (/^- /.test(l)) { out.push('A body line starts with "- ", which the game reads as a choice: "' + l.slice(0, 50) + '"'); }
      });
      s.options.forEach(function(o) {
        if (o.target[0] == '@' && o.target.indexOf('.') < 0) {
          var exists = doc.sections.some(function(x) { return x.id == o.target.slice(1); }) ||
              (state.game && state.game.scenes[o.target.slice(1)]);
          if (!exists) { out.push('The choice ' + o.target + ' points to a section that does not exist.'); }
        }
      });
    });
    return out;
  };

  // A rough picture of how body text will look in the game.
  var previewHtml = function(body) {
    var html = body;
    var blocks = [];
    html = html.replace(/\{!([\s\S]*?)!\}/g, function(m, inner) {
      blocks.push(/^\s*</.test(inner) ? inner.replace(/<script[\s\S]*?<\/script>/gi, '') : '<span class="js">{code}</span>');
      return '\u0000' + (blocks.length - 1) + '\u0000';
    });
    html = html.replace(/\[\+\s*([\w.]+)(?:\s*:\s*\w+)?\s*\+\]/g, '<span class="q">$1</span>');
    for (var guard = 0; guard < 20 && /\[\?\s*if\s/.test(html); guard++) {
      html = html.replace(/\[\?\s*if\s+([^:\[\]]*?)\s*:\s*((?:(?!\[\?)[\s\S])*?)\?\]/g, function(m, cond, text) {
        return '<span class="c" title="if ' + esc(cond) + '">' + text + '</span>';
      });
    }
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    var paras = html.split(/\n\s*\n/).map(function(p) {
      p = p.trim();
      if (!p || /^#/.test(p)) { return ''; }
      if (/^= /.test(p)) { return '<h4>' + p.slice(2) + '</h4>'; }
      return '<p>' + p.replace(/\n/g, ' ') + '</p>';
    }).join('');
    paras = paras.replace(/\u0000(\d+)\u0000/g, function(m, i) { return blocks[+i]; });
    return paras || '<span class="muted">(no text)</span>';
  };

  // Syntax colours for the code editor.
  var highlight = function(text) {
    return text.split('\n').map(function(line) {
      var e = esc(line);
      if (/^@[\w.-]+\s*$/.test(line)) { return '<span class="tk-sec">' + e + '</span>'; }
      if (/^#/.test(line)) { return '<span class="tk-com">' + e + '</span>'; }
      if (/^- [@#]/.test(line)) { return '<span class="tk-opt">' + e + '</span>'; }
      if (/^= /.test(line)) { return '<span class="tk-head">' + e + '</span>'; }
      e = e.replace(/^([a-z][a-z-]*)(\s*:)/, '<span class="tk-key">$1</span>$2');
      e = e.replace(/(\{!|!\})/g, '<span class="tk-js">$1</span>');
      e = e.replace(/(\[\+[\s\S]*?\+\])/g, '<span class="tk-var">$1</span>');
      e = e.replace(/(\[\?\s*if[^:]*:|\?\])/g, '<span class="tk-cond">$1</span>');
      e = e.replace(/(&lt;\/?span[^&]*?&gt;)/g, '<span class="tk-tag">$1</span>');
      return e;
    }).join('\n') + '\n';
  };

  var setFileText = function(path, text) {
    var f = state.files[path];
    f.text = text;
    stageText(path, text, f.original, shortName(path));
    var item = $('.side-item[data-path="' + CSS.escape(path) + '"]');
    if (item) { $('.name', item).classList.toggle('dirty', f.text != f.original); }
    renderWarnings();
  };

  var renderWarnings = function() {
    var box = $('#text-warnings');
    if (!box || !textFile || !state.files[textFile]) { return; }
    var list = /\.dry$/.test(textFile) ? lintDry(state.files[textFile].text) : [];
    box.innerHTML = list.map(function(w) { return '<div>⚠ ' + esc(w) + '</div>'; }).join('');
  };

  var renderTexts = function() {
    var v = $('#view-texts');
    v.innerHTML = '';
    var split = h('<div class="split"></div>');
    var side = h('<div class="side-list"><div class="tools">' +
      '<input placeholder="Filter files…" style="flex:1 1 100%">' +
      '<button class="btn small" data-a="search">Search all text</button>' +
      '<button class="btn small" data-a="new-event">+ Event</button>' +
      '<button class="btn small" data-a="new-card">+ Card</button></div><div class="items"></div></div>');
    var filter = $('input', side);
    filter.value = textFilter;
    var items = $('.items', side);
    var fillList = function() {
      items.innerHTML = '';
      if (searchHits) {
        items.appendChild(h('<div class="group-label">' + searchHits.length + ' matches · <a href="#" data-clear>clear</a></div>'));
        $('[data-clear]', items).onclick = function(e) { e.preventDefault(); searchHits = null; fillList(); };
        searchHits.forEach(function(hit) {
          var row = h('<div class="side-item"><div class="grow"><div class="ellipsis"><b>' + esc(shortName(hit.path)) +
            '</b> <span class="meta">line ' + (hit.line + 1) + '</span></div><div class="meta ellipsis">' + esc(hit.text) + '</div></div></div>');
          row.onclick = function() { openFile(hit.path, hit.line); };
          items.appendChild(row);
        });
        return;
      }
      var files = textFiles();
      var q = textFilter.toLowerCase();
      TEXT_GROUPS.forEach(function(g) {
        var inGroup = files.filter(function(p) { return g.test.test(p) && (!q || p.toLowerCase().indexOf(q) >= 0); }).sort();
        if (!inGroup.length) { return; }
        items.appendChild(h('<div class="group-label">' + esc(g.label) + '</div>'));
        inGroup.forEach(function(p) {
          var f = state.files[p];
          var dirty = f && f.text != f.original || (state.staged[p] && state.staged[p].text != null);
          var title = state.game && state.game.scenes[shortName(p)] ? state.game.scenes[shortName(p)].title : '';
          var row = h('<div class="side-item' + (p == textFile ? ' active' : '') + '" data-path="' + esc(p) + '">' +
            '<div class="grow"><div class="ellipsis name' + (dirty ? ' dirty' : '') + '">' + esc(shortName(p)) + '</div>' +
            (title ? '<div class="meta ellipsis">' + esc(title) + '</div>' : '') + '</div></div>');
          row.onclick = function() { openFile(p); };
          items.appendChild(row);
        });
      });
    };
    filter.addEventListener('input', function() { textFilter = filter.value; searchHits = null; fillList(); });
    $('[data-a="search"]', side).onclick = function() { searchAll(filter.value, fillList); };
    $('[data-a="new-event"]', side).onclick = function() { newTextFile('event'); };
    $('[data-a="new-card"]', side).onclick = function() { newTextFile('card'); };
    fillList();
    split.appendChild(side);
    var main = h('<div id="text-main"></div>');
    split.appendChild(main);
    v.appendChild(split);
    renderTextMain();
  };

  var searchAll = function(query, after) {
    query = (query || '').trim();
    if (!query) { toast('Type something in the filter box to search for.'); return; }
    var paths = textFiles().filter(function(p) { return /\.dry$/.test(p); });
    toast('Searching ' + paths.length + ' files…');
    Promise.all(paths.map(function(p) { return readFile(p).catch(function() { return null; }); })).then(function() {
      var q = query.toLowerCase();
      searchHits = [];
      paths.forEach(function(p) {
        var f = state.files[p];
        if (!f) { return; }
        f.text.split('\n').forEach(function(line, i) {
          if (line.toLowerCase().indexOf(q) >= 0) { searchHits.push({path: p, line: i, text: line.trim()}); }
        });
      });
      after();
    });
  };

  var TEMPLATES = {
    event: function(id) {
      return 'title: New event\nsubtitle: One line that sums up the event.\nnew-page: true\ntags: rf_event\n' +
        'view-if: year = 1923 and month = 6 and rf_over = 0\nmax-visits: 1\n\n= New event\n\n' +
        'What happens, in a paragraph or two.\n\n- @first\n- @second\n\n' +
        '@first\ntitle: The first choice.\nsubtitle: Pleases the <span class="f-right">Right</span>. Angers the <span class="f-left">Left</span>.\n' +
        'on-arrival: {!\nwindow.RF.lean(Q, {right: 3, left: -3});\n!}\n\nWhat follows the first choice.\n\n' +
        '@second\ntitle: The second choice.\nsubtitle: Pleases the <span class="f-left">Left</span>. Angers the <span class="f-right">Right</span>.\n' +
        'on-arrival: {!\nwindow.RF.lean(Q, {left: 3, right: -3});\n!}\n\nWhat follows the second choice.\n';
    },
    card: function(id) {
      return 'title: New card\nsubtitle: One line shown when hovering over the card.\nnew-page: true\nis-card: true\ntags: rf_party\n' +
        'view-if: party_banned = 0\non-arrival: month_actions += 1\n\n= New card\n\n' +
        'What the card is about.\n\n- @first\n- @second\n\n' +
        '@first\ntitle: The first choice.\nsubtitle: Pleases the <span class="f-center">Middle Group</span>.\n' +
        'on-arrival: {!\nwindow.RF.lean(Q, {center: 3});\n!}\n\nWhat follows the first choice.\n\n' +
        '@second\ntitle: The second choice.\nsubtitle: Pleases <span class="f-stalin">Thälmann</span>.\n' +
        'on-arrival: {!\nwindow.RF.lean(Q, {stalin: 3});\n!}\n\nWhat follows the second choice.\n';
    }
  };

  var newTextFile = function(kind) {
    var name = prompt('A short ID for the new ' + kind + ' (letters, digits and underscores), for example rf_' + (kind == 'event' ? 'ruhr_strike' : 'leaflets') + ':');
    if (!name) { return; }
    var id = slug(name);
    if (id.indexOf('rf_') != 0) { id = 'rf_' + id; }
    var path = 'source/scenes/rote_fahne/' + (kind == 'event' ? 'events/' : 'cards/') + id + '.scene.dry';
    if (treeEntry(path) || state.files[path]) { toast('A file with that ID already exists.', true); return; }
    state.files[path] = {original: '', text: TEMPLATES[kind](id), sha: null};
    stage(path, {text: state.files[path].text, label: 'New ' + kind + ' ' + id});
    textFile = path;
    textMode = 'structured';
    renderTexts();
    toast(kind == 'card' ? 'New card created. It goes into the Party Affairs deck.' :
          'New event created. Set its view-if line to choose when it happens.');
  };

  var openFile = function(path, line) {
    textFile = path;
    readFile(path).then(function() {
      if (line != null) { textMode = 'code'; }
      renderTexts();
      if (line != null) {
        var ta = $('#text-main textarea.code');
        if (ta) {
          var pos = state.files[path].text.split('\n').slice(0, line).join('\n').length + (line ? 1 : 0);
          ta.focus();
          ta.setSelectionRange(pos, pos);
          var lineTop = ta.closest('.code-wrap').getBoundingClientRect().top + window.scrollY + line * 20 - 200;
          window.scrollTo(0, Math.max(0, lineTop));
        }
      }
    }).catch(function(e) { toast('Could not open the file: ' + e.message, true); });
  };

  var renderTextMain = function() {
    var main = $('#text-main');
    if (!main) { return; }
    main.innerHTML = '';
    if (!textFile) {
      main.appendChild(h('<div class="panel empty">Choose a file on the left.<br><br>The <b>Text</b> view edits titles, ' +
        'subtitles, text and choices. The <b>Code</b> view shows the whole file, including the game logic.</div>'));
      return;
    }
    var f = state.files[textFile];
    if (!f) { main.appendChild(h('<div class="panel empty">Loading…</div>')); readFile(textFile).then(renderTextMain); return; }
    var isDry = /\.dry$/.test(textFile);
    if (!isDry) { textMode = 'code'; }
    var head = h('<div class="editor-head"><div><h2>' + esc(shortName(textFile)) + '</h2><div class="path">' + esc(textFile) + '</div></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (isDry ? '<div class="seg"><button data-m="structured">Text</button><button data-m="code">Code</button></div>' : '') +
      '<button class="btn small" data-a="revert">Revert</button>' +
      (f.sha ? '<button class="btn small danger-ghost" data-a="delete">Delete file</button>' : '') + '</div></div>');
    $$('[data-m]', head).forEach(function(b) {
      b.classList.toggle('on', b.getAttribute('data-m') == textMode);
      b.onclick = function() { textMode = b.getAttribute('data-m'); renderTextMain(); };
    });
    $('[data-a="revert"]', head).onclick = function() {
      if (f.text == f.original) { return; }
      if (!confirm('Throw away your changes to this file?')) { return; }
      if (!f.sha) { delete state.files[textFile]; unstage(textFile); textFile = null; renderTexts(); return; }
      setFileText(textFile, f.original);
      renderTextMain();
    };
    var del = $('[data-a="delete"]', head);
    if (del) {
      del.onclick = function() {
        if (!confirm('Delete ' + textFile + ' from the game? This is staged until you publish.')) { return; }
        stage(textFile, {remove: true, label: 'Delete ' + shortName(textFile)});
        toast('Deletion staged. Publish to apply it.');
      };
    }
    main.appendChild(head);
    if (!isDry) {
      main.appendChild(h('<div class="warnings"><div>⚠ This file is part of the website itself. A mistake here can break the whole site; check the deploy after publishing.</div></div>'));
    }
    main.appendChild(h('<div class="warnings" id="text-warnings"></div>'));
    if (textMode == 'code') {
      main.appendChild(codeEditor(textFile));
    } else {
      structuredEditor(textFile).forEach(function(el) { main.appendChild(el); });
    }
    renderWarnings();
  };

  var codeEditor = function(path) {
    var f = state.files[path];
    var wrap = h('<div class="code-wrap"><div class="code-lines"></div><div class="code-area"><pre></pre><textarea class="code" spellcheck="false"></textarea></div></div>');
    var pre = $('pre', wrap), ta = $('textarea', wrap), nums = $('.code-lines', wrap);
    var paint = function() {
      pre.innerHTML = highlight(ta.value);
      // line numbers follow wrapped lines by measuring each line's height
      var n = ta.value.split('\n').length;
      var out = [];
      for (var i = 1; i <= n; i++) { out.push(i); }
      nums.textContent = out.join('\n');
      var lineEls = pre.innerHTML.split('\n');
      if (lineEls.length) {
        // match heights by mirroring wrapped rows with blank lines
        var measure = h('<div style="position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;font:12.5px/1.6 var(--mono);padding:0 12px"></div>');
        measure.style.width = pre.clientWidth + 'px';
        wrap.appendChild(measure);
        var lines = ta.value.split('\n');
        var rows = [];
        for (var j = 0; j < lines.length; j++) {
          measure.textContent = lines[j] || ' ';
          var count = Math.max(1, Math.round(measure.offsetHeight / 20));
          rows.push(String(j + 1) + new Array(count).join('\n'));
        }
        measure.remove();
        nums.textContent = rows.join('\n');
      }
    };
    ta.value = f.text;
    ta.addEventListener('input', function() {
      paint();
      setFileTextLater(path, ta.value);
    });
    ta.addEventListener('keydown', function(e) {
      if (e.key == 'Tab') {
        e.preventDefault();
        var s = ta.selectionStart;
        ta.setRangeText('    ', s, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    });
    setTimeout(paint, 0);
    window.addEventListener('resize', debounce(paint, 200));
    return wrap;
  };
  var setFileTextLater = debounce(function(path, text) { setFileText(path, text); }, 250);

  var structuredEditor = function(path) {
    var f = state.files[path];
    var doc = parseDry(f.text);
    var out = [];
    if (/qdisplay/.test(path)) {
      out.push(h('<div class="panel muted">Word lists turn a number into a word: each line is <code>(from..to) word</code>. ' +
        'Use the Code view to edit them.</div>'));
    }
    doc.sections.forEach(function(sec, si) {
      var card = h('<div class="section-card"><div class="sh"><b>' + esc(sec.props.title ? sec.props.title.value.replace(/<[^>]+>/g, '') : (sec.id ? '@' + sec.id : 'Scene')) +
        '</b><code>' + (sec.id ? '@' + esc(sec.id) : esc(shortName(path))) + '</code></div><div class="sb"></div></div>');
      var sb = $('.sb', card);
      var left = h('<div></div>'), right = h('<div><div class="muted small" style="margin-bottom:4px">Preview</div><div class="preview"></div></div>');
      var pv = $('.preview', right);
      var updatePreview = function(body) { pv.innerHTML = previewHtml(body); };
      var field = function(label, key, multiline, hint) {
        var p = sec.props[key];
        var val = p ? p.value : '';
        var el = h('<label>' + esc(label) + (hint ? ' <span class="muted small">' + esc(hint) + '</span>' : '') +
          (multiline ? '<textarea rows="2"></textarea>' : '<input>') + '</label>');
        var inp = $('input, textarea', el);
        inp.value = val;
        inp.addEventListener('input', debounce(function() {
          setFileText(path, applyEdit(state.files[path].text, si, 'prop:' + key, inp.value));
        }, 250));
        return el;
      };
      if (!/qdisplay/.test(path)) {
        left.appendChild(field('Title', 'title', false));
        left.appendChild(field('Subtitle', 'subtitle', true, 'shown under a choice, or on hover for a card'));
        if (sec.props['unavailable-subtitle'] || sec.props['choose-if']) {
          left.appendChild(field('When unavailable', 'unavailable-subtitle', true));
        }
      }
      var body = h('<label>Text <span class="muted small">blank line = new paragraph · "= " = heading</span><textarea rows="8"></textarea></label>');
      var bta = $('textarea', body);
      bta.value = sec.body.replace(/^\n+|\n+$/g, '');
      bta.rows = Math.min(24, Math.max(4, bta.value.split('\n').length + 2));
      bta.addEventListener('input', function() { updatePreview(bta.value); });
      bta.addEventListener('input', debounce(function() {
        setFileText(path, applyEdit(state.files[path].text, si, 'body', bta.value));
      }, 300));
      left.appendChild(body);
      updatePreview(bta.value);
      sb.appendChild(left);
      sb.appendChild(right);
      // the game logic stays visible but is edited in the Code view
      var logic = sec.propOrder.filter(function(k) { return ['title', 'subtitle', 'unavailable-subtitle'].indexOf(k) < 0; });
      if (logic.length) {
        sb.appendChild(h('<div class="logic">' + logic.map(function(k) {
          var p = sec.props[k];
          var v = p.end > p.idx ? '{ ' + (p.end - p.idx + 1) + ' lines of code }' : p.value;
          return '<b>' + esc(k) + '</b>: ' + esc(v.length > 90 ? v.slice(0, 90) + '…' : v);
        }).join('<br>') + '</div>'));
      }
      if (sec.options.length) {
        var opts = h('<div class="opts"><div class="muted small" style="margin-bottom:6px">Choices</div></div>');
        sec.options.forEach(function(o, oi) {
          var target = doc.sections.filter(function(s) { return s.id == o.target.slice(1); })[0];
          var row = h('<div class="opt-row"><code title="' + esc(o.target) + '">' + esc(o.target) + '</code><input placeholder="' +
            (target ? 'uses the title of ' + esc(o.target) : 'label (optional)') + '"></div>');
          var inp = $('input', row);
          inp.value = o.label;
          inp.addEventListener('input', debounce(function() {
            setFileText(path, applyEdit(state.files[path].text, si, 'opt:' + oi, inp.value));
          }, 250));
          opts.appendChild(row);
        });
        sb.appendChild(opts);
      }
      out.push(card);
    });
    return out;
  };

  // ---- settings -------------------------------------------------------------

  var renderSettings = function() {
    var v = $('#view-settings');
    v.innerHTML = '';
    var p = h('<div class="panel" style="max-width:560px"><h2 style="margin-bottom:12px">Connection</h2>' +
      '<p>Repository: <b>' + esc(state.cfg.owner + '/' + state.cfg.repo) + '</b><br>Branch: <b>' + esc(state.cfg.branch) + '</b><br>' +
      'Signed in as: <b>' + esc(state.cfg.login || '?') + '</b></p>' +
      '<p class="muted">Publishing to <b>main</b> updates the live site. To try changes first, sign in with another branch and merge it on GitHub later.</p>' +
      '<button class="btn danger-ghost">Sign out and forget the token</button></div>');
    $('button', p).onclick = function() {
      if (stagedCount() && !confirm('You have unpublished changes. Sign out anyway?')) { return; }
      localStorage.removeItem(CFG_KEY);
      location.reload();
    };
    v.appendChild(p);
    v.appendChild(h('<div class="panel" style="max-width:560px"><h2 style="margin-bottom:8px">How it works</h2>' +
      '<ul style="padding-left:18px;margin:0"><li>Every edit is kept in this tab until you press <b>Publish</b>, which makes one commit on GitHub.</li>' +
      '<li>The GitHub Pages workflow then rebuilds the site; the status pill in the top bar shows when it is live.</li>' +
      '<li>Images go to <code>out/html/img/</code> and are listed in <code>out/html/data/images.json</code>. Achievements live in <code>out/html/data/achievements.json</code>.</li>' +
      '<li>Text files are the game\'s Dendry scenes in <code>source/scenes/</code>. If a deploy fails after a text change, the Dashboard links to the error.</li></ul></div>'));
  };

  // ---- routing --------------------------------------------------------------

  var TITLES = {dashboard: 'Dashboard', achievements: 'Achievements', images: 'Images', texts: 'Texts', settings: 'Settings'};
  var renderView = function() {
    var view = state.view;
    $$('.view').forEach(function(v) { v.classList.toggle('active', v.id == 'view-' + view); });
    $$('.nav nav a').forEach(function(a) { a.classList.toggle('active', a.getAttribute('data-view') == view); });
    $('#view-title').textContent = TITLES[view];
    ({dashboard: renderDashboard, achievements: renderAchievements, images: renderImages,
      texts: renderTexts, settings: renderSettings})[view]();
  };
  var route = function() {
    var v = (location.hash || '#dashboard').slice(1);
    state.view = TITLES[v] ? v : 'dashboard';
    renderView();
  };

  // ---- start ----------------------------------------------------------------

  var loadData = function() {
    var json = function(path, fallback) {
      return readFile(path).then(function(f) {
        if (!f) { return {text: fallback, value: JSON.parse(fallback)}; }
        try {
          return {text: f.original, value: JSON.parse(f.original)};
        } catch (e) {
          toast(path + ' is not valid JSON; starting from an empty list.', true);
          return {text: fallback, value: JSON.parse(fallback)};
        }
      });
    };
    return Promise.all([
      json(IMAGES_JSON, '{}\n'), json(ACH_JSON, '[]\n'),
      fetch('../game.json?v=' + Date.now()).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ]).then(function(res) {
      state.images = res[0].value;
      state.imagesOriginal = res[0].text;
      state.achievements = res[1].value;
      state.achOriginal = res[1].text;
      state.game = res[2];
      // the editors compare against the canonical formatting
      if (state.files[IMAGES_JSON]) { state.files[IMAGES_JSON].original = res[0].text; }
    });
  };

  var start = function() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#who').textContent = state.cfg.owner + '/' + state.cfg.repo + ' · ' + state.cfg.branch;
    $('#view-dashboard').innerHTML = '<div class="empty">Loading…</div>';
    return loadTree().then(loadData).then(function() {
      window.addEventListener('hashchange', route);
      route();
      refreshDeploy();
    }).catch(function(e) {
      toast('Could not load the repository: ' + e.message, true);
    });
  };

  var showLogin = function(message) {
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    var guess = /\.github\.io$/.test(location.hostname) ?
        {owner: location.hostname.split('.')[0], repo: location.pathname.split('/')[1]} :
        {owner: 'AthanasiosGalanakis', repo: 'Die-Rote-Fahne'};
    var saved = state.cfg || {};
    $('#login-owner').value = saved.owner || guess.owner;
    $('#login-repo').value = saved.repo || guess.repo;
    $('#login-branch').value = saved.branch || 'main';
    $('#login-error').textContent = message || '';
  };

  var signIn = function(cfg) {
    state.cfg = cfg;
    return gh('/repos/' + cfg.owner + '/' + cfg.repo).then(function(repo) {
      if (repo.permissions && !repo.permissions.push) {
        throw new Error('This token can read the repository but not write to it.');
      }
      return gh('/user').catch(function() { return {}; });
    }).then(function(user) {
      cfg.login = user.login || cfg.login;
      try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
      return start();
    });
  };

  $('#login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var cfg = {token: $('#login-token').value.trim(), owner: $('#login-owner').value.trim(),
               repo: $('#login-repo').value.trim(), branch: $('#login-branch').value.trim() || 'main'};
    $('#login-error').textContent = 'Checking…';
    signIn(cfg).catch(function(err) {
      state.cfg = null;
      showLogin(err.status == 401 ? 'GitHub did not accept that token.' :
                err.status == 404 ? 'Repository not found, or the token cannot see it.' : err.message);
    });
  });
  $('#publish-btn').addEventListener('click', openPublish);
  $('#publish-confirm').addEventListener('click', function(e) { e.preventDefault(); publish(); });
  $('#discard-all').addEventListener('click', function() {
    if (!confirm('Throw away all unpublished changes?')) { return; }
    Object.keys(state.staged).forEach(revertStaged);
    $('#publish-dialog').close();
  });
  window.addEventListener('beforeunload', function(e) {
    if (state.cfg && stagedCount()) { e.preventDefault(); e.returnValue = ''; }
  });

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) {}
  if (saved && saved.token) {
    signIn(saved).catch(function(err) {
      showLogin(err.status == 401 ? 'Your saved token no longer works. Paste a new one.' : err.message);
    });
  } else {
    showLogin();
  }

  // for tests
  window.RFAdmin = {parseDry: parseDry, applyEdit: applyEdit, lintDry: lintDry, previewHtml: previewHtml, state: state};
}());
