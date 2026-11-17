import { Router } from 'express';
import { createProgressPhotoSchema, updateProgressPhotoSchema } from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await getAdminClient()
    .from('progress_photos')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('taken_on', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ photos: data || [] });
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createProgressPhotoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('progress_photos')
    .insert({
      user_id: req.user!.id,
      taken_on: parsed.data.taken_on,
      url: parsed.data.url,
      public_id: parsed.data.public_id ?? null,
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ photo: data });
});

router.patch('/:id', requireAuth, async (req, res) => {
  const parsed = updateProgressPhotoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await getAdminClient()
    .from('progress_photos')
    .update({
      url: parsed.data.url,
      public_id: parsed.data.public_id ?? null,
    })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ photo: data });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await getAdminClient()
    .from('progress_photos')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
