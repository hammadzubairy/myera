import { Router } from 'express';
import {
  ACTIVE_DOSE_OR_FILTER,
  DOSE_OPEN_END,
  changeRegimenSchema,
  createDoseLogSchema,
  createRegimenSchema,
  stopRegimenSchema,
} from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';
import { computeNextFireAt } from '../lib/shotSchedule';

const router = Router();

router.get('/regimens', requireAuth, async (req, res) => {
  const { data, error } = await getAdminClient()
    .from('dose_regimens')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('start_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ regimens: data });
});

type ActiveRegimen = { id: string; medication_name: string; amount_mg: number };

async function getActiveRegimens(userId: string): Promise<ActiveRegimen[]> {
  const { data, error } = await getAdminClient()
    .from('dose_regimens')
    .select('id, medication_name, amount_mg')
    .eq('user_id', userId)
    .or(ACTIVE_DOSE_OR_FILTER)
    .order('start_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ActiveRegimen[];
}

/** Postgres unique violation → friendly 409 instead of raw constraint text. */
function insertError(res: any, error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'That medication is already active.' });
  }
  return res.status(500).json({ error: error.message });
}

const sameMed = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function dayBefore(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

router.post('/regimens', requireAuth, async (req, res) => {
  const parsed = createRegimenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let active: ActiveRegimen[];
  try {
    active = await getActiveRegimens(req.user!.id);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  if (active.some((r) => sameMed(r.medication_name, parsed.data.medication_name))) {
    return res
      .status(409)
      .json({ error: 'That medication is already active. Use Change dose instead.' });
  }

  const { data, error } = await getAdminClient()
    .from('dose_regimens')
    .insert({ user_id: req.user!.id, ...parsed.data, end_date: DOSE_OPEN_END })
    .select('*')
    .single();
  if (error) return insertError(res, error);
  return res.status(201).json({ regimen: data });
});

router.post('/regimens/change', requireAuth, async (req, res) => {
  const parsed = changeRegimenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sb = getAdminClient();
  const { regimen_id, ...fields } = parsed.data;

  let active: ActiveRegimen[];
  try {
    active = await getActiveRegimens(req.user!.id);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  // Which regimen does this change replace?
  let target: ActiveRegimen | undefined;
  if (regimen_id) {
    target = active.find((r) => r.id === regimen_id);
    if (!target) return res.status(404).json({ error: 'Active dose not found.' });
  } else {
    // Older app builds send no id: match by medication, or the only active one.
    target =
      active.find((r) => sameMed(r.medication_name, fields.medication_name)) ||
      (active.length === 1 ? active[0] : undefined);
  }

  // Renaming into another medication that's already active would collide.
  const clash = active.find(
    (r) => r.id !== target?.id && sameMed(r.medication_name, fields.medication_name)
  );
  if (clash) {
    return res.status(409).json({ error: 'That medication is already active.' });
  }

  if (target) {
    const { error: closeErr } = await sb
      .from('dose_regimens')
      .update({ end_date: dayBefore(fields.start_date) })
      .eq('id', target.id)
      .eq('user_id', req.user!.id);
    if (closeErr) return res.status(500).json({ error: closeErr.message });
  }

  const { data, error } = await sb
    .from('dose_regimens')
    .insert({ user_id: req.user!.id, ...fields, end_date: DOSE_OPEN_END })
    .select('*')
    .single();
  if (error) return insertError(res, error);
  return res.status(201).json({ regimen: data });
});

router.post('/regimens/:id/stop', requireAuth, async (req, res) => {
  const parsed = stopRegimenSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const end_date = parsed.data.end_date || new Date().toISOString().slice(0, 10);
  const { data, error } = await getAdminClient()
    .from('dose_regimens')
    .update({ end_date })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .or(ACTIVE_DOSE_OR_FILTER)
    .select('*')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Active dose not found.' });
  return res.json({ regimen: data });
});

router.get('/logs', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { data, error } = await getAdminClient()
    .from('dose_logs')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('logged_on', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ logs: data });
});

router.post('/logs', requireAuth, async (req, res) => {
  const parsed = createDoseLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sb = getAdminClient();
  let regimenId: string | null = null;
  if (parsed.data.regimen_id) {
    // Must belong to this user (any regimen, so past shots can be backfilled).
    const { data: owned } = await sb
      .from('dose_regimens')
      .select('id')
      .eq('id', parsed.data.regimen_id)
      .eq('user_id', req.user!.id)
      .maybeSingle();
    if (!owned) return res.status(404).json({ error: 'Dose not found.' });
    regimenId = owned.id;
  } else {
    try {
      const active = await getActiveRegimens(req.user!.id);
      regimenId = active.length === 1 ? active[0].id : null;
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  const { data, error } = await sb
    .from('dose_logs')
    .insert({
      user_id: req.user!.id,
      logged_on: parsed.data.logged_on,
      amount_mg: parsed.data.amount_mg,
      regimen_id: regimenId,
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Clear second reminder for this shot period
  const { data: schedule } = await sb
    .from('shot_schedules')
    .select('*')
    .eq('user_id', req.user!.id)
    .maybeSingle();
  if (schedule) {
    const next = computeNextFireAt({
      ...schedule,
      last_dose_logged_on: parsed.data.logged_on,
      snooze_until: null,
    });
    await sb
      .from('shot_schedules')
      .update({
        last_dose_logged_on: parsed.data.logged_on,
        snooze_until: null,
        next_fire_at: next,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.user!.id);
  }

  return res.status(201).json({ log: data });
});

export default router;
