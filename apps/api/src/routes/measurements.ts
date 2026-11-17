import { Router } from 'express';
import { createMeasurementLogSchema, createMeasurementTypeSchema } from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

router.get('/types', requireAuth, async (req, res) => {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('measurement_types')
    .select('*')
    .or(`is_system.eq.true,user_id.eq.${req.user!.id}`)
    .order('is_system', { ascending: false })
    .order('label');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ types: data });
});

router.post('/types', requireAuth, async (req, res) => {
  const parsed = createMeasurementTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const label = parsed.data.label.trim();
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const { data, error } = await getAdminClient()
    .from('measurement_types')
    .insert({
      user_id: req.user!.id,
      key: `${key}_${Date.now().toString(36)}`,
      label,
      is_system: false,
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ type: data });
});

router.get('/summary', requireAuth, async (req, res) => {
  const sb = getAdminClient();
  const { data: types, error: tErr } = await sb
    .from('measurement_types')
    .select('*')
    .or(`is_system.eq.true,user_id.eq.${req.user!.id}`);
  if (tErr) return res.status(500).json({ error: tErr.message });

  const { data: logs, error: lErr } = await sb
    .from('measurement_logs')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('logged_on', { ascending: true });
  if (lErr) return res.status(500).json({ error: lErr.message });

  const byType = new Map<string, typeof logs>();
  for (const log of logs || []) {
    const arr = byType.get(log.type_id) || [];
    arr.push(log);
    byType.set(log.type_id, arr);
  }

  const summary = (types || [])
    .map((type) => {
      const series = byType.get(type.id) || [];
      if (!series.length && !type.is_system) {
        // still show custom types with no logs
      }
      const first = series[0];
      const latest = series[series.length - 1];
      const change_in =
        first && latest
          ? Math.round((Number(latest.value_in) - Number(first.value_in)) * 10) / 10
          : null;
      return {
        type,
        latest_value_in: latest ? Number(latest.value_in) : null,
        latest_logged_on: latest?.logged_on ?? null,
        first_value_in: first ? Number(first.value_in) : null,
        change_in,
      };
    })
    .filter((s) => s.type.is_system || s.latest_value_in != null || true);

  // Prefer showing system types always + customs that exist
  const filtered = summary.filter(
    (s) => s.type.is_system || s.latest_value_in != null || s.type.user_id === req.user!.id
  );

  return res.json({ measurements: filtered });
});

router.post('/logs', requireAuth, async (req, res) => {
  const parsed = createMeasurementLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('measurement_logs')
    .insert({
      user_id: req.user!.id,
      type_id: parsed.data.type_id,
      value_in: parsed.data.value_in,
      logged_on: parsed.data.logged_on,
    })
    .select('*, type:measurement_types(*)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ log: data });
});

export default router;
