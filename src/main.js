import './styles.css';
import { WEEKDAY_LABELS, STRATEGY_LABELS, createAlarm, computeNextDue, shouldFire, fireAlarm, snoozeAlarm, timeText, dateText, nextDueLabel, dateKey, intervalPhaseLabel, alertMessage } from './alarmEngine.js';

const STORAGE_KEY = 'timepilot.alarms.v1';
const state = { alarms: [], now: new Date(), activeAlert: null, audio: null };
const $ = (sel) => document.querySelector(sel);

function load() {
  try { state.alarms = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { state.alarms = []; }
  state.alarms = state.alarms.map(a => ({...a, nextDueAt: a.enabled ? (a.nextDueAt || computeNextDue(a, new Date())) : null}));
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.alarms)); }
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(()=>{});
}
function beep(alarm) {
  const ctx = state.audio || new (window.AudioContext || window.webkitAudioContext)(); state.audio = ctx;
  const gain = ctx.createGain(); gain.gain.value = Math.min(1, Math.max(0.05, (alarm.volume || 70)/100)); gain.connect(ctx.destination);
  const pattern = alarm.sound === 'gentle' ? [440, 0, 660] : alarm.sound === 'urgent' ? [880, 660, 880, 660, 1100] : [523, 659, 784];
  let t = ctx.currentTime;
  pattern.forEach(freq => { if (freq) { const osc = ctx.createOscillator(); osc.type = alarm.sound === 'urgent' ? 'square' : 'sine'; osc.frequency.value = freq; osc.connect(gain); osc.start(t); osc.stop(t + 0.22); } t += 0.28; });
}
function notify(alarm) {
  beep(alarm); document.body.classList.add('ringing'); setTimeout(()=>document.body.classList.remove('ringing'), 1800);
  if ('Notification' in window && Notification.permission === 'granted') new Notification(`⏰ ${alarm.title}`, { body: alertMessage(alarm), tag: alarm.id });
}
function addAlarm(formData) {
  const weekdays = [...document.querySelectorAll('input[name="weekday"]:checked')].map(i => Number(i.value));
  const alarm = createAlarm({
    title: formData.get('title'), note: formData.get('note'), strategy: formData.get('strategy'),
    time: formData.get('time'), date: formData.get('date'), weekdays,
    timerMinutes: formData.get('timerMinutes'), intervalMinutes: formData.get('intervalMinutes'), restMinutes: formData.get('restMinutes'), snoozeMinutes: formData.get('snoozeMinutes'),
    maxSnoozes: formData.get('maxSnoozes'), sound: formData.get('sound'), volume: formData.get('volume')
  });
  alarm.nextDueAt = computeNextDue(alarm, new Date());
  state.alarms.unshift(alarm); save(); render();
}
function updateAlarm(id, patch) {
  state.alarms = state.alarms.map(a => {
    if (a.id !== id) return a;
    const next = { ...a, ...patch, updatedAt: new Date().toISOString() };
    if ('enabled' in patch || 'strategy' in patch || 'time' in patch || 'date' in patch || 'intervalMinutes' in patch || 'restMinutes' in patch) next.nextDueAt = computeNextDue(next, new Date());
    return next;
  }); save(); render();
}
function removeAlarm(id) { state.alarms = state.alarms.filter(a => a.id !== id); save(); render(); }
function checkDue() {
  state.now = new Date();
  for (const alarm of state.alarms) {
    if (shouldFire(alarm, state.now)) {
      state.activeAlert = alarm;
      notify(alarm);
      state.alarms = state.alarms.map(a => a.id === alarm.id ? fireAlarm(a, state.now) : a);
      save(); break;
    }
  }
  renderClock(); renderList(); renderAlert();
}
function renderClock() {
  $('#clock').textContent = timeText(state.now);
  $('#date').textContent = dateText(state.now);
}
function renderForm() {
  const today = dateKey(new Date());
  return `<section class="card form-card"><div class="section-title"><span>新建闹钟</span><button id="permissionBtn" class="ghost" type="button">开启通知</button></div>
    <form id="alarmForm" class="alarm-form">
      <label>名称<input name="title" placeholder="晨会 / 午休 / 喝水" required /></label>
      <label>策略<select name="strategy" id="strategy"><option value="once">一次性</option><option value="daily" selected>每日</option><option value="weekdays">工作日</option><option value="weekends">周末</option><option value="weekly">指定星期</option><option value="timer">倒计时</option><option value="interval">循环休息（每 N 分钟休息 M 分钟）</option></select></label>
      <label class="time-field">时间<input name="time" type="time" value="08:30" /></label>
      <label class="date-field">日期<input name="date" type="date" value="${today}" /></label>
      <label class="timer-field">倒计时分钟<input name="timerMinutes" type="number" min="1" value="5" /></label>
      <label class="interval-field">专注分钟<input name="intervalMinutes" type="number" min="1" value="60" /></label>
      <label class="interval-field">休息分钟<input name="restMinutes" type="number" min="1" value="10" /></label>
      <div class="weekday-field"><span>星期</span><div class="weekday-grid">${WEEKDAY_LABELS.map((w,i)=>`<label><input type="checkbox" name="weekday" value="${i}" ${i===1?'checked':''}/> ${w}</label>`).join('')}</div></div>
      <label>铃声<select name="sound"><option value="classic">经典</option><option value="gentle">轻柔</option><option value="urgent">紧急</option></select></label>
      <label>音量<input name="volume" type="range" min="5" max="100" value="70" /></label>
      <label>贪睡分钟<input name="snoozeMinutes" type="number" min="1" max="60" value="5" /></label>
      <label>最多贪睡<input name="maxSnoozes" type="number" min="0" max="10" value="3" /></label>
      <label class="full">备注<textarea name="note" placeholder="补充说明，如需要准备的事项"></textarea></label>
      <button class="primary full" type="submit">添加闹钟</button>
    </form></section>`;
}
function alarmSummary(a) {
  if (a.strategy === 'timer') return `${a.timerMinutes} 分钟`;
  if (a.strategy === 'interval') return intervalPhaseLabel(a);
  return a.time;
}
function renderList() {
  const list = $('#alarmList'); if (!list) return;
  const enabled = state.alarms.filter(a=>a.enabled).length;
  $('#stats').innerHTML = `<b>${state.alarms.length}</b> 个闹钟 · <b>${enabled}</b> 个启用`;
  list.innerHTML = state.alarms.length ? state.alarms.map(a => `<article class="alarm ${a.enabled?'':'disabled'}">
    <div class="alarm-main"><div><h3>${escapeHtml(a.title)}</h3><p>${STRATEGY_LABELS[a.strategy]} · ${alarmSummary(a)} · ${nextDueLabel(a.nextDueAt, state.now)}</p>${a.note?`<small>${escapeHtml(a.note)}</small>`:''}</div>
    <label class="switch"><input type="checkbox" data-action="toggle" data-id="${a.id}" ${a.enabled?'checked':''}/><span></span></label></div>
    <div class="alarm-actions"><button data-action="test" data-id="${a.id}">试听</button><button data-action="snooze" data-id="${a.id}" ${a.snoozeCount>=a.maxSnoozes?'disabled':''}>贪睡 ${a.snoozeCount||0}/${a.maxSnoozes}</button><button class="danger" data-action="delete" data-id="${a.id}">删除</button></div>
  </article>`).join('') : `<div class="empty">还没有闹钟。可以先创建一个“每日 08:30”的晨间提醒，或用倒计时做番茄钟。</div>`;
}
function renderAlert() {
  const box = $('#alertModal'); if (!box) return;
  if (!state.activeAlert) { box.classList.remove('show'); box.innerHTML=''; return; }
  const a = state.activeAlert;
  box.classList.add('show');
  box.innerHTML = `<div class="modal-card"><div class="alarm-icon">⏰</div><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(alertMessage(a))}</p><div class="modal-actions"><button id="dismissAlert" class="primary">知道了</button><button id="snoozeAlert">贪睡 ${a.snoozeMinutes} 分钟</button></div></div>`;
}
function escapeHtml(s='') { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function bindEvents() {
  document.addEventListener('submit', e => { if (e.target.id === 'alarmForm') { e.preventDefault(); requestNotificationPermission(); addAlarm(new FormData(e.target)); e.target.reset(); $('#strategy').value='daily'; }});
  document.addEventListener('click', e => {
    const id = e.target.dataset.id, action = e.target.dataset.action;
    if (e.target.id === 'permissionBtn') requestNotificationPermission();
    if (e.target.id === 'dismissAlert') { state.activeAlert=null; renderAlert(); }
    if (e.target.id === 'snoozeAlert' && state.activeAlert) { updateAlarm(state.activeAlert.id, snoozeAlarm(state.activeAlert, new Date())); state.activeAlert=null; renderAlert(); }
    if (!id) return; const alarm = state.alarms.find(a=>a.id===id); if (!alarm) return;
    if (action === 'delete' && confirm('确认删除这个闹钟？')) removeAlarm(id);
    if (action === 'test') notify(alarm);
    if (action === 'snooze') updateAlarm(id, snoozeAlarm(alarm, new Date()));
  });
  document.addEventListener('change', e => { if (e.target.dataset.action === 'toggle') updateAlarm(e.target.dataset.id, { enabled: e.target.checked }); });
}
function render() {
  $('#app').innerHTML = `<main><section class="hero card"><div><p class="eyebrow">TimePilot</p><h1 id="clock">--:--:--</h1><p id="date"></p></div><div class="hero-copy"><h2>产品化定时闹钟</h2><p>当前时间、重复策略、倒计时、贪睡、本地持久化和响铃提醒，适合日常工作/学习节奏管理。</p><div id="stats" class="stats"></div></div></section>${renderForm()}<section class="card"><div class="section-title"><span>闹钟列表</span><span class="hint">数据保存在当前浏览器</span></div><div id="alarmList"></div></section><div id="alertModal" class="modal"></div></main>`;
  renderClock(); renderList(); renderAlert();
}
load(); render(); bindEvents(); setInterval(checkDue, 1000); checkDue();
