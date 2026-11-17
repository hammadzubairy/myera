import { Router } from 'express';
import { requireAuth, requireActiveMember } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

async function memberCommunitySlug(userId: string): Promise<'women' | 'men' | null> {
  const sb = getAdminClient();
  const { data } = await sb
    .from('profiles')
    .select('community_id, communities(slug)')
    .eq('id', userId)
    .maybeSingle();
  const slug = (data as any)?.communities?.slug;
  return slug === 'women' || slug === 'men' ? slug : null;
}

function audienceMatch(audience: string, slug: string | null) {
  if (audience === 'all') return true;
  return slug != null && audience === slug;
}

router.get('/', requireAuth, requireActiveMember, async (req, res) => {
  const slug = await memberCommunitySlug(req.user!.id);
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('announcements')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });

  const visible = (data || []).filter((a: any) => audienceMatch(a.audience, slug));
  const ids = visible.map((a: any) => a.id);
  let readSet = new Set<string>();
  if (ids.length) {
    const { data: reads } = await sb
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', req.user!.id)
      .in('announcement_id', ids);
    readSet = new Set((reads || []).map((r: any) => r.announcement_id));
  }

  return res.json({
    announcements: visible.map((a: any) => ({ ...a, read: readSet.has(a.id) })),
  });
});

router.get('/unread-count', requireAuth, requireActiveMember, async (req, res) => {
  const slug = await memberCommunitySlug(req.user!.id);
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('announcements')
    .select('id, audience')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(80);
  if (error) return res.status(500).json({ error: error.message });
  const visible = (data || []).filter((a: any) => audienceMatch(a.audience, slug));
  if (!visible.length) return res.json({ count: 0 });

  const ids = visible.map((a: any) => a.id);
  const { data: reads } = await sb
    .from('announcement_reads')
    .select('announcement_id')
    .eq('user_id', req.user!.id)
    .in('announcement_id', ids);
  const readSet = new Set((reads || []).map((r: any) => r.announcement_id));
  return res.json({ count: visible.filter((a: any) => !readSet.has(a.id)).length });
});

router.get('/pinned', requireAuth, requireActiveMember, async (req, res) => {
  const slug = await memberCommunitySlug(req.user!.id);
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('announcements')
    .select('*')
    .eq('pin_to_feed', true)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(10);
  if (error) return res.status(500).json({ error: error.message });
  const pinned = (data || []).find((a: any) => audienceMatch(a.audience, slug)) || null;
  return res.json({ announcement: pinned });
});

router.post('/:id/read', requireAuth, requireActiveMember, async (req, res) => {
  const { error } = await getAdminClient().from('announcement_reads').upsert({
    user_id: req.user!.id,
    announcement_id: req.params.id,
    read_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default router;
