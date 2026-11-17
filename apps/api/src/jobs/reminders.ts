import { getAdminClient } from '../supabase';
import { sendExpoPush, userIdsForAudience } from '../lib/pushSend';
import {
  computeNextFireAt,
  dayBeforeAt,
  isoDateUTC,
  nextShotAt,
  secondReminderAt,
  type ScheduleLike,
} from '../lib/shotSchedule';

let running = false;

/** One-shot tick for Vercel Cron (and local scheduler). */
export async function runReminderTick() {
  if (running) return;
  running = true;
  try {
    // Injection-day reminders are scheduled on-device (see mobile injectionReminders.ts);
    // the legacy server-side shot push is retired to avoid duplicates.
    await processDueAnnouncements();
  } finally {
    running = false;
  }
}

export function startReminderScheduler(intervalMs = 60_000) {
  const tick = async () => {
    try {
      await runReminderTick();
    } catch (e) {
      console.warn('[scheduler]', e);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

async function processShotReminders() {
  const sb = getAdminClient();
  const now = new Date();
  const { data: due } = await sb
    .from('shot_schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_fire_at', now.toISOString())
    .limit(50);

  for (const row of due || []) {
    const schedule = row as ScheduleLike & { user_id: string; hide_on_lockscreen: boolean };
    const shot = nextShotAt(schedule, now);
    const before = dayBeforeAt(schedule, shot);
    const fireAt = new Date(row.next_fire_at);

    // Decide kind of fire
    let kind: 'day_before' | 'shot' | 'second' = 'shot';
    if (before && Math.abs(fireAt.getTime() - before.getTime()) < 2 * 60 * 1000) {
      kind = 'day_before';
    } else if (
      schedule.second_reminder_enabled &&
      schedule.last_fired_at &&
      Math.abs(fireAt.getTime() - secondReminderAt(new Date(schedule.last_fired_at)).getTime()) <
        2 * 60 * 1000
    ) {
      kind = 'second';
    }

    // Skip if already logged dose for this shot day
    const shotDate = isoDateUTC(shot);
    if (kind !== 'day_before' && schedule.last_dose_logged_on === shotDate) {
      await sb
        .from('shot_schedules')
        .update({
          next_fire_at: computeNextFireAt(
            { ...schedule, last_fired_at: now.toISOString(), snooze_until: null },
            now
          ),
          snooze_until: null,
          updated_at: now.toISOString(),
        })
        .eq('user_id', schedule.user_id);
      continue;
    }

    // FR-9.7 / FR-10.3 — general copy when hide_on_lockscreen
    let title = 'Shot reminder';
    let body = 'Time for your shot. Open My Era to log your dose.';
    if (kind === 'day_before') {
      title = 'Shot tomorrow';
      body = 'Your next shot is tomorrow. Open My Era when you are ready.';
    } else if (kind === 'second') {
      title = 'Shot reminder';
      body = 'Still need to log your dose? Open My Era when you are ready.';
    } else if (!schedule.hide_on_lockscreen) {
      // Keep generic even when hide is off — never put weight/photos; dose detail optional via regimen
      const { data: regimens } = await sb
        .from('dose_regimens')
        .select('medication_name, amount_mg')
        .eq('user_id', schedule.user_id)
        .or('end_date.is.null,end_date.gte.9000-01-01')
        .order('start_date', { ascending: false });
      if (regimens?.length === 1) {
        const r = regimens[0];
        body = `Time for your ${Number(r.amount_mg)} mg ${r.medication_name}.`;
      } else if (regimens && regimens.length > 1) {
        const list = regimens
          .map((r) => `${Number(r.amount_mg)} mg ${r.medication_name}`)
          .join(', ');
        body = `Time for your shots: ${list}.`;
      }
    }

    await sendExpoPush(
      [schedule.user_id],
      {
        title,
        body,
        data: { type: 'shot_reminder', action: 'log_dose' },
      },
      'shot_reminders'
    );

    const updated: ScheduleLike = {
      ...schedule,
      last_fired_at: kind === 'day_before' ? schedule.last_fired_at : now.toISOString(),
      snooze_until: null,
    };
    // After primary fire, if second reminder enabled and no dose, next is +3h
    let next: string | null;
    if (kind === 'shot' && schedule.second_reminder_enabled) {
      next = secondReminderAt(now).toISOString();
    } else {
      next = computeNextFireAt(updated, new Date(now.getTime() + 60_000));
    }

    await sb
      .from('shot_schedules')
      .update({
        last_fired_at: updated.last_fired_at,
        next_fire_at: next,
        snooze_until: null,
        updated_at: now.toISOString(),
      })
      .eq('user_id', schedule.user_id);
  }
}

async function processDueAnnouncements() {
  const sb = getAdminClient();
  const now = new Date().toISOString();
  const { data: due } = await sb
    .from('announcements')
    .select('*')
    .is('published_at', null)
    .lte('publish_at', now)
    .limit(20);

  for (const ann of due || []) {
    await publishAnnouncement(ann.id);
  }
}

export async function publishAnnouncement(id: string): Promise<{ push_sent: number }> {
  const sb = getAdminClient();
  const { data: ann, error } = await sb.from('announcements').select('*').eq('id', id).single();
  if (error || !ann) throw new Error(error?.message || 'Announcement not found');

  const published_at = ann.published_at || new Date().toISOString();
  if (!ann.published_at) {
    await sb
      .from('announcements')
      .update({ published_at, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  let push_sent = 0;
  if (ann.send_push) {
    const ids = await userIdsForAudience(ann.audience);
    // FR-10.3: title/body only — no private tracking data
    push_sent = await sendExpoPush(
      ids,
      {
        title: ann.title,
        body: ann.body.slice(0, 180),
        data: { type: 'announcement', id: ann.id },
      },
      'announcements'
    );
    await sb
      .from('announcements')
      .update({ push_sent_count: (ann.push_sent_count || 0) + push_sent })
      .eq('id', id);
  }
  return { push_sent };
}
