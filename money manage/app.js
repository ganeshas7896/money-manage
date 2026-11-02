const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits: 2});
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CATS = {expense:['Food','Rent','Travel','Shopping','Bills','Health','Fun','Other'], income:['Salary','Business','Gift','Other']};
let mode = 'login', view = 'dash', calcExp = '';

async function api(a, body, qs = '') {
  try {
    const r = await fetch('api.php?a=' + a + qs, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})});
    return await r.json();
  } catch (e) { return {error: 'Network error'}; }
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); }
function notify(title, body) {
  toast(title + ' — ' + body);
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, {body});
}

// Theme
function setTheme(d) { document.documentElement.classList.toggle('dark', d); localStorage.setItem('mm_dark', d ? 1 : 0); }
function toggleTheme() { setTheme(!document.documentElement.classList.contains('dark')); }
setTheme(localStorage.getItem('mm_dark') === null ? matchMedia('(prefers-color-scheme: dark)').matches : localStorage.getItem('mm_dark') === '1');

// Auth
$('#authSwitch').onclick = e => {
  e.preventDefault(); mode = mode === 'login' ? 'register' : 'login';
  $('#aName').style.display = mode === 'register' ? 'block' : 'none';
  $('#authBtn').textContent = mode === 'login' ? 'Login' : 'Create account';
  $('#authSwitch').textContent = mode === 'login' ? 'New here? Create account' : 'Have an account? Login';
};
$('#authBtn').onclick = async () => {
  const r = await api(mode, {name: $('#aName').value, email: $('#aEmail').value, password: $('#aPass').value});
  if (r.error) return toast(r.error);
  start();
};
async function logout() { await api('logout'); location.reload(); }
async function init() { const r = await api('me'); if (r.user) start(); }
function start() {
  $('#auth').style.display = 'none'; $('#app').style.display = 'block';
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  go('dash');
}

// Navigation
document.querySelectorAll('.nav button').forEach(b => b.onclick = () => go(b.dataset.v));
function go(v) {
  view = v;
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  $('#title').textContent = {dash:'Home', add:'Add Entry', month:'Monthly Tracking', year:'Yearly Tracking', calc:'Calculator'}[v];
  ({dash, add: addView, month, year, calc})[v]();
}
const txRow = t => `<div class="tx"><div><b>${esc(t.category)}</b><small>${esc(t.note || '')} · ${t.tx_date}</small></div>
  <div><b class="${t.type === 'income' ? 'inc' : 'exp'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</b>
  <button onclick="del(${t.id})">🗑️</button></div></div>`;
async function del(id) { if (confirm('Delete this entry?')) { await api('delete', {id}); go(view); } }
function grow() { requestAnimationFrame(() => setTimeout(() => {
  document.querySelectorAll('[data-h]').forEach(e => e.style.height = e.dataset.h + '%');
  document.querySelectorAll('[data-w]').forEach(e => e.style.width = e.dataset.w + '%');
}, 60)); }

// Views
async function dash() {
  const [s, l] = await Promise.all([api('stats'), api('list')]);
  const inc = +s.total.inc, exp = +s.total.exp, max = Math.max(1, ...s.cats.map(c => +c.amt));
  $('#view').innerHTML = `
  <div class="card hero"><small>Total Balance</small><b>${money(inc - exp)}</b></div>
  <div class="grid"><div class="card stat"><small>Income</small><b class="inc">${money(inc)}</b></div>
  <div class="card stat"><small>Expenses</small><b class="exp">${money(exp)}</b></div>
  <div class="card stat"><small>Tally</small><b>${l.items.length}+ </b></div></div>
  <div class="card"><b>This month by category</b><br><br>${s.cats.map(c => `<div>${esc(c.category)} <span style="float:right">${money(c.amt)}</span></div><div class="hb"><i data-w="${c.amt / max * 100}"></i></div>`).join('') || '<p class="muted">No expenses yet this month.</p>'}</div>
  <div class="card"><b>Recent</b>${l.items.map(txRow).join('') || '<p class="muted">Nothing yet. Tap Add.</p>'}</div>`;
  grow();
  const m = s.months.find(x => +x.m === new Date().getMonth() + 1);
  if (m && +m.exp > +m.inc && +m.exp > 0) notify('Budget alert ⚠️', 'This month spending is higher than income.');
}
function addView() {
  let type = 'expense';
  $('#view').innerHTML = `<div class="card">
  <div class="seg"><button class="e on" id="tE">Outgoing</button><button class="i" id="tI">Income</button></div>
  <select id="fCat"></select><input id="fAmt" type="number" step="0.01" placeholder="Amount">
  <input id="fNote" placeholder="Note (optional)"><input id="fDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
  <button class="btn" id="fSave">Save</button></div>`;
  const fill = () => { $('#fCat').innerHTML = CATS[type].map(c => `<option>${c}</option>`).join('');
    $('#tE').className = 'e' + (type === 'expense' ? ' on' : ''); $('#tI').className = 'i' + (type === 'income' ? ' on' : ''); };
  fill();
  $('#tE').onclick = () => { type = 'expense'; fill(); }; $('#tI').onclick = () => { type = 'income'; fill(); };
  $('#fSave').onclick = async () => {
    const amount = $('#fAmt').value;
    const r = await api('add', {type, category: $('#fCat').value, amount, note: $('#fNote').value, date: $('#fDate').value});
    if (r.error) return toast(r.error);
    notify(type === 'income' ? 'Income added ✅' : 'Expense added 💸', money(amount));
    go('dash');
  };
}
async function month() {
  const now = new Date(), ym = now.toISOString().slice(0, 7);
  $('#view').innerHTML = `<input type="month" id="mPick" value="${ym}"><div id="mBox"></div>`;
  const load = async () => {
    const m = $('#mPick').value, y = m.slice(0, 4);
    const [l, s] = await Promise.all([api('list', null, '&m=' + m), api('stats', null, '&y=' + y)]);
    const inc = l.items.filter(t => t.type === 'income').reduce((a, t) => a + +t.amount, 0);
    const exp = l.items.filter(t => t.type === 'expense').reduce((a, t) => a + +t.amount, 0);
    const max = Math.max(1, ...s.months.flatMap(x => [+x.inc, +x.exp]));
    $('#mBox').innerHTML = `<div class="grid"><div class="card stat"><small>Income</small><b class="inc">${money(inc)}</b></div>
    <div class="card stat"><small>Expenses</small><b class="exp">${money(exp)}</b></div>
    <div class="card stat"><small>Balance</small><b>${money(inc - exp)}</b></div></div>
    <div class="card"><b>${y} month by month</b><div class="bars">${MON.map((n, i) => { const d = s.months.find(x => +x.m === i + 1) || {inc: 0, exp: 0};
      return `<div class="col"><div><i style="background:var(--inc)" data-h="${d.inc / max * 100}"></i><i style="background:var(--exp)" data-h="${d.exp / max * 100}"></i></div>${n}</div>`; }).join('')}</div>
    <p class="muted">🟢 Income &nbsp; 🔴 Expense</p></div>
    <div class="card">${l.items.map(txRow).join('') || '<p class="muted">No entries this month.</p>'}</div>`;
    grow();
  };
  $('#mPick').onchange = load; load();
}
async function year() {
  const s = await api('stats'), max = Math.max(1, ...s.years.flatMap(y => [+y.inc, +y.exp]));
  $('#view').innerHTML = `<div class="card"><table><tr><th>Year</th><th>Income</th><th>Expense</th><th>Saved</th></tr>
  ${s.years.map(y => `<tr><td>${y.y}</td><td class="inc">${money(y.inc)}</td><td class="exp">${money(y.exp)}</td><td>${money(y.inc - y.exp)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No data yet</td></tr>'}</table></div>
  ${s.years.map(y => `<div class="card"><b>${y.y}</b><div class="hb"><i style="background:var(--inc)" data-w="${y.inc / max * 100}"></i></div><div class="hb"><i style="background:var(--exp)" data-w="${y.exp / max * 100}"></i></div></div>`).join('')}`;
  grow();
}
function calc() {
  calcExp = '';
  const keys = ['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','='];
  $('#view').innerHTML = `<div class="card calc"><div class="scr" id="scr">0</div><div class="keys">
  ${keys.map(k => `<button class="${'÷×−+%'.includes(k) ? 'op' : k === '=' ? 'eq' : ''}" style="${k === '0' ? 'grid-column:span 2' : ''}" data-k="${k}">${k}</button>`).join('')}</div></div>`;
  document.querySelectorAll('.keys button').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'C') calcExp = ''; else if (k === '⌫') calcExp = calcExp.slice(0, -1);
    else if (k === '=') { try { calcExp = String(+(Function('"use strict";return(' + calcExp.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-').replace(/%/g, '/100') + ')')()).toFixed(8)); } catch (e) { calcExp = ''; toast('Invalid'); } }
    else calcExp += k;
    $('#scr').textContent = calcExp || '0';
  });
}
init();
