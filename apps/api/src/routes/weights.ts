import { Router } from 'express';
import { chartRangeSchema, createWeightLogSchema, type ChartRange } from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

function rangeStart(range: ChartRange): string | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setMonth(d.getMonth() - (range === '1m' ? 1 : 2));
  return d.toISOString().slice(0, 10);
}

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await getAdminClient()
    .from('weight_logs')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('logged_on', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ logs: data });
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createWeightLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sb = getAdminClient();
  const { data, error } = await sb
    .from('weight_logs')
    .upsert(
      {
        user_id: req.user!.id,
        logged_on: parsed.data.logged_on,
        weight_lb: parsed.data.weight_lb,
      },
      { onConflict: 'user_id,logged_on' }
    )
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await sb
    .from('profiles')
    .update({
      current_weight_lb: parsed.data.weight_lb,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.user!.id);

  return res.status(201).json({ log: data });
});

router.get('/chart', requireAuth, async (req, res) => {
  const rangeParse = chartRangeSchema.safeParse(req.query.range || '2m');
  if (!rangeParse.success) return res.status(400).json({ error: 'Invalid range' });
  const range = rangeParse.data;
  const start = rangeStart(range);
  const sb = getAdminClient();

  let q = sb
    .from('weight_logs')
    .select('logged_on, weight_lb')
    .eq('user_id', req.user!.id)
    .order('logged_on', { ascending: true });
  if (start) q = q.gte('logged_on', start);

  const { data: points, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  let regimenQ = sb
    .from('dose_regimens')
    .select('start_date, amount_mg, medication_name')
    .eq('user_id', req.user!.id)
    .order('start_date', { ascending: true });
  if (start) regimenQ = regimenQ.gte('start_date', start);
  const { data: regimens } = await regimenQ;

  const dose_changes = (regimens || []).map((r) => ({
    date: r.start_date,
    amount_mg: Number(r.amount_mg),
    medication_name: r.medication_name,
  }));

  const latest = points?.length ? points[points.length - 1].weight_lb : null;
  const first = points?.length ? points[0].weight_lb : null;
  const delta_lb =
    latest != null && first != null ? Math.round((latest - first) * 10) / 10 : null;

  return res.json({
    points: points || [],
    dose_changes,
    latest_weight_lb: latest,
    delta_lb,
    range,
  });
});

export default router;
