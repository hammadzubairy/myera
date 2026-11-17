import { Router } from 'express';
import { injectionScheduleSchema } from '@myera/shared';
import { requireAuth, requireActiveMember } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();
router.use(requireAuth, requireActiveMember);

function toRow(body: ReturnType<typeof injectionScheduleSchema.parse>) {
  return {
    product_name: body.product_name,
    weekdays: [...new Set(body.weekdays)].sort(),
    time_of_day: body.time_of_day ? `${body.time_of_day}:00` : null,
    enabled: body.enabled,
    updated_at: new Date().toISOString(),
  };
}

router.get('/', async (req, res) => {
  const { data, error } = await getAdminClient()
    .from('injection_schedules')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ schedules: data ?? [] });
});

router.post('/', async (req, res) => {
  const parsed = injectionScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { data, error } = await getAdminClient()
    .from('injection_schedules')
    .insert({ user_id: req.user!.id, ...toRow(parsed.data) })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ schedule: data });
});

router.put('/:id', async (req, res) => {
  const parsed = injectionScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { data, error } = await getAdminClient()
    .from('injection_schedules')
    .update(toRow(parsed.data))
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select('*')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Schedule not found' });
  return res.json({ schedule: data });
});

router.delete('/:id', async (req, res) => {
  const { error } = await getAdminClient()
    .from('injection_schedules')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
