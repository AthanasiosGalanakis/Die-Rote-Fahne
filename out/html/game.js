(function() {
  var game;
  var ui;

  var DateOptions = {hour: 'numeric',
                 minute: 'numeric',
                 second: 'numeric',
                 year: 'numeric',
                 month: 'short',
                 day: 'numeric' };

  var main = function(dendryUI) {
    ui = dendryUI;
    game = ui.game;

    // Add your custom code here.
  };

  var TITLE = "Die Rote Fahne" + '_' + "Maarten";

  // the url is a link to game.json
  // test url: https://aucchen.github.io/social_democracy_mods/v0.1.json
  // TODO; 
  window.loadMod = function(url) {
      ui.loadGame(url);
  };

  // save/load buttons
  window.updateSaveButtons = function() {
      if (window.dendryUI.language && window.dendryUI.language == "de") {
          for (var element of document.getElementsByClassName("save_button")) {
              if (element.textContent == "Save") {
                  element.textContent = "Speichern";
              } else if (element.textContent == "Load") {
                  element.textContent = "Laden";
              }
          } 
      }
      else {
          for (var element of document.getElementsByClassName("save_button")) {
              if (element.textContent == "Speichern") {
                  element.textContent = "Save";
              } else if (element.textContent == "Laden") {
                  element.textContent = "Load";
              }
          }
      }
  };

  window.onSave = function() {
      window.updateSaveButtons();
  };

  window.onPopulateSaveSlots = function() {
      window.updateSaveButtons();
  };

  window.showStats = function() {
    if (window.dendryUI.dendryEngine.state.sceneId.startsWith('library')) {
        window.dendryUI.dendryEngine.goToScene('backSpecialScene');
    } else {
        window.dendryUI.dendryEngine.goToScene('library');
    }
  };

  window.showAchievements = function() {
    window.hideOptions();
    if (window.dendryUI.dendryEngine.state.sceneId.startsWith('rf_achievements')) {
        window.dendryUI.dendryEngine.goToScene('backSpecialScene');
    } else {
        window.dendryUI.dendryEngine.goToScene('rf_achievements');
    }
  };

  // Exact numbers in the sidebar: a per-browser setting. Turning it on
  // during a game disables achievements for that game.
  try {
      window.rfShowNumbers = localStorage['rf_show_numbers'] == '1';
  } catch (e) {
      window.rfShowNumbers = false;
  }
  window.enableNumbers = function() {
      var Q = window.dendryUI.dendryEngine.state.qualities;
      if (Q.started && !Q.numbers_shown &&
          !window.confirm('Showing exact numbers disables achievements for this game. Continue?')) {
          $('#numbers_no')[0].checked = true;
          return;
      }
      window.rfShowNumbers = true;
      try { localStorage['rf_show_numbers'] = '1'; } catch (e) {}
      window.updateSidebar();
  };
  window.disableNumbers = function() {
      window.rfShowNumbers = false;
      try { localStorage['rf_show_numbers'] = '0'; } catch (e) {}
      window.updateSidebar();
  };

  window.showMods = function() {
    window.hideOptions();
    if (window.dendryUI.dendryEngine.state.sceneId.startsWith('mod_loader')) {
        window.dendryUI.dendryEngine.goToScene('backSpecialScene');
    } else {
        window.dendryUI.dendryEngine.goToScene('mod_loader');
    }
  };

  // TODO: update audio displays
  window.updateAudio = function(song) {
      var now_playing = document.getElementById('currently_playing');
      if (song) {
          var a = song.split('/');
          now_playing.textContent = a[a.length-1];
      } else {
          var s = window.dendryUI.currentAudioURL;
          var a = s.split('/');
          now_playing.textContent = a[a.length-1];
      }
  };

  // sets the volume
  window.setVolume = function(volume) {
      if (window.dendryUI.currentAudio) {
          window.dendryUI.volume = volume/100;
          window.dendryUI.currentAudio.volume = volume/100;
      }
  };

  // go to the next song - this just sets the time to 9999 lol.
  window.shuffle = function() {
      if (window.dendryUI.currentAudio) {
          window.dendryUI.currentAudio.currentTime = 9999;
      }
  };

  // toggles pause or play of music
  window.togglePausePlay = function() {
      if (window.dendryUI.currentAudio) {
          if (window.dendryUI.currentAudio.paused) {
            window.dendryUI.currentAudio.play();
            document.getElementById('pause-button-image').style.display = "inline";
            document.getElementById('play-button-image').style.display = "none";
            document.getElementById('pause-button');
            document.getElementById('pause-button-text').textContent = "Pause";
          } else {
            window.dendryUI.currentAudio.pause();
            document.getElementById('play-button-image').style.display = "inline";
            document.getElementById('pause-button-image').style.display = "none";
            document.getElementById('pause-button-text').textContent = "Play";
          }
      }
  };
  
  window.showOptions = function() {
      var save_element = document.getElementById('options');
      window.populateOptions();
      save_element.style.display = "block";
      if (!save_element.onclick) {
          save_element.onclick = function(evt) {
              var target = evt.target;
              var save_element = document.getElementById('options');
              if (target == save_element) {
                  window.hideOptions();
              }
          };
      }
  };

  window.hideOptions = function() {
      var save_element = document.getElementById('options');
      save_element.style.display = "none";
  };

  window.disableBg = function() {
      window.dendryUI.disable_bg = true;
      document.body.style.backgroundImage = 'none';
      window.dendryUI.saveSettings();
  };

  window.enableBg = function() {
      window.dendryUI.disable_bg = false;
      window.dendryUI.setBg(window.dendryUI.dendryEngine.state.bg);
      window.dendryUI.saveSettings();
  };

  window.disableAnimate = function() {
      window.dendryUI.animate = false;
      window.dendryUI.saveSettings();
  };

  window.enableAnimate = function() {
      window.dendryUI.animate = true;
      window.dendryUI.saveSettings();
  };

  window.disableAnimateBg = function() {
      window.dendryUI.animate_bg = false;
      window.dendryUI.saveSettings();
  };

  window.enableAnimateBg = function() {
      window.dendryUI.animate_bg = true;
      window.dendryUI.saveSettings();
  };

  window.disableAudio = function() {
      window.dendryUI.toggle_audio(false);
      window.dendryUI.saveSettings();
  };

  window.enableAudio = function() {
      window.dendryUI.toggle_audio(true);
      window.dendryUI.saveSettings();
  };

  window.enableImages = function() {
      window.dendryUI.show_portraits = true;
      window.dendryUI.saveSettings();
  };

  window.disableImages = function() {
      window.dendryUI.show_portraits = false;
      window.dendryUI.saveSettings();
  };

  window.enableLightMode = function() {
      window.dendryUI.dark_mode = false;
      document.body.classList.remove('dark-mode');
      window.dendryUI.saveSettings();
  };
  window.enableDarkMode = function() {
      window.dendryUI.dark_mode = true;
      document.body.classList.add('dark-mode');
      window.dendryUI.saveSettings();
  };

  // populates the checkboxes in the options view
  window.populateOptions = function() {
    var disable_bg = window.dendryUI.disable_bg;
    var animate = window.dendryUI.animate;
    var disable_audio = window.dendryUI.disable_audio;
    var show_portraits = window.dendryUI.show_portraits;
    if (disable_bg) {
        $('#backgrounds_no')[0].checked = true;
    } else {
        $('#backgrounds_yes')[0].checked = true;
    }
    if (animate) {
        $('#animate_yes')[0].checked = true;
    } else {
        $('#animate_no')[0].checked = true;
    }
    if (disable_audio) {
        $('#audio_no')[0].checked = true;
    } else {
        $('#audio_yes')[0].checked = true;
    }
    if (show_portraits) {
        $('#images_yes')[0].checked = true;
    } else {
        $('#images_no')[0].checked = true;
    }
    if (window.dendryUI.dark_mode) {
        $('#dark_mode')[0].checked = true;
    } else {
        $('#light_mode')[0].checked = true;
    }
    if (window.rfShowNumbers) {
        $('#numbers_yes')[0].checked = true;
    } else {
        $('#numbers_no')[0].checked = true;
    }
  };

  
  // This function allows you to modify the text before it's displayed.
  // E.g. wrapping chat-like messages in spans.
  window.displayText = function(text) {
      return text;
  };

  // This function allows you to do something in response to signals.
  window.handleSignal = function(signal, event, scene_id) {
  };
  
  // This function runs on a new page. Right now, this auto-saves.
  window.onNewPage = function() {
    var scene = window.dendryUI.dendryEngine.state.sceneId;
    if (scene != 'root' && !window.justLoaded) {
        window.dendryUI.autosave();
    }
    if (window.justLoaded) {
        window.justLoaded = false;
    }
  };

  // TODO: have some code for tabbed sidebar browsing.
  window.updateSidebar = function() {
      $('#qualities').empty();
      var Q = dendryUI.dendryEngine.state.qualities;
      // the sidebar only makes sense once a game is under way
      $('#stats_sidebar').toggle(!!Q.started);
      $('#rf-right-wrapper').toggle(!!Q.started);
      $('#mid_panel').toggleClass('rf-no-sidebar', !Q.started);
      Q.show_numbers = window.rfShowNumbers ? 1 : 0;
      if (window.rfShowNumbers && Q.started) {
          // a game that has seen the exact numbers earns no achievements
          Q.numbers_shown = 1;
      }
      var scene = dendryUI.game.scenes[window.statusTab];
      dendryUI.dendryEngine._runActions(scene.onArrival);
      var displayContent = dendryUI.dendryEngine._makeDisplayContent(scene.content, true);
      $('#qualities').append(dendryUI.contentToHTML.convert(displayContent));
      if (window.RF) {
          window.RF.renderSidebar(dendryUI.dendryEngine.state.qualities);
      }
  };

  window.changeTab = function(newTab, tabId) {
      if (tabId == 'poll_tab' && dendryUI.dendryEngine.state.qualities.historical_mode) {
          window.alert('Polls are not available in historical mode.');
          return;
      }
      var tabButton = document.getElementById(tabId);
      var tabButtons = document.getElementsByClassName('tab_button');
      for (i = 0; i < tabButtons.length; i++) {
        tabButtons[i].className = tabButtons[i].className.replace(' active', '');
      }
      tabButton.className += ' active';
      window.statusTab = newTab;
      window.updateSidebar();
  };

  // The engine draws the decks, hand and pinned cards after this hook runs,
  // so the pictures and the main-page layout are applied a moment later.
  var decorateSoon = function() {
      if (window.RF) {
          setTimeout(function() {
              window.RF.decorate(dendryUI.dendryEngine.state.qualities);
          }, 0);
      }
  };
  window.onDisplayContent = function() {
      window.updateSidebar();
      decorateSoon();
  };

  /*
   * This function copied from the code for Infinite Space Battle Simulator
   *
   * quality - a number between max and min
   * qualityName - the name of the quality
   * max and min - numbers
   * colors - if true/1, will use some color scheme - green to yellow to red for high to low
   * */
  window.generateBar = function(quality, qualityName, max, min, colors) {
      var bar = document.createElement('div');
      bar.className = 'bar';
      var value = document.createElement('div');
      value.className = 'barValue';
      var width = (quality - min)/(max - min);
      if (width > 1) {
          width = 1;
      } else if (width < 0) {
          width = 0;
      }
      value.style.width = Math.round(width*100) + '%';
      if (colors) {
          value.style.backgroundColor = window.probToColor(width*100);
      }
      bar.textContent = qualityName + ': ' + quality;
      if (colors) {
          bar.textContent += '/' + max;
      }
      bar.appendChild(value);
      return bar;
  };


  // Hover text boxes. The browser's own title tooltips and the cards'
  // built-in tooltips can run off the screen, so one floating box is placed
  // next to whatever is hovered and kept inside the window.
  var tip = null;
  var showTip = function(target, card) {
      if (!tip) {
          tip = document.createElement('div');
          tip.id = 'rf-tip';
          document.body.appendChild(tip);
      }
      tip.innerHTML = card.html;
      tip.style.setProperty('--rf-tip-accent', card.accent || '#7a0010');
      tip.style.display = 'block';
      tip.style.left = '0px';
      tip.style.top = '0px';
      var margin = 8;
      var r = target.getBoundingClientRect();
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      // to the right of the target, else to the left, else below it
      var left = r.right + margin;
      var top = r.top;
      if (left + w > vw - margin) {
          left = r.left - w - margin;
      }
      if (left < margin) {
          left = Math.min(Math.max(margin, r.left), vw - w - margin);
          top = r.bottom + margin;
          if (top + h > vh - margin) {
              top = r.top - h - margin;
          }
      }
      top = Math.min(Math.max(margin, top), Math.max(margin, vh - h - margin));
      left = Math.max(margin, left);
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
  };
  var hideTip = function() {
      if (tip) {
          tip.style.display = 'none';
      }
  };
  var escHtml = function(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
  };
  // A hover card: an optional logo or picture, a title, a subtitle, a few
  // label/value rows and a line of text. Every hover box uses this shape.
  var tipCard = function(o) {
      var html = '';
      if (o.picture) {
          html += '<img class="rf-tip-pic" src="' + escHtml(o.picture) + '" alt="">';
      }
      html += '<div class="rf-tip-head">';
      if (o.logo !== undefined) {
          html += '<div class="rf-tip-logo ' + (o.logoClass || '') + '">' +
              (o.logo ? '<img src="' + escHtml(o.logo) + '" alt="">' : escHtml(o.badge || '')) + '</div>';
      }
      html += '<div><div class="rf-tip-title ' + (o.titleClass || '') + '">' + o.title + '</div>';
      if (o.subtitle) {
          html += '<div class="rf-tip-sub">' + o.subtitle + '</div>';
      }
      html += '</div></div>';
      if (o.rows || o.body) {
          html += '<div class="rf-tip-body">';
          for (var r of (o.rows || [])) {
              html += '<div class="rf-tip-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
          }
          if (o.body) {
              html += '<div' + (o.rows && o.rows.length ? ' style="margin-top:0.4em"' : '') + '>' + o.body + '</div>';
          }
          html += '</div>';
      }
      return {html: html, accent: o.accent};
  };
  var matchClass = function(el, prefix) {
      for (var c of el.classList) {
          if (c.indexOf(prefix) == 0) {
              return c.slice(prefix.length);
          }
      }
      return null;
  };
  var qualities = function() {
      return window.dendryUI.dendryEngine.state.qualities;
  };
  var cssVar = function(name, fallback) {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
  };
  // A value as the same word the sidebar uses (source/qdisplays), with the
  // number when exact numbers are switched on. Each band is [upper bound, word].
  var BANDS = {
      strength: [[10, 'weak'], [25, 'moderate'], [40, 'strong'], [60, 'very strong'], [Infinity, 'dominant']],
      dissent: [[10, 'loyal'], [25, 'restless'], [45, 'discontented'], [65, 'angry'], [85, 'rebellious'], [Infinity, 'ready to split']],
      relation: [[5, 'hostile'], [14.9, 'frigid'], [29.9, 'cold'], [39.9, 'cool'], [54.9, 'neutral'], [64.9, 'warm'],
                 [74.9, 'friendly'], [Infinity, 'very friendly']]
  };
  var word = function(v, kind) {
      var w = '';
      for (var b of BANDS[kind]) {
          if (v < b[0]) {
              w = b[1];
              break;
          }
      }
      return qualities().show_numbers ? w + ' (' + Math.round(v) + ')' : w;
  };
  var partyTip = function(el, p) {
      var RF = window.RF;
      var info = RF && RF.partyInfo[p];
      if (!info) {
          return null;
      }
      var Q = qualities();
      var lead = RF.partyLeadership(Q, p);
      var extra = el.getAttribute('data-tip') || el.getAttribute('title');
      if (el.getAttribute('title')) {
          el.setAttribute('data-tip', el.getAttribute('title'));
          el.removeAttribute('title');
      }
      var rows = [];
      if (lead && lead.name) {
          rows.push(['Led by', escHtml(lead.name)]);
      }
      for (var r of RF.reichstag1920 || []) {
          if (r[0] == p) {
              rows.push(['Share of Reichstag seats (1920)', RF.seatShare(r[2])]);
          }
      }
      if (Q.rf_mode && p != 'kpd' && p != 'other') {
          var rel = p == 'spd' ? Q.spd_relation : Q[p + '_relation'];
          if (rel !== undefined) {
              rows.push(['Relations with the KPD', word(rel, 'relation')]);
          }
      }
      if (Q.rf_mode && RF.polls) {
          var polls = RF.polls(Q).total;
          if (polls[p] !== undefined) {
              rows.push(['Polling now', '~' + Math.round(polls[p]) + '%']);
          }
      }
      return tipCard({
          logo: RF.image('party:' + p) || '', badge: info.name, logoClass: 'bg-' + p,
          title: escHtml(info.full), titleClass: 'p-' + p,
          subtitle: escHtml(info.ideology),
          rows: rows,
          body: extra && extra != info.full ? escHtml(extra) : '',
          accent: cssVar('--c-' + p, '')
      });
  };
  var FACTION_TEXT = {
      right: 'United front with the SPD, workers\' governments in the states.',
      center: 'Party unity above any line.',
      left: 'No coalitions with reformists; prepare the offensive. Zinoviev\'s favourites.',
      ultra: 'Suspicious of the unions, of parliament, and increasingly of Moscow.',
      stalin: 'Follows whoever rules in Moscow.'
  };
  var FACTION_ACCENT = {right: '#c4622d', center: '#8a6d3b', left: '#b00020', ultra: '#2b2b2b', stalin: '#5a0f2e'};
  var factionTip = function(f) {
      var RF = window.RF;
      if (!RF || !RF.names[f]) {
          return null;
      }
      var Q = qualities();
      var rows = [['Leading figure', escHtml(RF.factionPersons[f])]];
      if (Q.rf_mode) {
          if (Q[f + '_expelled']) {
              rows.push(['Status', 'expelled']);
          } else {
              rows.push(['Strength', word(Q[f + '_strength'], 'strength')]);
              rows.push(['Dissent', word(Q[f + '_dissent'], 'dissent')]);
              rows.push(['Standing in Moscow', word(Q[f + '_moscow'], 'relation')]);
          }
      }
      return tipCard({
          logo: RF.image('leader:' + f) || '', badge: RF.factionPersons[f].split(' ').pop().slice(0, 1),
          logoClass: 'b-' + f + ' rf-tip-portrait',
          title: escHtml(RF.names[f]), titleClass: 'f-' + f,
          subtitle: Q.leader == f ? 'Leads the party' : 'Faction inside the KPD',
          rows: rows,
          body: escHtml(FACTION_TEXT[f]),
          accent: FACTION_ACCENT[f]
      });
  };
  var personTip = function(id) {
      var RF = window.RF;
      var person = RF && RF.people && RF.people[id];
      if (!person) {
          return null;
      }
      var info = RF.partyInfo[person.party];
      return tipCard({
          logo: RF.image('person:' + id) || '', badge: person.name.split(' ').pop().slice(0, 1),
          logoClass: 'bg-' + person.party + ' rf-tip-portrait',
          title: escHtml(person.name), titleClass: 'p-' + person.party,
          subtitle: escHtml(person.role),
          rows: info ? [['Belongs to', escHtml(info.full)]] : [],
          body: escHtml(person.text),
          accent: cssVar('--c-' + person.party, '')
      });
  };
  // The value shown after a sidebar label ("Resources: 3" gives "3").
  var valueAfter = function(t) {
      var line = t.parentNode;
      if (!line || line.id == 'qualities' || line.id == 'content') {
          return '';
      }
      var text = line.textContent.replace(/\s+/g, ' ').trim();
      var label = t.textContent.replace(/\s+/g, ' ').trim();
      var i = text.indexOf(label);
      if (i < 0) {
          return '';
      }
      var rest = text.slice(i + label.length).replace(/^\s*:\s*/, '').trim();
      return rest.length > 60 ? rest.slice(0, 57) + '…' : rest;
  };
  var tipFor = function(el) {
      var card = el.closest('a.card');
      if (card) {
          var inner = card.querySelector('.card-tooltip');
          // drop the browser's tooltip, which only repeats the card's title
          if (card.getAttribute('title')) {
              card.setAttribute('data-title', card.getAttribute('title'));
              card.removeAttribute('title');
          }
          if (!inner) {
              return null;
          }
          var img = card.querySelector('img.card-img');
          var sub = card.parentNode.querySelector('.rf-card-sub');
          // the engine stores the subtitle as text; it is our own markup, so render it
          return {target: card, tip: tipCard({
              picture: img ? img.getAttribute('src') : undefined,
              title: escHtml(card.getAttribute('data-title') || ''),
              subtitle: sub ? escHtml(sub.textContent) : '',
              body: inner.textContent
          })};
      }
      var named = el.closest('[class*="p-"], [class*="f-"], [class*="m-"]');
      if (named && named.closest('#content, #qualities, #rf-tip') && !named.closest('#rf-tip')) {
          var p = matchClass(named, 'p-');
          var f = matchClass(named, 'f-');
          var m = matchClass(named, 'm-');
          var tc = p ? partyTip(named, p) : (f ? factionTip(f) : (m ? personTip(m) : null));
          if (tc) {
              return {target: named, tip: tc};
          }
      }
      var t = el.closest('[title], [data-tip]');
      if (!t) {
          return null;
      }
      if (t.getAttribute('title')) {
          t.setAttribute('data-tip', t.getAttribute('title'));
          t.removeAttribute('title');
      }
      var text = t.getAttribute('data-tip');
      if (!text) {
          return null;
      }
      var value = valueAfter(t);
      return {target: t, tip: tipCard({
          title: escHtml(t.textContent.trim()),
          subtitle: value ? 'Now: ' + escHtml(value) : '',
          body: escHtml(text)
      })};
  };
  document.addEventListener('mouseover', function(evt) {
      if (!(evt.target instanceof Element)) {
          return;
      }
      var found = tipFor(evt.target);
      if (found) {
          showTip(found.target, found.tip);
      } else {
          hideTip();
      }
  });
  document.addEventListener('focusin', function(evt) {
      var found = evt.target instanceof Element ? tipFor(evt.target) : null;
      if (found) {
          showTip(found.target, found.tip);
      }
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('click', hideTip);
  window.addEventListener('scroll', hideTip, true);

  window.justLoaded = true;
  window.statusTab = "rf_status";
  window.dendryModifyUI = main;
  console.log("Modifying stats: see dendryUI.dendryEngine.state.qualities");

  window.onload = function() {
    window.dendryUI.loadSettings({show_portraits: false});
    // images and achievements edited in the admin panel
    if (window.RF) {
        window.RF.loadData(function() {
            window.onDisplayContent();
        });
    }
    if (window.dendryUI.dark_mode) {
        document.body.classList.add('dark-mode');
    }
    // a card drawn into the hand gets its picture too
    var displayHand = window.dendryUI.displayHand;
    window.dendryUI.displayHand = function() {
        var r = displayHand.apply(this, arguments);
        decorateSoon();
        return r;
    };
  };

}());
