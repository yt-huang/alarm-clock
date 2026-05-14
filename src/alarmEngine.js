export const WEEKDAY_LABELS = ['周日','周一','周二','周三','周四','周五','周六'];
export const STRATEGY_LABELS = {
  once: '一次性',
  daily: '每日',
  weekdays: '工作日',
  weekends: '周末',
  weekly: '指定星期',
  timer: '倒计时',
  interval: '循环休息'
};
export function uid(prefix='a') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
export function pad(n) { return String(n).padStart(2, '0'); }
export function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
export function timeText(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
export function dateText(d) { return `${d.getFullYear()}年${pad(d.getMonth()+1)}月${pad(d.getDate())}日 ${WEEKDAY_LABELS[d.getDay()]}`; }
export function createAlarm(input) {
  const now = new Date();
  return {
    id: uid('alarm'), title: input.title?.trim() || '未命名闹钟', note: input.note?.trim() || '',
    strategy: input.strategy || 'daily', time: input.time || '08:00', date: input.date || dateKey(now),
    weekdays: Array.isArray(input.weekdays) ? input.weekdays.map(Number) : [], timerMinutes: Number(input.timerMinutes || 5),
    intervalMinutes: Number(input.intervalMinutes || 60), restMinutes: Number(input.restMinutes || 10), intervalPhase: input.intervalPhase || 'work',
    enabled: input.enabled !== false, sound: input.sound || 'classic', volume: Number(input.volume ?? 70),
    snoozeMinutes: Number(input.snoozeMinutes || 5), maxSnoozes: Number(input.maxSnoozes || 3), snoozeCount: 0,
    nextDueAt: null, lastFiredAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString()
  };
}
export function parseDateTime(date, hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
export function computeNextDue(alarm, from = new Date()) {
  if (!alarm.enabled) return null;
  if (alarm.strategy === 'timer') {
    const base = alarm.nextDueAt ? new Date(alarm.nextDueAt) : new Date(from.getTime() + Math.max(1, alarm.timerMinutes) * 60000);
    return base > from ? base.toISOString() : from.toISOString();
  }
  if (alarm.strategy === 'interval') {
    const minutes = alarm.intervalPhase === 'rest' ? Math.max(1, alarm.restMinutes || 10) : Math.max(1, alarm.intervalMinutes || 60);
    const base = alarm.nextDueAt ? new Date(alarm.nextDueAt) : new Date(from.getTime() + minutes * 60000);
    return base > from ? base.toISOString() : from.toISOString();
  }
  if (alarm.strategy === 'once') {
    const due = parseDateTime(alarm.date, alarm.time);
    return due >= from ? due.toISOString() : null;
  }
  for (let i=0; i<370; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const dow = d.getDay();
    let ok = alarm.strategy === 'daily';
    if (alarm.strategy === 'weekdays') ok = dow >= 1 && dow <= 5;
    if (alarm.strategy === 'weekends') ok = dow === 0 || dow === 6;
    if (alarm.strategy === 'weekly') ok = (alarm.weekdays || []).includes(dow);
    if (!ok) continue;
    const due = parseDateTime(d, alarm.time);
    if (due >= from) return due.toISOString();
  }
  return null;
}
export function shouldFire(alarm, now = new Date()) {
  if (!alarm.enabled || !alarm.nextDueAt) return false;
  const due = new Date(alarm.nextDueAt);
  if (due > now) return false;
  if (alarm.lastFiredAt && Math.abs(new Date(alarm.lastFiredAt).getTime() - due.getTime()) < 1000) return false;
  return true;
}
export function fireAlarm(alarm, now = new Date()) {
  const fired = { ...alarm, lastFiredAt: now.toISOString(), updatedAt: now.toISOString() };
  if (alarm.strategy === 'once' || alarm.strategy === 'timer') {
    fired.enabled = false; fired.nextDueAt = null;
  } else if (alarm.strategy === 'interval') {
    const wasResting = alarm.intervalPhase === 'rest';
    fired.intervalPhase = wasResting ? 'work' : 'rest';
    const minutes = wasResting ? Math.max(1, alarm.intervalMinutes || 60) : Math.max(1, alarm.restMinutes || 10);
    fired.nextDueAt = new Date(now.getTime() + minutes * 60000).toISOString();
    fired.snoozeCount = 0;
  } else {
    const after = new Date(now.getTime() + 1000);
    fired.nextDueAt = computeNextDue({ ...fired, enabled: true }, after);
  }
  return fired;
}
export function snoozeAlarm(alarm, now = new Date()) {
  const count = (alarm.snoozeCount || 0) + 1;
  if (count > Number(alarm.maxSnoozes || 0)) return alarm;
  return { ...alarm, enabled: true, snoozeCount: count, nextDueAt: new Date(now.getTime() + Math.max(1, alarm.snoozeMinutes) * 60000).toISOString(), updatedAt: now.toISOString() };
}
export function nextDueLabel(iso, now = new Date()) {
  if (!iso) return '无待触发时间';
  const due = new Date(iso); const diff = due - now;
  const abs = Math.max(0, diff);
  const min = Math.floor(abs / 60000); const sec = Math.floor((abs % 60000)/1000);
  if (min < 60) return `${pad(min)}:${pad(sec)} 后`;
  return `${due.getMonth()+1}/${due.getDate()} ${pad(due.getHours())}:${pad(due.getMinutes())}`;
}
export function intervalPhaseLabel(alarm) {
  if (alarm.strategy !== 'interval') return '';
  return alarm.intervalPhase === 'rest'
    ? `休息中，${alarm.restMinutes || 10} 分钟后提醒回到专注`
    : `专注中，每 ${alarm.intervalMinutes || 60} 分钟休息 ${alarm.restMinutes || 10} 分钟`;
}
export function alertMessage(alarm) {
  if (alarm.strategy !== 'interval') return alarm.note || '闹钟时间到';
  if (alarm.intervalPhase === 'rest') return alarm.note || '休息结束，回到专注时间';
  return alarm.note || `已经专注 ${alarm.intervalMinutes || 60} 分钟，休息 ${alarm.restMinutes || 10} 分钟吧`;
}
