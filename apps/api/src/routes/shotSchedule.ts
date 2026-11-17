import { Router } from 'express';
import { snoozeShotSchema, upsertShotScheduleSchema } from '@myera/shared';
import { requireAuth, requireActiveMember } from '../middleware/auth';
import { getAdminClient } from '../supabase';
import { computeNextFireAt } from '../lib/shotSchedule';

const router = Router();

router.get('/', requireAuth, requireActiveMember, async (req, res) => {
  const { data, error } = await getAdminClient()
    .from('shot_schedules')
    .select('*')
    .eq('user_id', req.user!.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ schedule: data });
});

router.put('/', requireAuth, requireActiveMember, async (req, res) => {
  const parsed = upsertShotScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const body = parsed.data;
  if (body.frequency !== 'daily' && (body.shot_day == null || body.shot_day < 0)) {
    return res.status(400).json({ error: 'shot_day required for weekly schedules' });
  }

  const scheduleLike = {
    frequency: body.frequency,
    shot_day: body.frequency === 'daily' ? null : (body.shot_day ?? 6),
    shot_time: body.shot_time.length === 5 ? `${body.shot_time}:00` : body.shot_time,
    day_before_enabled: body.day_before_enabled,
    day_before_time: body.day_before_time
      ? body.day_before_time.length === 5
        ? `${body.day_before_time}:00`
        : body.day_before_time
      : null,
    second_reminder_enabled: body.second_reminder_enabled,
    hide_on_lockscreen: body.hide_on_lockscreen,
    snooze_until: null as string | null,
    last_dose_logged_on: null as string | null,
    last_fired_at: null as string | null,
    enabled: body.enabled,
  };

  const next_fire_at = computeNextFireAt(scheduleLike);

  const row = {
    user_id: req.user!.id,
    frequency: scheduleLike.frequency,
    shot_day: scheduleLike.shot_day,
    shot_time: scheduleLike.shot_time,
    day_before_enabled: scheduleLike.day_before_enabled,
    day_before_time: scheduleLike.day_before_time,
    second_reminder_enabled: scheduleLike.second_reminder_enabled,
    hide_on_lockscreen: scheduleLike.hide_on_lockscreen,
    timezone: body.timezone || 'UTC',
    enabled: body.enabled,
    next_fire_at,
    snooze_until: null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getAdminClient()
    .from('shot_schedules')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ schedule: data });
});

router.post('/snooze', requireAuth, requireActiveMember, async (req, res) => {
  const parsed = snoozeShotSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sb = getAdminClient();
  const { data: existing, error: fetchErr } = await sb
    .from('shot_schedules')
    .select('*')
    .eq('user_id', req.user!.id)
    .maybeSingle();
  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!existing) return res.status(404).json({ error: 'No shot schedule' });

  const until = new Date(Date.now() + parsed.data.hours * 60 * 60 * 1000);
  const next = computeNextFireAt({
    ...existing,
    snooze_until: until.toISOString(),
  });

  const { data, error } = await sb
    .from('shot_schedules')
    .update({
      snooze_until: until.toISOString(),
      next_fire_at: next,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', req.user!.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ schedule: data });
});

export default router;
