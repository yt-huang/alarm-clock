import './styles.css';
import { WEEKDAY_LABELS, STRATEGY_LABELS, createAlarm, computeNextDue, shouldFire, fireAlarm, snoozeAlarm, timeText, dateText, nextDueLabel, dateKey, intervalPhaseLabel, alertMessage } from './alarmEngine.js';

const STORAGE_KEY = 'timepilot.alarms.v1';
const state = { alarms: [], now: new Date(), activeAlert: null, audio: null, toast: '' };
const $ = (sel) => document.querySelector(sel);

function load() {
  try { state.alarms = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { state.alarms = []; }
  state.alarms = state.alarms.map(a => ({...a, nextDueAt: a.enabled ? (a.nextDueAt || computeNextDue(a, new Date())) : null}));
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.alarms)); }
function toast(message) { state.toast = message; renderToast(); setTimeout(() => { state.toast = ''; renderToast(); }, 2400); }
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(()=>{});
}
function beep(alarm) {
  const ctx = state.audio || new (window.AudioContext || window.webkitAudioContext)(); state.audio = ctx;
  const gain = ctx.createGain(); gain.gain.value = Math.min(1, Math.max(0.05, (alarm.volume || 70)/100)); gain.connect(ctx.destination);
  const pattern = alarm.sound === 'gentle' ? [392, 0, 523, 0, 659] : alarm.sound === 'urgent' ? [880, 660, 880, 660, 1100] : [523, 659, 784];
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
  state.alarms.unshift(alarm); save(); render(); toast(`已创建「${alarm.title}」`);
}
function updateAlarm(id, patch) {
  state.alarms = state.alarms.map(a => {
    if (a.id !== id) return a;
    const next = { ...a, ...patch, updatedAt: new Date().toISOString() };
    if ('enabled' in patch || 'strategy' in patch || 'time' in patch || 'date' in patch || 'intervalMinutes' in patch || 'restMinutes' in patch) next.nextDueAt = computeNextDue(next, new Date());
    return next;
  }); save(); render();
}
function removeAlarm(id) { state.alarms = state.alarms.filter(a => a.id !== id); save(); render(); toast('闹钟已删除'); }
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
  const clock = $('#clock'); if (!clock) return;
  clock.textContent = timeText(state.now);
  $('#date').textContent = dateText(state.now);
}
function strategyHelp(strategy) {
  return {
    once: '只响一次，适合会议、快递、临时提醒。',
    daily: '每天固定时间提醒，适合起床、打卡、服药。',
    weekdays: '周一到周五提醒，适合工作日节奏。',
    weekends: '周六周日提醒，适合周末计划。',
    weekly: '自由选择星期几提醒，适合课程和固定安排。',
    timer: '从现在开始倒计时，适合番茄钟和短任务。',
    interval: '专注 N 分钟后提醒休息 M 分钟，休息结束自动进入下一轮。'
  }[strategy] || '选择一种提醒策略。';
}
function renderForm() {
  const today = dateKey(new Date());
  return `<section class="panel composer" aria-label="新建闹钟">
    <div class="panel-head">
      <div><p class="kicker">CREATE</p><h2>编排你的时间节拍</h2><p class="muted">先选策略，再填写必要参数。无关字段会自动淡出，减少干扰。</p></div>
      <button id="permissionBtn" class="btn ghost" type="button">开启系统通知</button>
    </div>
    <form id="alarmForm" class="alarm-form" data-strategy="daily">
      <label class="field title-field full"><span>提醒名称</span><input name="title" placeholder="例：护眼休息 / 晨会 / 喝水" required /></label>
      <label class="field strategy-field"><span>提醒策略</span><select name="strategy" id="strategy"><option value="once">一次性</option><option value="daily" selected>每日</option><option value="weekdays">工作日</option><option value="weekends">周末</option><option value="weekly">指定星期</option><option value="timer">倒计时</option><option value="interval">循环休息（每 N 分钟休息 M 分钟）</option></select></label>
      <div class="strategy-note"><span>✦</span><p id="strategyHelp">${strategyHelp('daily')}</p></div>
      <label class="field time-field"><span>响铃时间</span><input name="time" type="time" value="08:30" /></label>
      <label class="field date-field"><span>日期</span><input name="date" type="date" value="${today}" /></label>
      <label class="field timer-field"><span>倒计时分钟</span><input name="timerMinutes" type="number" min="1" value="5" /></label>
      <label class="field interval-field"><span>专注分钟</span><input name="intervalMinutes" type="number" min="1" value="60" /></label>
      <label class="field interval-field"><span>休息分钟</span><input name="restMinutes" type="number" min="1" value="10" /></label>
      <div class="quick-presets interval-field full" aria-label="循环休息快捷模板">
        <button type="button" class="chip" data-preset="25,5">番茄 25/5</button>
        <button type="button" class="chip" data-preset="50,10">深工 50/10</button>
        <button type="button" class="chip" data-preset="60,10">护眼 60/10</button>
        <button type="button" class="chip" data-preset="90,15">长专注 90/15</button>
      </div>
      <div class="weekday-field full"><span class="field-label">选择星期</span><div class="weekday-grid">${WEEKDAY_LABELS.map((w,i)=>`<label><input type="checkbox" name="weekday" value="${i}" ${i===1?'checked':''}/> <span>${w}</span></label>`).join('')}</div></div>
      <label class="field"><span>铃声</span><select name="sound"><option value="classic">经典钟声</option><option value="gentle">轻柔提示</option><option value="urgent">强提醒</option></select></label>
      <label class="field"><span>音量</span><input name="volume" type="range" min="5" max="100" value="70" /></label>
      <label class="field"><span>贪睡分钟</span><input name="snoozeMinutes" type="number" min="1" max="60" value="5" /></label>
      <label class="field"><span>最多贪睡</span><input name="maxSnoozes" type="number" min="0" max="10" value="3" /></label>
      <label class="field full"><span>备注</span><textarea name="note" placeholder="写点上下文：该准备什么？为什么提醒？"></textarea></label>
      <div class="form-actions full"><button class="btn primary" type="submit">添加闹钟</button><button class="btn secondary" type="button" data-action="fillInterval">快速设置 60/10 休息循环</button></div>
    </form></section>`;
}
function alarmSummary(a) {
  if (a.strategy === 'timer') return `${a.timerMinutes} 分钟倒计时`;
  if (a.strategy === 'interval') return intervalPhaseLabel(a);
  return a.time;
}
function renderList() {
  const list = $('#alarmList'); if (!list) return;
  const enabled = state.alarms.filter(a=>a.enabled).length;
  const next = state.alarms.filter(a => a.enabled && a.nextDueAt).sort((a,b)=> new Date(a.nextDueAt) - new Date(b.nextDueAt))[0];
  $('#stats').innerHTML = `<span><b>${state.alarms.length}</b> 个闹钟</span><span><b>${enabled}</b> 个启用</span>${next ? `<span>下一次：<b>${escapeHtml(next.title)}</b> · ${nextDueLabel(next.nextDueAt, state.now)}</span>` : ''}`;
  list.innerHTML = state.alarms.length ? state.alarms.map(a => `<article class="alarm ${a.enabled?'':'disabled'} ${a.strategy==='interval'?'interval-card':''}">
    <div class="alarm-glow"></div>
    <div class="alarm-main"><div><div class="badge-row"><span class="badge">${STRATEGY_LABELS[a.strategy]}</span>${a.strategy==='interval'?`<span class="badge warm">${a.intervalPhase==='rest'?'休息中':'专注中'}</span>`:''}</div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(alarmSummary(a))}</p>${a.note?`<small>${escapeHtml(a.note)}</small>`:''}</div>
    <label class="switch" aria-label="启用或停用 ${escapeHtml(a.title)}"><input type="checkbox" data-action="toggle" data-id="${a.id}" ${a.enabled?'checked':''}/><span></span></label></div>
    <div class="due-line"><span>下次提醒</span><strong>${nextDueLabel(a.nextDueAt, state.now)}</strong></div>
    <div class="alarm-actions"><button class="btn mini" data-action="test" data-id="${a.id}">试听</button><button class="btn mini" data-action="snooze" data-id="${a.id}" ${a.snoozeCount>=a.maxSnoozes?'disabled':''}>贪睡 ${a.snoozeCount||0}/${a.maxSnoozes}</button><button class="btn mini danger" data-action="delete" data-id="${a.id}">删除</button></div>
  </article>`).join('') : `<div class="empty"><div class="empty-orbit">◷</div><h3>还没有安排节拍</h3><p>从一个“护眼 60/10”循环开始：每专注 1 小时，休息 10 分钟，然后自动进入下一轮。</p><button class="btn secondary" type="button" data-action="fillInterval">一键填入 60/10</button></div>`;
}
function renderAlert() {
  const box = $('#alertModal'); if (!box) return;
  if (!state.activeAlert) { box.classList.remove('show'); box.innerHTML=''; return; }
  const a = state.activeAlert;
  box.classList.add('show');
  box.innerHTML = `<div class="modal-card"><div class="alarm-icon">${a.strategy === 'interval' && a.intervalPhase !== 'rest' ? '☕' : '⏰'}</div><p class="kicker">TIME IS UP</p><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(alertMessage(a))}</p><div class="modal-actions"><button id="dismissAlert" class="btn primary">知道了</button><button id="snoozeAlert" class="btn secondary">贪睡 ${a.snoozeMinutes} 分钟</button></div></div>`;
}
function renderToast() {
  const el = $('#toast'); if (!el) return;
  el.textContent = state.toast;
  el.classList.toggle('show', Boolean(state.toast));
}
function escapeHtml(s='') { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function setStrategy(value) {
  const form = $('#alarmForm'); if (!form) return;
  form.dataset.strategy = value;
  const help = $('#strategyHelp'); if (help) help.textContent = strategyHelp(value);
}
function fillIntervalPreset(work = 60, rest = 10) {
  const form = $('#alarmForm'); if (!form) return;
  form.strategy.value = 'interval';
  form.intervalMinutes.value = work;
  form.restMinutes.value = rest;
  if (!form.title.value.trim()) form.title.value = '护眼休息';
  setStrategy('interval');
  toast(`已填入 ${work}/${rest} 循环休息`);
}
function bindEvents() {
  document.addEventListener('submit', e => { if (e.target.id === 'alarmForm') { e.preventDefault(); requestNotificationPermission(); addAlarm(new FormData(e.target)); e.target.reset(); e.target.strategy.value='daily'; setStrategy('daily'); }});
  document.addEventListener('click', e => {
    const id = e.target.dataset.id, action = e.target.dataset.action;
    if (e.target.id === 'permissionBtn') requestNotificationPermission();
    if (e.target.dataset.preset) { const [work, rest] = e.target.dataset.preset.split(',').map(Number); fillIntervalPreset(work, rest); }
    if (action === 'fillInterval') fillIntervalPreset(60, 10);
    if (e.target.id === 'dismissAlert') { state.activeAlert=null; renderAlert(); }
    if (e.target.id === 'snoozeAlert' && state.activeAlert) { updateAlarm(state.activeAlert.id, snoozeAlarm(state.activeAlert, new Date())); state.activeAlert=null; renderAlert(); }
    if (!id) return; const alarm = state.alarms.find(a=>a.id===id); if (!alarm) return;
    if (action === 'delete' && confirm('确认删除这个闹钟？')) removeAlarm(id);
    if (action === 'test') notify(alarm);
    if (action === 'snooze') { updateAlarm(id, snoozeAlarm(alarm, new Date())); toast('已推迟提醒'); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'strategy') setStrategy(e.target.value);
    if (e.target.dataset.action === 'toggle') { updateAlarm(e.target.dataset.id, { enabled: e.target.checked }); toast(e.target.checked ? '已启用' : '已暂停'); }
  });
}
function render() {
  $('#app').innerHTML = `<main>
    <nav class="topbar"><div class="brand"><span class="brand-mark">◷</span><span>TimePilot</span></div><div class="nav-copy">把时间变成可感知的节拍</div></nav>
    <section class="hero">
      <div class="clock-card"><p class="kicker">NOW</p><h1 id="clock">--:--:--</h1><p id="date"></p><div id="stats" class="stats"></div></div>
      <div class="hero-copy"><p class="kicker">ALARM STUDIO</p><h2>不只是闹钟，<br/>是你的专注节奏控制台。</h2><p>为起床、会议、番茄钟和“每小时休息 10 分钟”这样的循环策略设计。浏览器本地保存，打开就能用。</p><div class="hero-chips"><span>循环休息</span><span>本地持久化</span><span>声音 + 弹窗</span></div></div>
    </section>
    <div class="workspace">${renderForm()}<section class="panel list-panel"><div class="panel-head compact"><div><p class="kicker">SCHEDULE</p><h2>闹钟列表</h2></div><span class="muted">数据保存在当前浏览器</span></div><div id="alarmList" class="alarm-list"></div></section></div>
    <div id="alertModal" class="modal"></div><div id="toast" class="toast" role="status"></div>
  </main>`;
  renderClock(); renderList(); renderAlert(); renderToast(); setStrategy('daily');
}
load(); render(); bindEvents(); setInterval(checkDue, 1000); checkDue();
