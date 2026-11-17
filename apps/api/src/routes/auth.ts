import { Router } from 'express';
import type { User } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

async function findUserByEmail(email: string): Promise<User | null> {
  const sb = getAdminClient();
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users || [];
    const hit = users.find((u) => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

function wasDeletedInApp(user: User, deletedAt: string | null | undefined) {
  if (deletedAt) return true;
  const flag = user.user_metadata?.deleted;
  if (flag === true || flag === 'true') return true;
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) return true;
  return false;
}

/**
 * Earlier deletes only banned the auth user, so the same email stayed "already registered".
 * If that ban (or a deleted profile) is the only thing left, remove it so sign-up can start over.
 */
router.post('/prepare-signup', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.json({ ok: true });

    const sb = getAdminClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('deleted_at')
      .eq('id', user.id)
      .maybeSingle();

    if (!wasDeletedInApp(user, profile?.deleted_at)) {
      return res.json({ ok: true });
    }

    await Promise.all([
      sb.from('post_reports').update({ reviewed_by: null }).eq('reviewed_by', user.id),
      sb.from('community_posts').update({ removed_by: null }).eq('removed_by', user.id),
      sb.from('announcements').update({ created_by: null }).eq('created_by', user.id),
      sb.from('community_change_requests').update({ decided_by: null }).eq('decided_by', user.id),
    ]);
    const { error } = await sb.auth.admin.deleteUser(user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, reclaimed: true });
  } catch (e: any) {
    console.warn('[auth] prepare-signup', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Could not prepare sign up' });
  }
});

router.post('/sync-profile', requireAuth, async (req, res) => {
  const sb = getAdminClient();
  const userId = req.user!.id;
  const email = req.user!.email;

  const { data: existing } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (existing) {
    return res.json({ profile: existing });
  }

  const { data, error } = await sb
    .from('profiles')
    .insert({ id: userId, email })
    .select('*')
    .single();

  if (error) {
    // Race: profile created by trigger
    const { data: again } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (again) return res.json({ profile: again });
    return res.status(500).json({ error: error.message });
  }

  await sb.from('notification_prefs').upsert({ user_id: userId });

  return res.status(201).json({ profile: data });
});

export default router;
