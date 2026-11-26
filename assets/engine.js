/* Shared drill engine. Every scenario is a JSON file in /scenarios; this file
   plays any of them. Scenario authors should not need to edit this file:
   see README.md for the scenario format. */
(() => {
'use strict';

const GRADES = {
  good: ['Strong call', 'var(--good)'],
  ok:   ['Workable, with gaps', 'var(--okc)'],
  poor: ['Risky', 'var(--bad)']
};
const IDLE_PAUSE = 'Nothing out of place right now. Breathe, scan, carry on.';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let D;      // the scenario
let st;     // the player's state
let svgReady = false;

/* ---------- conditions and values ---------- */

// "flag", "!flag", "flag=value", "flag!=value", or a list meaning "all of these".
function test(cond) {
  if (cond === undefined || cond === null || cond === '') return true;
  if (Array.isArray(cond)) return cond.every(test);
  const c = String(cond).trim();
  const m = c.match(/^([\w.-]+)\s*(!=|=)\s*(.+)$/);
  if (m) {
    const v = String(st.flags[m[1]] ?? '');
    return m[2] === '=' ? v === m[3].trim() : v !== m[3].trim();
  }
  if (c.startsWith('!')) return !st.flags[c.slice(1).trim()];
  return !!st.flags[c];
}
const isIf = x => x && typeof x === 'object' && !Array.isArray(x) && 'if' in x && ('then' in x || 'else' in x);
// Resolve { "if": ..., "then": ..., "else": ... } (nestable) to a plain value.
function val(x) { while (isIf(x)) x = test(x.if) ? x.then : x.else; return x; }
// A list of cases: the first one whose "if" holds (a case with no "if" always holds).
function firstCase(list) { return Array.isArray(list) ? list.find(c => test(c.if)) : val(list); }

const toMin = t => { const s = String(t).padStart(4, '0'); return (+s.slice(0, 2)) * 60 + (+s.slice(2)); };
const hhmm = n => String(Math.floor(n / 60) % 24).padStart(2, '0') + String(n % 60).padStart(2, '0');
// Fill {tokens}: {minutes}, any clock name, or any flag.
function fill(s) {
  s = val(s);
  if (s === undefined || s === null) return '';
  return String(s).replace(/\{([\w-]+)\}/g, (all, k) => {
    if (k === 'minutes') return st.m;
    if (D.clock && k in D.clock) return hhmm(toMin(D.clock[k]) + st.m);
    if (k in st.flags) return st.flags[k];
    return all;
  });
}
function applySet(obj) {
  obj = val(obj);
  if (!obj || typeof obj !== 'object') return;
  for (const k in obj) st.flags[k] = obj[k];
}

/* ---------- state ---------- */

function reset() {
  st = { id: D.start || 'intro', flags: JSON.parse(JSON.stringify(D.state || {})), sc: {}, log: [], m: 0,
         picked: null, pause: false, pauses: 0, maxStep: 0 };
  for (const k in D.skills) st.sc[k] = 0;
  enter(st.id);
}
function enter(id) {
  st.id = id; st.picked = null; st.pause = false;
  const sc = D.scenes[id];
  if (sc) { applySet(sc.onEnter); st.maxStep = Math.max(st.maxStep, +val(sc.step) || 0); }
}
function go(id) {
  enter(id);
  render();
  $('scene').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// What a scene looks like right now (resolved against the current flags).
function view(sc) {
  return { step: +val(sc.step) || 0, time: fill(sc.time), title: fill(sc.title), text: fill(sc.text),
           say: resolveSay(sc.say), q: fill(sc.question), alert: !!val(sc.alert) };
}
function resolveSay(say) {
  say = val(say);
  if (!Array.isArray(say)) return [];
  return say.map(l => val(l)).filter(Boolean).map(l => ({ who: l.who, line: fill(l.line) }));
}
function pick(i, fromPause) {
  const sc = D.scenes[st.id];
  const list = fromPause ? sc.pause.choices : sc.choices;
  const c = list[i];
  const next = c.next ?? sc.next;
  if (!c.grade) { applySet(c.set); go(val(next)); return; }   // a plain "carry on" button
  // Words and feedback are read before the choice changes anything.
  const shown = { text: fill(c.text), grade: c.grade, say: resolveSay(c.say), feedback: fill(c.feedback) };
  const v = view(sc);
  for (const k in c.skills || {}) st.sc[k] = (st.sc[k] || 0) + c.skills[k];
  st.m += +c.minutes || 0;
  applySet(c.set);
  st.log.push({ step: Math.max(v.step, st.maxStep), text: shown.text, grade: c.grade, pause: fromPause });
  st.picked = { c: shown, v, next };
  st.pause = false;
  render();
}

/* ---------- drawing ---------- */

function sayHTML(lines) {
  if (!lines.length) return '';
  return '<div class="say">' + lines.map(l => {
    const p = D.people[l.who] || { name: l.who };
    return `<p class="${p.me ? 'me' : ''}"><b>${esc(p.name)}</b>${esc(l.line)}</p>`;
  }).join('') + '</div>';
}
function railHTML(cur) {
  return D.steps.map((n, i) => `<div class="${i + 1 < cur ? 'done' : i + 1 === cur ? 'now' : ''}"><b>${i + 1}</b>${esc(n)}</div>`).join('');
}
function drawPicture() {
  const P = D.picture;
  if (!P || !svgReady) return;
  const svg = $('pic').querySelector('svg');
  for (const id in P.show || {}) { const el = svg.getElementById(id); if (el) el.style.display = test(P.show[id]) ? '' : 'none'; }
  for (const id in P.move || {}) {
    const el = svg.getElementById(id), c = firstCase(P.move[id]);
    if (el && c && c.to) el.setAttribute('transform', c.to);
  }
  if (P.shake) {
    const el = svg.getElementById(P.shake), sc = D.scenes[st.id];
    if (el) el.classList.toggle('shaking', !!(sc && val(sc.alert) && !st.picked));
  }
  const cap = firstCase(P.caption);
  $('cap').textContent = cap ? fill(cap.text) : '';
}
function drawChecklist() {
  const C = D.checklist, el = $('cl');
  if (!C) { el.style.display = 'none'; return; }
  el.classList.toggle('later', C.showWhen !== undefined && !test(C.showWhen));
  el.innerHTML = `<h3>${esc(fill(C.title))}</h3><ol>${(C.items || []).map(it =>
    `<li class="${it.highlight ? 'x' : ''}"><i>${test(it.tick) && it.tick !== undefined ? '✓' : ''}</i>${esc(fill(it.text))}</li>`).join('')}</ol>` +
    (C.note ? `<p class="note">${esc(fill(C.note))}</p>` : '');
}

function render() {
  if (st.id === 'debrief') { $('rail').innerHTML = railHTML(D.steps.length + 1); drawPicture(); renderDebrief(); return; }
  const sc = D.scenes[st.id];
  const v = st.picked ? st.picked.v : view(sc);
  // The step bar never moves backwards, even when a branch loops to an earlier scene.
  const step = Math.max(v.step, st.maxStep);
  $('rail').innerHTML = railHTML(step);
  drawPicture(); drawChecklist();
  let h = `<div class="top"><div><div class="time">${esc(v.time)}${v.time ? ' hrs' : ''}${step ? (v.time ? ' · ' : '') + 'Step ' + Math.min(step, D.steps.length) : ''}</div><h2>${esc(v.title)}</h2></div>
  <button class="pause${v.alert && !st.picked ? ' alert' : ''}" id="pz" aria-label="Pause">PAUSE<small>then NBA</small></button></div>`;
  if (v.text) h += `<p class="text">${esc(v.text)}</p>`;
  h += sayHTML(v.say);
  if (st.pause && !st.picked) {
    h += sc.pause
      ? `<div class="pp"><h3>Paused</h3><p>${esc(fill(sc.pause.prompt))}</p><div class="ch">${sc.pause.choices.map((c, i) => `<button data-p="${i}">${esc(fill(c.text))}</button>`).join('')}</div></div>`
      : `<div class="pp"><h3>Paused</h3><p>${esc(fill(D.idlePause || IDLE_PAUSE))}</p><button class="go" id="unp">Resume</button></div>`;
  }
  if (st.picked) {
    const c = st.picked.c, g = GRADES[c.grade];
    h += `<p class="q">${esc(c.text)}</p>` + sayHTML(c.say) +
      `<div class="fb" style="--g:${g[1]}"><strong>${g[0]}</strong><p>${esc(c.feedback)}</p></div><button class="go" id="next">Continue</button>`;
  } else if (!st.pause) {
    h += `<p class="q">${esc(v.q || (v.step ? 'Your call:' : ''))}</p><div class="ch">${sc.choices.map((c, i) => `<button data-i="${i}">${esc(fill(c.text))}</button>`).join('')}</div>`;
  }
  const s = $('scene');
  s.className = 'card'; s.innerHTML = h;
  document.querySelector('.side').style.display = '';
  s.querySelectorAll('[data-i]').forEach(b => b.onclick = () => pick(+b.dataset.i, false));
  s.querySelectorAll('[data-p]').forEach(b => b.onclick = () => pick(+b.dataset.p, true));
  $('pz').onclick = () => { if (st.picked) return; st.pause = !st.pause; if (st.pause) st.pauses++; render(); };
  if ($('unp')) $('unp').onclick = () => { st.pause = false; render(); };
  if ($('next')) $('next').onclick = () => go(val(st.picked.next));
}

function renderDebrief() {
  const B = D.debrief || {};
  const vd = firstCase(B.verdicts) || { title: 'Drill complete', text: '' };
  const bars = Object.keys(D.skills).map(k => {
    const n = st.sc[k], mx = D.skills[k].max || 1;
    return `<div class="bar"><div>${esc(D.skills[k].name)}</div><span><i style="width:${Math.max(0, Math.min(100, n / mx * 100))}%"></i></span><em style="color:${n < 0 ? 'var(--bad)' : 'inherit'}">${n > 0 ? '+' : ''}${n}</em></div>`;
  }).join('');
  const log = st.log.map(l => `<li><span class="tag" style="--g:${GRADES[l.grade][1]}">Step ${Math.min(l.step, D.steps.length)}${l.pause ? ' · Pause' : ''}</span><span>${esc(l.text)}</span></li>`).join('');
  const qs = (B.questions || []).map(q => `<li>${esc(fill(q))}</li>`).join('');
  document.querySelector('.side').style.display = 'none';
  const s = $('scene');
  s.className = 'card db';
  s.innerHTML = `<div class="time">Debrief</div><p class="verdict">${esc(fill(vd.title))}</p><p class="text">${esc(fill(vd.text))}</p>
  ${B.cheese ? `<div class="fig"><svg id="sw" role="img" aria-label="${esc(B.cheese.label || 'Swiss cheese view of the barriers')}"></svg></div>` : ''}
  <div class="grid2"><div><h3>CRM skills</h3>${bars}<p class="note">PAUSE pressed ${st.pauses} time${st.pauses === 1 ? '' : 's'}.${B.skillsNote ? ' ' + esc(fill(B.skillsNote)) : ''}</p></div>
  <div><h3>Your calls</h3><ul class="log">${log}</ul></div></div>
  ${qs ? `<details open><summary>Facilitator questions</summary><ol>${qs}</ol></details>` : ''}
  <button class="go" id="again">Run the drill again</button><a class="go ghost" href="index.html">All drills</a>
  ${B.footnote ? `<p class="note">${esc(fill(B.footnote))}</p>` : ''}`;
  $('again').onclick = () => { reset(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  if (B.cheese) drawCheese(B.cheese);
}

function drawCheese(C) {
  const s = $('sw'), layers = C.layers || [];
  const draw = () => {
    const W = s.clientWidth, H = s.clientHeight, narrow = W < 520, n = layers.length;
    const xs = layers.map((_, i) => (n === 1 ? .55 : .33 + i * (.44 / (n - 1))) * W);
    const y = H * .42, sh = H * .62, sw = Math.max(18, W * .035);
    let stop = null;
    layers.forEach((l, i) => { if (stop === null && st.flags[l.flag] === 'held') stop = i; });
    const endX = stop === null ? W - 14 : xs[stop] - sw / 2 - 4;
    let o = `<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#f2b705"/></marker></defs>`;
    layers.forEach((l, i) => {
      const x = xs[i], v = st.flags[l.flag], held = v === 'held', reached = stop === null || i <= stop;
      const missed = reached && v === 'missed';
      const col = held ? '#6f7a3b' : missed ? '#c9b46a' : '#8a8670';
      o += `<g opacity="${held || missed ? 1 : .35}"><rect x="${x - sw / 2}" y="${y - sh / 2}" width="${sw}" height="${sh}" rx="${sw / 2}" fill="${col}"/>`;
      o += `<circle cx="${x}" cy="${y - sh * .3}" r="${sw * .22}" fill="var(--card)"/><circle cx="${x}" cy="${y + sh * .28}" r="${sw * .18}" fill="var(--card)"/>`;
      if (!held) o += `<circle cx="${x}" cy="${y}" r="${sw * .32}" fill="var(--card)"/>`;
      o += `</g><text x="${x}" y="${y + sh / 2 + 20}" text-anchor="middle" font-size="${narrow ? 12 : 14}" font-weight="600" fill="currentColor">${esc(narrow && l.short ? l.short : l.label)}</text>`;
      o += `<text x="${x}" y="${y + sh / 2 + 38}" text-anchor="middle" font-size="12" fill="currentColor" opacity=".7">${held ? 'held' : missed ? 'missed' : 'not reached'}</text>`;
    });
    o += `<text x="10" y="${y - 14}" font-size="13" font-weight="600" fill="currentColor">${esc(narrow && C.hazardShort ? C.hazardShort : C.hazard)}</text>`;
    o += `<line x1="10" y1="${y}" x2="${endX}" y2="${y}" stroke="#f2b705" stroke-width="4" marker-end="url(#ah)"/>`;
    if (stop === null && C.outcome) o += `<text x="${W - 12}" y="${y - 24}" text-anchor="end" font-size="13" font-weight="700" fill="var(--bad)">${esc(C.outcome)}</text>`;
    s.innerHTML = o;
  };
  new ResizeObserver(draw).observe(s);
}

/* ---------- checking a scenario file ---------- */

function targets(x, out = []) {
  if (isIf(x)) { targets(x.then, out); targets(x.else, out); }
  else if (typeof x === 'string') out.push(x);
  return out;
}
function check(d) {
  const e = [];
  const need = (cond, msg) => { if (!cond) e.push(msg); };
  need(d && typeof d === 'object', 'The file should start with { and end with }.');
  if (e.length) return e;
  need(d.title, 'Add a "title".');
  need(Array.isArray(d.steps) && d.steps.length, 'Add "steps": a list of step names for the bar across the top.');
  need(d.skills && Object.keys(d.skills).length, 'Add "skills": the CRM skills you score.');
  need(d.people && typeof d.people === 'object', 'Add "people": everyone who speaks.');
  need(d.scenes && typeof d.scenes === 'object', 'Add "scenes".');
  if (e.length) return e;
  const start = d.start || 'intro';
  need(d.scenes[start], `The first scene "${start}" doesn't exist. Add it, or set "start" to the id of your first scene.`);
  const hasScene = id => id === 'debrief' || !!d.scenes[id];
  const checkSay = (say, where) => {
    const lines = [];
    const walk = x => { if (isIf(x)) { walk(x.then); walk(x.else); } else if (Array.isArray(x)) x.forEach(walk); else if (x) lines.push(x); };
    walk(say);
    lines.forEach(l => {
      if (!l.who || !l.line) e.push(`${where}: each spoken line needs "who" and "line".`);
      else if (!d.people[l.who]) e.push(`${where}: "${l.who}" speaks but isn't listed in "people".`);
    });
  };
  for (const id in d.scenes) {
    const sc = d.scenes[id], at = `Scene "${id}"`;
    if (id === 'debrief') { e.push('"debrief" is a reserved name: the engine draws the debrief itself. Rename that scene.'); continue; }
    need(sc.title, `${at} needs a "title".`);
    need(Array.isArray(sc.choices) && sc.choices.length, `${at} needs at least one choice in "choices".`);
    checkSay(sc.say, at);
    const all = [...(sc.choices || []).map((c, i) => [c, `${at}, choice ${i + 1}`]),
                 ...((sc.pause && sc.pause.choices) || []).map((c, i) => [c, `${at}, pause choice ${i + 1}`])];
    if (sc.pause) need(sc.pause.prompt && Array.isArray(sc.pause.choices), `${at}: "pause" needs a "prompt" and a list of "choices".`);
    all.forEach(([c, where]) => {
      need(c.text, `${where} needs "text".`);
      if (c.grade !== undefined) {
        need(GRADES[c.grade], `${where}: "grade" must be "good", "ok" or "poor" (it says "${c.grade}").`);
        need(c.feedback, `${where} has a grade, so it needs "feedback".`);
      }
      for (const k in c.skills || {}) {
        need(d.skills[k], `${where} scores "${k}", which isn't in "skills".`);
        need(typeof c.skills[k] === 'number', `${where}: skill points for "${k}" must be a number, without quotes.`);
      }
      checkSay(c.say, where);
      const nx = c.next ?? sc.next;
      if (nx === undefined) e.push(`${where} has no "next", and the scene has no "next" either, so the drill wouldn't know where to go.`);
      targets(nx).forEach(t => need(hasScene(t), `${where} goes to "${t}", but there is no scene called "${t}".`));
    });
  }
  ((d.debrief && d.debrief.cheese && d.debrief.cheese.layers) || []).forEach((l, i) =>
    need(l.flag && l.label, `Swiss cheese layer ${i + 1} needs a "flag" and a "label".`));
  return e;
}

/* ---------- loading ---------- */

function showErrors(title, list, extra = '') {
  $('main').className = 'one';
  $('main').innerHTML = `<section class="card err"><h2>${esc(title)}</h2><ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${extra}
    <a class="go" href="index.html">Back to all drills</a></section>`;
}
function parse(text, name) {
  try { return JSON.parse(text); }
  catch (err) {
    let where = '';
    const m = String(err.message).match(/position (\d+)/);
    if (m) {
      const before = text.slice(0, +m[1]), line = before.split('\n').length;
      where = ` Look near line ${line}: "${text.split('\n')[line - 1].trim().slice(0, 80)}".`;
    }
    throw [`${name} isn't valid JSON.${where} Common causes: a missing comma between items, a comma after the last item, or straight quotes " inside text (use curly quotes “ ” or ’ instead).`, `Details: ${err.message}`];
  }
}
async function start(data) {
  const errs = check(data);
  if (errs.length) { showErrors('This scenario file has problems', errs); return; }
  D = data;
  document.title = D.title + ' · CRM drills';
  $('title').textContent = D.title;
  $('sub').textContent = D.subtitle || '';
  $('main').className = '';
  $('main').innerHTML = `<section class="card" id="scene" aria-live="polite"></section>
    <aside class="side"><div class="card pic" id="picWrap"><div id="pic"></div><p class="cap" id="cap"></p></div><div class="card cl" id="cl"></div></aside>`;
  if (D.picture && D.picture.file) {
    try {
      const r = await fetch(D.picture.file);
      if (!r.ok) throw 0;
      $('pic').innerHTML = await r.text();
      const svg = $('pic').querySelector('svg');
      if (svg && D.picture.alt) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', D.picture.alt); }
      svgReady = !!svg;
    } catch { $('pic').innerHTML = `<p class="note">Picture "${esc(D.picture.file)}" could not be loaded.</p>`; }
  } else $('picWrap').style.display = 'none';
  reset(); render();
}

async function boot() {
  const id = new URLSearchParams(location.search).get('s');
  if (!id) { tester(); return; }
  if (!/^[\w-]+$/.test(id)) { showErrors('Unknown drill', ['That link doesn’t point to a drill.']); return; }
  try {
    const r = await fetch(`scenarios/${id}.json`, { cache: 'no-cache' });
    if (!r.ok) throw [`There is no scenario file called scenarios/${id}.json.`];
    await start(parse(await r.text(), `scenarios/${id}.json`));
  } catch (err) {
    if (Array.isArray(err)) showErrors('Couldn’t open this drill', err);
    else showErrors('Couldn’t open this drill', ['The scenario file couldn’t be loaded. If you opened this page straight from your computer, use the live site or a local web server instead (see README).']);
  }
}

// drill.html with no ?s= lets an author try a scenario file from their own computer.
function tester() {
  $('title').textContent = 'Try a scenario file';
  $('sub').textContent = 'Pick a scenario JSON file from your computer to play it here and check it for mistakes. The file stays on your computer; nothing is uploaded.';
  $('main').className = 'one';
  $('main').innerHTML = `<section class="card"><h2>Choose a file</h2>
    <p class="text">Use this while writing a new drill. If anything is wrong, you get a list of what to fix.</p>
    <input type="file" id="file" accept=".json,application/json"></section>`;
  $('file').onchange = () => {
    const f = $('file').files[0];
    if (!f) return;
    f.text().then(t => start(parse(t, f.name))).catch(err =>
      showErrors('This scenario file has problems', Array.isArray(err) ? err : [String(err)]));
  };
}

boot();
})();
