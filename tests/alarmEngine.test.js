import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlarm, computeNextDue, shouldFire, fireAlarm, snoozeAlarm } from '../src/alarmEngine.js';

test('daily alarm computes next same day when future', () => {
  const alarm = createAlarm({ strategy: 'daily', time: '09:30' });
  const next = new Date(computeNextDue(alarm, new Date('2026-05-14T09:00:00')));
  assert.equal(next.getHours(), 9); assert.equal(next.getMinutes(), 30); assert.equal(next.getDate(), 14);
});

test('weekdays skips weekend', () => {
  const alarm = createAlarm({ strategy: 'weekdays', time: '08:00' });
  const next = new Date(computeNextDue(alarm, new Date('2026-05-16T09:00:00'))); // Saturday
  assert.equal(next.getDay(), 1);
});

test('once alarm in past returns null', () => {
  const alarm = createAlarm({ strategy: 'once', date: '2026-05-13', time: '08:00' });
  assert.equal(computeNextDue(alarm, new Date('2026-05-14T09:00:00')), null);
});

test('timer uses minutes from now', () => {
  const alarm = createAlarm({ strategy: 'timer', timerMinutes: 10 });
  const next = new Date(computeNextDue(alarm, new Date('2026-05-14T09:00:00Z')));
  assert.equal(next.toISOString(), '2026-05-14T09:10:00.000Z');
});

test('fire disables once alarm and snooze schedules future', () => {
  const base = new Date('2026-05-14T09:00:00Z');
  let alarm = createAlarm({ strategy: 'once', date: '2026-05-14', time: '09:00', snoozeMinutes: 3 });
  alarm.nextDueAt = base.toISOString();
  assert.equal(shouldFire(alarm, base), true);
  const fired = fireAlarm(alarm, base);
  assert.equal(fired.enabled, false);
  const snoozed = snoozeAlarm(alarm, base);
  assert.equal(snoozed.nextDueAt, '2026-05-14T09:03:00.000Z');
});
