import { Router } from 'express';
import { notificationPrefsSchema, pushTokenSchema } from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

router.post('/token', requireAuth, async (req, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('push_tokens')
    .upsert(
      {
        user_id: req.user!.id,
        token: parsed.data.token,
        platform: parsed.data.platform ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    )
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ token: data });
});

router.get('/prefs', requireAuth, async (req, res) => {
  const sb = getAdminClient();
  let { data, error } = await sb
    .from('notification_prefs')
    .select('*')
    .eq('user_id', req.user!.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) {
    const inserted = await sb
      .from('notification_prefs')
      .insert({ user_id: req.user!.id })
      .select('*')
      .single();
    if (inserted.error) return res.status(500).json({ error: inserted.error.message });
    data = inserted.data;
  }
  return res.json({ prefs: data });
});

router.patch('/prefs', requireAuth, async (req, res) => {
  const parsed = notificationPrefsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('notification_prefs')
    .upsert({ user_id: req.user!.id, ...parsed.data })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ prefs: data });
});

export default router;
