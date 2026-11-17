import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

/** Drop nullable admin foreign keys so auth.users can be removed. */
async function detachUser(userId: string) {
  const sb = getAdminClient();
  await Promise.all([
    sb.from('post_reports').update({ reviewed_by: null }).eq('reviewed_by', userId),
    sb.from('community_posts').update({ removed_by: null }).eq('removed_by', userId),
    sb.from('announcements').update({ created_by: null }).eq('created_by', userId),
    sb.from('community_change_requests').update({ decided_by: null }).eq('decided_by', userId),
  ]);
}

/** FR-1.6 — permanently remove the auth user so the email can sign up again. */
router.delete('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const sb = getAdminClient();

  try {
    await detachUser(userId);
    const { error } = await sb.auth.admin.deleteUser(userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    console.warn('[account] delete failed', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Could not delete account' });
  }
});

export default router;
