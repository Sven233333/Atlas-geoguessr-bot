// ==UserScript==
// @name         GeoGuessr Round Journal
// @namespace    https://geoguessrcheats.com
// @version      0.1.0
// @description  Keeps a training journal of your finished GeoGuessr rounds: actual location, your guess, distance and score, with Street View links and CSV or JSON export. Shows nothing during a round.
// @author       ATLAS (geoguessrcheats.com)
// @match        https://www.geoguessr.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @supportURL   https://github.com/Sven233333/Atlas-geoguessr-bot/issues
// ==/UserScript==

/*
 * How it works, in plain words:
 * - The script listens to the game data your own browser already receives
 *   from GeoGuessr while you play classic maps.
 * - A round is written to the journal only AFTER you have guessed, so the
 *   script never shows you anything about an unfinished round.
 * - Everything stays in your browser (localStorage). The script makes no
 *   network requests of its own and collects nothing.
 *
 * Scope of v0.1: classic games (singleplayer maps and challenges).
 * Duels use a different data format and are not journaled yet.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'ggRoundJournal_v1';
  var MAX_GAMES = 50;

  /* ------------------------------------------------------------------ */
  /* Storage                                                             */
  /* ------------------------------------------------------------------ */

  function loadJournal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (data && typeof data === 'object' && Array.isArray(data.games)) {
        return data;
      }
    } catch (e) { /* corrupted storage, start fresh */ }
    return { games: [] };
  }

  function saveJournal(journal) {
    // Keep only the most recent games so localStorage stays small.
    if (journal.games.length > MAX_GAMES) {
      journal.games = journal.games.slice(-MAX_GAMES);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
    } catch (e) { /* storage full or blocked; journaling is best effort */ }
  }

  /* ------------------------------------------------------------------ */
  /* Extracting finished rounds from classic game payloads               */
  /* ------------------------------------------------------------------ */

  function num(v) {
    var n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && isFinite(n) ? n : null;
  }

  function guessScore(guess) {
    if (!guess || typeof guess !== 'object') return null;
    if (guess.roundScoreInPoints != null) return num(guess.roundScoreInPoints);
    if (guess.roundScore && guess.roundScore.amount != null) return num(guess.roundScore.amount);
    if (guess.score && guess.score.amount != null) return num(guess.score.amount);
    return null;
  }

  function guessDistanceMeters(guess) {
    if (!guess || typeof guess !== 'object') return null;
    if (guess.distanceInMeters != null) return num(guess.distanceInMeters);
    if (guess.distance && guess.distance.meters && guess.distance.meters.amount != null) {
      return num(guess.distance.meters.amount);
    }
    return null;
  }

  function recordGamePayload(body) {
    if (!body || typeof body !== 'object') return;
    var token = typeof body.token === 'string' ? body.token : null;
    var rounds = Array.isArray(body.rounds) ? body.rounds : null;
    var player = body.player && typeof body.player === 'object' ? body.player : null;
    var guesses = player && Array.isArray(player.guesses) ? player.guesses : null;
    if (!token || !rounds || !guesses) return;

    var finished = [];
    // Only rounds that already have a matching guess are finished rounds.
    var n = Math.min(rounds.length, guesses.length);
    for (var i = 0; i < n; i++) {
      var r = rounds[i] || {};
      var g = guesses[i] || {};
      var actualLat = num(r.lat), actualLng = num(r.lng);
      var guessLat = num(g.lat), guessLng = num(g.lng);
      if (actualLat === null || actualLng === null) continue;
      finished.push({
        round: i + 1,
        actualLat: actualLat,
        actualLng: actualLng,
        guessLat: guessLat,
        guessLng: guessLng,
        distanceM: guessDistanceMeters(g),
        score: guessScore(g),
        country: typeof r.streakLocationCode === 'string' ? r.streakLocationCode.toUpperCase() : null
      });
    }
    if (!finished.length) return;

    var journal = loadJournal();
    var game = null;
    for (var j = 0; j < journal.games.length; j++) {
      if (journal.games[j].token === token) { game = journal.games[j]; break; }
    }
    if (!game) {
      game = {
        token: token,
        mapName: typeof body.mapName === 'string' ? body.mapName : 'Unknown map',
        startedAt: new Date().toISOString(),
        rounds: []
      };
      journal.games.push(game);
    }
    // Replace with the newest snapshot; payloads are cumulative per game.
    if (finished.length >= game.rounds.length) {
      game.rounds = finished;
      saveJournal(journal);
      updateBadge();
    }
  }

  /* ------------------------------------------------------------------ */
  /* fetch hook (installed at document-start, before the app boots)      */
  /* ------------------------------------------------------------------ */

  var origFetch = window.fetch;
  window.fetch = function () {
    var args = arguments;
    var url = '';
    try {
      url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    } catch (e) { /* ignore */ }
    var promise = origFetch.apply(this, args);
    if (url.indexOf('/api/v3/games/') !== -1) {
      promise.then(function (resp) {
        try {
          if (resp && resp.ok) {
            resp.clone().json().then(recordGamePayload, function () {});
          }
        } catch (e) { /* never break the game's own request */ }
        return resp;
      }, function () {});
    }
    return promise;
  };

  /* ------------------------------------------------------------------ */
  /* Export helpers                                                      */
  /* ------------------------------------------------------------------ */

  function toCsv(journal) {
    var lines = ['game_token,map,round,actual_lat,actual_lng,guess_lat,guess_lng,distance_km,score,country'];
    journal.games.forEach(function (game) {
      game.rounds.forEach(function (r) {
        lines.push([
          game.token,
          '"' + String(game.mapName).replace(/"/g, '""') + '"',
          r.round,
          r.actualLat, r.actualLng,
          r.guessLat === null ? '' : r.guessLat,
          r.guessLng === null ? '' : r.guessLng,
          r.distanceM === null ? '' : (r.distanceM / 1000).toFixed(2),
          r.score === null ? '' : r.score,
          r.country || ''
        ].join(','));
      });
    });
    return lines.join('\n');
  }

  function download(filename, mime, text) {
    var blob = new Blob([text], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  /* ------------------------------------------------------------------ */
  /* UI: a small journal button plus a panel                             */
  /* ------------------------------------------------------------------ */

  var panel = null;
  var button = null;

  function fmtKm(m) {
    if (m === null || m === undefined) return '';
    var km = m / 1000;
    return km >= 100 ? Math.round(km) + ' km' : km.toFixed(1) + ' km';
  }

  function streetViewUrl(lat, lng) {
    return 'https://www.google.com/maps?layer=c&cbll=' + lat + ',' + lng;
  }

  function updateBadge() {
    if (!button) return;
    var journal = loadJournal();
    var count = 0;
    journal.games.forEach(function (g) { count += g.rounds.length; });
    button.textContent = 'Journal (' + count + ')';
  }

  function renderPanel() {
    var journal = loadJournal();
    var html = '';
    if (!journal.games.length) {
      html = '<p style="margin:8px 0">No finished rounds yet. Play a classic game and finish a round; it will appear here.</p>';
    } else {
      journal.games.slice().reverse().forEach(function (game) {
        html += '<div style="margin:10px 0 4px;font-weight:700">' +
          escapeHtml(game.mapName) + ' <span style="opacity:.6;font-weight:400">' +
          game.rounds.length + ' rounds</span></div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
        html += '<tr><th style="text-align:left;padding:2px 6px">#</th>' +
          '<th style="text-align:left;padding:2px 6px">Distance</th>' +
          '<th style="text-align:left;padding:2px 6px">Score</th>' +
          '<th style="text-align:left;padding:2px 6px">Revisit</th></tr>';
        game.rounds.forEach(function (r) {
          html += '<tr>' +
            '<td style="padding:2px 6px;border-top:1px solid rgba(255,255,255,.12)">' + r.round + '</td>' +
            '<td style="padding:2px 6px;border-top:1px solid rgba(255,255,255,.12)">' + fmtKm(r.distanceM) + '</td>' +
            '<td style="padding:2px 6px;border-top:1px solid rgba(255,255,255,.12)">' + (r.score === null ? '' : r.score) + '</td>' +
            '<td style="padding:2px 6px;border-top:1px solid rgba(255,255,255,.12)">' +
            '<a href="' + streetViewUrl(r.actualLat, r.actualLng) + '" target="_blank" rel="noopener" style="color:#8ab4f8">Street View</a></td>' +
            '</tr>';
        });
        html += '</table>';
      });
    }
    panel.querySelector('.ggrj-body').innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildUi() {
    if (document.getElementById('ggrj-button')) return;

    button = document.createElement('button');
    button.id = 'ggrj-button';
    button.textContent = 'Journal';
    button.setAttribute('style',
      'position:fixed;bottom:14px;left:14px;z-index:99999;' +
      'background:#1a1a2e;color:#fff;border:1px solid rgba(255,255,255,.25);' +
      'border-radius:8px;padding:6px 12px;font:600 12px/1.4 sans-serif;cursor:pointer;opacity:.85');

    panel = document.createElement('div');
    panel.id = 'ggrj-panel';
    panel.setAttribute('style',
      'position:fixed;bottom:52px;left:14px;z-index:99999;display:none;' +
      'width:340px;max-height:55vh;overflow:auto;background:#12121e;color:#fff;' +
      'border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:12px;' +
      'font:400 13px/1.5 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5)');
    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<b>Round Journal</b>' +
      '<span>' +
      '<button class="ggrj-csv" style="margin-right:6px;cursor:pointer;font-size:11px">CSV</button>' +
      '<button class="ggrj-json" style="margin-right:6px;cursor:pointer;font-size:11px">JSON</button>' +
      '<button class="ggrj-clear" style="cursor:pointer;font-size:11px">Clear</button>' +
      '</span></div>' +
      '<div class="ggrj-body"></div>';

    button.addEventListener('click', function () {
      var show = panel.style.display === 'none';
      panel.style.display = show ? 'block' : 'none';
      if (show) renderPanel();
    });
    panel.querySelector('.ggrj-csv').addEventListener('click', function () {
      download('geoguessr-round-journal.csv', 'text/csv', toCsv(loadJournal()));
    });
    panel.querySelector('.ggrj-json').addEventListener('click', function () {
      download('geoguessr-round-journal.json', 'application/json',
        JSON.stringify(loadJournal(), null, 2));
    });
    panel.querySelector('.ggrj-clear').addEventListener('click', function () {
      if (confirm('Clear the whole round journal?')) {
        localStorage.removeItem(STORAGE_KEY);
        renderPanel();
        updateBadge();
      }
    });

    document.body.appendChild(button);
    document.body.appendChild(panel);
    updateBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUi);
  } else {
    buildUi();
  }
})();
