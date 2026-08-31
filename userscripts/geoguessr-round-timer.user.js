// ==UserScript==
// @name         GeoGuessr Round Timer and Pace Tracker
// @namespace    https://geoguessrcheats.com/
// @version      1.0.0
// @description  A small on-screen timer that tracks how long you take per GeoGuessr round, with session stats (average, fastest, slowest) and CSV export. Good for training your speed in Duels and NMPZ. Runs fully offline, makes no network calls, and never reads or reveals the round location.
// @author       ATLAS (geoguessrcheats.com)
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        none
// @license      MIT
// @homepageURL  https://geoguessrcheats.com/
// @supportURL   https://github.com/Sven233333/Atlas-geoguessr-bot/issues
// ==/UserScript==

/*
 * GeoGuessr Round Timer and Pace Tracker
 * --------------------------------------
 * This is a self-improvement tool, not a cheat. It measures how long you spend
 * thinking per round so you can train your pace. It does not read the game's
 * data, it does not reveal locations, and it makes zero network requests.
 * Everything is stored locally in your browser (localStorage).
 *
 * Controls:
 *   - The panel shows a live timer and your session stats.
 *   - "Log" records the current round time and resets the timer for the next round.
 *   - "Reset" clears the current session.
 *   - "CSV" downloads your logged round times.
 *   - Drag the header to move the panel. Its position is remembered.
 *   - The timer also auto-resets when it detects a new round, but the Log
 *     button always works even if auto-detection misses a transition.
 */

(function () {
  'use strict';

  var LS_TIMES = 'atlas_rt_times_v1';
  var LS_POS = 'atlas_rt_pos_v1';

  var times = load(LS_TIMES, []);
  var roundStart = Date.now();
  var running = true;

  var el = buildPanel();
  document.documentElement.appendChild(el.root);
  restorePosition(el.root);
  render();

  // Live timer tick
  setInterval(function () {
    if (running) el.live.textContent = fmt(Date.now() - roundStart);
  }, 200);

  // Best-effort auto round detection: watch the URL and a coarse DOM signal.
  var lastKey = roundKey();
  setInterval(function () {
    var k = roundKey();
    if (k !== lastKey) {
      lastKey = k;
      resetRound();
    }
  }, 800);

  // ---- actions ----
  el.logBtn.addEventListener('click', function () {
    var ms = Date.now() - roundStart;
    if (ms < 1200) return; // ignore accidental double taps
    times.push(Math.round(ms / 100) / 10); // seconds, one decimal
    save(LS_TIMES, times);
    resetRound();
    render();
  });

  el.resetBtn.addEventListener('click', function () {
    if (!confirm('Clear this session of ' + times.length + ' logged rounds?')) return;
    times = [];
    save(LS_TIMES, times);
    resetRound();
    render();
  });

  el.csvBtn.addEventListener('click', function () {
    if (!times.length) return;
    var rows = ['round,seconds'];
    times.forEach(function (t, i) { rows.push((i + 1) + ',' + t); });
    var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'geoguessr-round-times.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });

  // ---- helpers ----
  function resetRound() { roundStart = Date.now(); running = true; }

  function roundKey() {
    // A coarse, resilient signal for "a new round is showing".
    // Uses the URL plus the current canvas count, never the location data.
    var canvases = document.querySelectorAll('canvas').length;
    return location.pathname + '|' + canvases;
  }

  function render() {
    var n = times.length;
    var avg = n ? times.reduce(function (a, b) { return a + b; }, 0) / n : 0;
    var fast = n ? Math.min.apply(null, times) : 0;
    var slow = n ? Math.max.apply(null, times) : 0;
    el.stats.innerHTML =
      row('Rounds', n) +
      row('Average', n ? avg.toFixed(1) + 's' : '-') +
      row('Fastest', n ? fast.toFixed(1) + 's' : '-') +
      row('Slowest', n ? slow.toFixed(1) + 's' : '-');
  }

  function row(k, v) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0">' +
      '<span style="color:#8a8aa8">' + k + '</span><span style="font-weight:600">' + v + '</span></div>';
  }

  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    return (m > 0 ? m + ':' + String(s % 60).padStart(2, '0') : s + 's');
  }

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function restorePosition(root) {
    var p = load(LS_POS, null);
    if (p && typeof p.left === 'number') {
      root.style.left = p.left + 'px';
      root.style.top = p.top + 'px';
      root.style.right = 'auto';
    }
  }

  function buildPanel() {
    var root = document.createElement('div');
    root.style.cssText = [
      'position:fixed', 'top:80px', 'right:16px', 'z-index:2147483000',
      'width:200px', 'font-family:Inter,system-ui,sans-serif', 'font-size:13px',
      'color:#f0f0f8', 'background:#12121f', 'border:1px solid #262640',
      'border-radius:10px', 'box-shadow:0 8px 30px rgba(0,0,0,.35)', 'overflow:hidden',
      'user-select:none'
    ].join(';');

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#181826;cursor:move';
    header.innerHTML = '<span style="font-weight:700;letter-spacing:.02em">Round Timer</span>' +
      '<a href="https://geoguessrcheats.com/" target="_blank" rel="noopener" style="color:#ff6600;text-decoration:none;font-size:11px;font-weight:600">ATLAS</a>';

    var live = document.createElement('div');
    live.style.cssText = 'font-size:28px;font-weight:800;text-align:center;padding:10px 0 4px;font-variant-numeric:tabular-nums';
    live.textContent = '0s';

    var stats = document.createElement('div');
    stats.style.cssText = 'padding:6px 12px 10px';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;padding:0 10px 12px';
    var logBtn = mkBtn('Log', '#ff6600', '#fff');
    var resetBtn = mkBtn('Reset', 'transparent', '#8a8aa8');
    var csvBtn = mkBtn('CSV', 'transparent', '#8a8aa8');
    btns.appendChild(logBtn); btns.appendChild(resetBtn); btns.appendChild(csvBtn);

    root.appendChild(header);
    root.appendChild(live);
    root.appendChild(stats);
    root.appendChild(btns);

    makeDraggable(root, header);

    return { root: root, header: header, live: live, stats: stats, logBtn: logBtn, resetBtn: resetBtn, csvBtn: csvBtn };
  }

  function mkBtn(label, bg, fg) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'flex:1;border:1px solid #262640;background:' + bg + ';color:' + fg +
      ';border-radius:7px;padding:7px 0;font-size:12px;font-weight:600;cursor:pointer';
    return b;
  }

  function makeDraggable(root, handle) {
    var sx, sy, ox, oy, dragging = false;
    handle.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'A') return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      var r = root.getBoundingClientRect();
      ox = r.left; oy = r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var left = Math.max(0, ox + (e.clientX - sx));
      var top = Math.max(0, oy + (e.clientY - sy));
      root.style.left = left + 'px';
      root.style.top = top + 'px';
      root.style.right = 'auto';
    });
    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      var r = root.getBoundingClientRect();
      save(LS_POS, { left: Math.round(r.left), top: Math.round(r.top) });
    });
  }
})();
