import { Router } from 'express';
import {
  adminCommunityDecisionSchema,
  adminMoveMemberSchema,
  adminReportActionSchema,
  adminSuspendSchema,
  createAnnouncementSchema,
} from '@myera/shared';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getAdminClient } from '../supabase';
import { publishAnnouncement } from '../jobs/reminders';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/reports', async (_req, res) => {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('post_reports')
    .select(
      'id, reason, status, created_at, reporter_id, post_id, community_posts(id, body, author_id, community_id, removed_at, communities(slug, name))'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });

  // Aggregate counts per post
  const byPost = new Map<string, any>();
  for (const r of data || []) {
    const postId = r.post_id as string;
    if (!byPost.has(postId)) {
      byPost.set(postId, { ...r, report_count: 1, reasons: [r.reason] });
    } else {
      const cur = byPost.get(postId);
      cur.report_count += 1;
      cur.reasons.push(r.reason);
    }
  }
  return res.json({ reports: Array.from(byPost.values()) });
});

router.post('/reports/:id/action', async (req, res) => {
  const parsed = adminReportActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sb = getAdminClient();
  const { data: report, error: fetchErr } = await sb
    .from('post_reports')
    .select('id, post_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (fetchErr || !report) return res.status(404).json({ error: 'Report not found' });

  const status = parsed.data.action === 'remove' ? 'removed' : 'kept';
  const now = new Date().toISOString();

  await sb
    .from('post_reports')
    .update({ status, reviewed_at: now, reviewed_by: req.user!.id })
    .eq('post_id', report.post_id)
    .eq('status', 'open');

  if (parsed.data.action === 'remove') {
    await sb
      .from('community_posts')
      .update({ removed_at: now, removed_by: req.user!.id })
      .eq('id', report.post_id);
  }

  return res.json({ ok: true, status });
});

router.get('/posts', async (req, res) => {
  const sb = getAdminClient();
  const community = String(req.query.community || '');
  let q = sb
    .from('community_posts')
    .select('id, body, author_id, community_id, created_at, removed_at, communities(slug, name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (community === 'women' || community === 'men') {
    const { data: c } = await sb.from('communities').select('id').eq('slug', community).maybeSingle();
    if (c) q = q.eq('community_id', c.id);
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ posts: data || [] });
});

router.get('/members', async (_req, res) => {
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select(
      'id, full_name, email, gender, community_id, role, suspended_at, deleted_at, created_at, communities(slug, name)'
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ members: data || [] });
});

router.post('/members/:id/suspend', async (req, res) => {
  const parsed = adminSuspendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { error } = await getAdminClient()
    .from('profiles')
    .update({
      suspended_at: parsed.data.suspend ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

router.post('/members/:id/move', async (req, res) => {
  const parsed = adminMoveMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const sb = getAdminClient();
  const { data: c } = await sb
    .from('communities')
    .select('id')
    .eq('slug', parsed.data.community_slug)
    .maybeSingle();
  if (!c) return res.status(400).json({ error: 'Unknown community' });
  const { error } = await sb
    .from('profiles')
    .update({ community_id: c.id, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

router.get('/community-changes', async (_req, res) => {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('community_change_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const rows = data || [];
  const userIds = [...new Set(rows.map((r: any) => r.user_id))];
  const communityIds = [
    ...new Set(
      rows.flatMap((r: any) => [r.from_community_id, r.to_community_id].filter(Boolean))
    ),
  ];
  const [{ data: profiles }, { data: communities }] = await Promise.all([
    userIds.length
      ? sb.from('profiles').select('id, full_name, email').in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    communityIds.length
      ? sb.from('communities').select('id, slug, name').in('id', communityIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const cMap = new Map((communities || []).map((c: any) => [c.id, c]));
  return res.json({
    requests: rows.map((r: any) => ({
      ...r,
      profile: pMap.get(r.user_id) || null,
      from_community: cMap.get(r.from_community_id) || null,
      to_community: cMap.get(r.to_community_id) || null,
    })),
  });
});

router.post('/community-changes/:id', async (req, res) => {
  const parsed = adminCommunityDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const sb = getAdminClient();
  const { data: reqRow, error: fetchErr } = await sb
    .from('community_change_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (fetchErr || !reqRow) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  await sb
    .from('community_change_requests')
    .update({
      status: parsed.data.decision,
      decided_at: now,
      decided_by: req.user!.id,
    })
    .eq('id', req.params.id);

  if (parsed.data.decision === 'approved') {
    await sb
      .from('profiles')
      .update({ community_id: reqRow.to_community_id, updated_at: now })
      .eq('id', reqRow.user_id);
  }
  return res.json({ ok: true });
});

router.get('/announcements', async (_req, res) => {
  const { data, error } = await getAdminClient()
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ announcements: data || [] });
});

router.post('/announcements', async (req, res) => {
  const parsed = createAnnouncementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const sb = getAdminClient();

  const row = {
    title: b.title,
    body: b.body,
    audience: b.audience,
    send_push: b.send_push,
    pin_to_feed: b.pin_to_feed,
    publish_at: b.publish_now === false ? b.publish_at || null : null,
    published_at: null as string | null,
    created_by: req.user!.id,
  };

  const { data, error } = await sb.from('announcements').insert(row).select('*').single();
  if (error) return res.status(500).json({ error: error.message });

  let push_sent = 0;
  if (b.publish_now !== false && !b.publish_at) {
    const result = await publishAnnouncement(data.id);
    push_sent = result.push_sent;
    const { data: refreshed } = await sb.from('announcements').select('*').eq('id', data.id).single();
    return res.status(201).json({ announcement: refreshed, push_sent });
  }

  return res.status(201).json({ announcement: data, push_sent });
});

router.post('/announcements/:id/publish', async (req, res) => {
  try {
    const result = await publishAnnouncement(req.params.id);
    const { data } = await getAdminClient()
      .from('announcements')
      .select('*')
      .eq('id', req.params.id)
      .single();
    return res.json({ announcement: data, ...result });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
});

export default router;
