/** Compute next fire time for shot reminders (UTC-based; timezone stored for display). */

export type ScheduleLike = {
  frequency: 'weekly' | 'every_2_weeks' | 'daily';
  shot_day: number | null; // 0=Sun .. 6=Sat
  shot_time: string; // HH:MM or HH:MM:SS
  day_before_enabled: boolean;
  day_before_time: string | null;
  second_reminder_enabled: boolean;
  snooze_until: string | null;
  last_dose_logged_on: string | null;
  last_fired_at: string | null;
  enabled: boolean;
};

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

function atLocalUtc(base: Date, time: string): Date {
  const { h, m } = parseTime(time);
  const d = new Date(base);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Next shot-day occurrence at shot_time (UTC clock). */
export function nextShotAt(schedule: ScheduleLike, from = new Date()): Date {
  const now = from.getTime();
  if (schedule.snooze_until) {
    const snooze = new Date(schedule.snooze_until);
    if (snooze.getTime() > now) return snooze;
  }

  if (schedule.frequency === 'daily') {
    let candidate = atLocalUtc(from, schedule.shot_time);
    if (candidate.getTime() <= now) candidate = atLocalUtc(addDays(from, 1), schedule.shot_time);
    return candidate;
  }

  const targetDow = schedule.shot_day ?? 6; // default Saturday
  for (let i = 0; i < 21; i++) {
    const day = addDays(from, i);
    if (day.getUTCDay() !== targetDow) continue;
    const candidate = atLocalUtc(day, schedule.shot_time);
    if (candidate.getTime() <= now) continue;
    if (schedule.frequency === 'every_2_weeks' && schedule.last_fired_at) {
      const last = new Date(schedule.last_fired_at).getTime();
      if (candidate.getTime() - last < 10 * 24 * 60 * 60 * 1000) continue;
    }
    return candidate;
  }
  return atLocalUtc(addDays(from, 7), schedule.shot_time);
}

export function dayBeforeAt(schedule: ScheduleLike, shotAt: Date): Date | null {
  if (!schedule.day_before_enabled || !schedule.day_before_time) return null;
  const day = addDays(shotAt, -1);
  return atLocalUtc(day, schedule.day_before_time);
}

export function secondReminderAt(firstFire: Date): Date {
  return new Date(firstFire.getTime() + 3 * 60 * 60 * 1000);
}

export function computeNextFireAt(schedule: ScheduleLike, from = new Date()): string | null {
  if (!schedule.enabled) return null;
  const shot = nextShotAt(schedule, from);
  const before = dayBeforeAt(schedule, shot);
  const candidates = [shot.getTime()];
  if (before && before.getTime() > from.getTime()) candidates.push(before.getTime());
  // second reminder only if we already fired primary today and no dose
  if (
    schedule.second_reminder_enabled &&
    schedule.last_fired_at &&
    !schedule.last_dose_logged_on
  ) {
    const first = new Date(schedule.last_fired_at);
    const second = secondReminderAt(first);
    if (second.getTime() > from.getTime()) candidates.push(second.getTime());
  }
  const next = Math.min(...candidates.filter((t) => t > from.getTime()));
  if (!Number.isFinite(next)) return shot.toISOString();
  return new Date(next).toISOString();
}

export function isoDateUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
