import { Router } from 'express';
import {
  createCommentSchema,
  createPostSchema,
  hideMemberSchema,
  reportPostSchema,
} from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

async function getMemberContext(userId: string) {
  const sb = getAdminClient();
  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, full_name, photo_url, community_id, start_weight_lb, current_weight_lb, community:communities(*)')
    .eq('id', userId)
    .single();
  if (error || !profile?.community_id) {
    throw new Error('Community not assigned. Finish profile setup.');
  }
  return profile;
}

async function assertPostInCommunity(postId: string, communityId: string) {
  const { data: post, error } = await getAdminClient()
    .from('community_posts')
    .select('*')
    .eq('id', postId)
    .single();
  if (error || !post) throw Object.assign(new Error('Post not found'), { status: 404 });
  if (post.community_id !== communityId) {
    throw Object.assign(new Error('Post is not in your community'), { status: 403 });
  }
  return post;
}

router.get('/feed', requireAuth, async (req, res) => {
  try {
    const profile = await getMemberContext(req.user!.id);
    const sb = getAdminClient();

    const { data: hidden } = await sb
      .from('hidden_members')
      .select('hidden_user_id')
      .eq('user_id', req.user!.id);
    const hiddenIds = (hidden || []).map((h) => h.hidden_user_id);

    const { data: posts, error } = await sb
      .from('community_posts')
      .select('*')
      .eq('community_id', profile.community_id)
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) return res.status(500).json({ error: error.message });

    const hiddenSet = new Set(hiddenIds);
    // Hide admin-removed posts (removed_at from Day 3) + hidden members
    const list = (posts || [])
      .filter((p: any) => !p.removed_at && !hiddenSet.has(p.author_id))
      .slice(0, 50);
    const authorIds = [...new Set(list.map((p) => p.author_id))];
    const postIds = list.map((p) => p.id);

    const [
      { data: authors },
      { data: likes },
      { data: comments },
      { data: myLikes },
      { data: commentRows },
    ] = await Promise.all([
      authorIds.length
        ? sb.from('profiles').select('id, full_name, photo_url').in('id', authorIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? sb.from('post_likes').select('post_id').in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? sb.from('post_comments').select('post_id').in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? sb
            .from('post_likes')
            .select('post_id')
            .eq('user_id', req.user!.id)
            .in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? sb
            .from('post_comments')
            .select('id, post_id, author_id, body, created_at')
            .in('post_id', postIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const authorMap = new Map((authors || []).map((a) => [a.id, a]));
    const likeCount = new Map<string, number>();
    for (const l of likes || []) {
      likeCount.set(l.post_id, (likeCount.get(l.post_id) || 0) + 1);
    }
    const commentCount = new Map<string, number>();
    for (const c of comments || []) {
      commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1);
    }
    const likedSet = new Set((myLikes || []).map((l) => l.post_id));

    const latestCommentByPost = new Map<string, any>();
    const commentAuthorIds = new Set<string>();
    for (const c of commentRows || []) {
      if (latestCommentByPost.has(c.post_id)) continue;
      latestCommentByPost.set(c.post_id, c);
      if (c.author_id) commentAuthorIds.add(c.author_id);
    }
    const missingAuthorIds = [...commentAuthorIds].filter((id) => !authorMap.has(id));
    if (missingAuthorIds.length) {
      const { data: moreAuthors } = await sb
        .from('profiles')
        .select('id, full_name, photo_url')
        .in('id', missingAuthorIds);
      for (const a of moreAuthors || []) authorMap.set(a.id, a);
    }

    const enriched = list.map((p) => {
      const a = authorMap.get(p.author_id);
      const latest = latestCommentByPost.get(p.id);
      const ca = latest ? authorMap.get(latest.author_id) : null;
      return {
        ...p,
        author_name: a?.full_name ?? null,
        author_photo_url: a?.photo_url ?? null,
        like_count: likeCount.get(p.id) || 0,
        comment_count: commentCount.get(p.id) || 0,
        liked_by_me: likedSet.has(p.id),
        latest_comment: latest
          ? {
              ...latest,
              author_name: ca?.full_name ?? null,
              author_photo_url: ca?.photo_url ?? null,
            }
          : null,
      };
    });

    return res.json({
      community: profile.community,
      posts: enriched,
    });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/posts', requireAuth, async (req, res) => {
  try {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const profile = await getMemberContext(req.user!.id);
    const sb = getAdminClient();
    const input = parsed.data;

    let weight_change_lb: number | null = null;
    if (input.include_weight_change) {
      const start = profile.start_weight_lb;
      const current = profile.current_weight_lb;
      if (start != null && current != null) {
        weight_change_lb = Math.round((start - current) * 10) / 10;
      }
    }

    let dose_label: string | null = null;
    if (input.include_dose) {
      const { data: doses } = await sb
        .from('dose_regimens')
        .select('medication_name, amount_mg')
        .eq('user_id', req.user!.id)
        .or('end_date.is.null,end_date.gte.9000-01-01')
        .order('start_date', { ascending: false });
      if (doses?.length) {
        dose_label = doses
          .map((d) => `${d.medication_name} ${Number(d.amount_mg)} mg`)
          .join(' + ');
      }
    }

    // Only attach before/after when the client sent both URLs.
    // Never auto-fill from progress_photos — that silently added old images to posts.
    const before_url = input.before_url ?? null;
    const after_url = input.after_url ?? null;
    const include_before_after = Boolean(
      input.include_before_after && before_url && after_url
    );
    const photo_urls = (input.photo_urls || []).slice(0, 3);

    const { data, error } = await sb
      .from('community_posts')
      .insert({
        community_id: profile.community_id,
        author_id: req.user!.id,
        body: input.body,
        photo_urls,
        include_weight_change: input.include_weight_change,
        include_before_after,
        include_dose: input.include_dose,
        weight_change_lb: input.include_weight_change ? weight_change_lb : null,
        before_url: include_before_after ? before_url : null,
        after_url: include_before_after ? after_url : null,
        dose_label: input.include_dose ? dose_label : null,
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({
      post: {
        ...data,
        author_name: profile.full_name,
        author_photo_url: profile.photo_url,
        like_count: 0,
        comment_count: 0,
        liked_by_me: false,
      },
    });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const profile = await getMemberContext(req.user!.id);
    const post = await assertPostInCommunity(req.params.id, profile.community_id);
    if (post.author_id !== req.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    const { error } = await getAdminClient()
      .from('community_posts')
      .delete()
      .eq('id', post.id)
      .eq('author_id', req.user!.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const profile = await getMemberContext(req.user!.id);
    await assertPostInCommunity(req.params.id, profile.community_id);
    const { error } = await getAdminClient().from('post_likes').upsert(
      { post_id: req.params.id, user_id: req.user!.id },
      { onConflict: 'post_id,user_id', ignoreDuplicates: true }
    );
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ liked: true });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.delete('/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const profile = await getMemberContext(req.user!.id);
    await assertPostInCommunity(req.params.id, profile.community_id);
    const { error } = await getAdminClient()
      .from('post_likes')
      .delete()
      .eq('post_id', req.params.id)
      .eq('user_id', req.user!.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ liked: false });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const profile = await getMemberContext(req.user!.id);
    await assertPostInCommunity(req.params.id, profile.community_id);
    const sb = getAdminClient();
    const { data: comments, error } = await sb
      .from('post_comments')
      .select('*')
      .eq('post_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const authorIds = [...new Set((comments || []).map((c) => c.author_id))];
    const { data: authors } = authorIds.length
      ? await sb.from('profiles').select('id, full_name, photo_url').in('id', authorIds)
      : { data: [] as any[] };
    const authorMap = new Map((authors || []).map((a) => [a.id, a]));

    return res.json({
      comments: (comments || []).map((c) => {
        const a = authorMap.get(c.author_id);
        return {
          ...c,
          author_name: a?.full_name ?? null,
          author_photo_url: a?.photo_url ?? null,
        };
      }),
    });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const profile = await getMemberContext(req.user!.id);
    await assertPostInCommunity(req.params.id, profile.community_id);

    const { data, error } = await getAdminClient()
      .from('post_comments')
      .insert({
        post_id: req.params.id,
        author_id: req.user!.id,
        body: parsed.data.body,
      })
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({
      comment: {
        ...data,
        author_name: profile.full_name,
        author_photo_url: profile.photo_url,
      },
    });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    const profile = await getMemberContext(req.user!.id);
    const sb = getAdminClient();
    const { data: comment, error } = await sb
      .from('post_comments')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !comment) return res.status(404).json({ error: 'Comment not found' });
    await assertPostInCommunity(comment.post_id, profile.community_id);
    if (comment.author_id !== req.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    const { error: delErr } = await sb
      .from('post_comments')
      .delete()
      .eq('id', comment.id)
      .eq('author_id', req.user!.id);
    if (delErr) return res.status(500).json({ error: delErr.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/posts/:id/report', requireAuth, async (req, res) => {
  try {
    const parsed = reportPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const profile = await getMemberContext(req.user!.id);
    const post = await assertPostInCommunity(req.params.id, profile.community_id);
    const sb = getAdminClient();

    const { error } = await sb.from('post_reports').upsert(
      {
        post_id: post.id,
        reporter_id: req.user!.id,
        reason: parsed.data.reason,
      },
      { onConflict: 'post_id,reporter_id' }
    );
    if (error) return res.status(500).json({ error: error.message });

    if (parsed.data.hide_author && post.author_id !== req.user!.id) {
      await sb.from('hidden_members').upsert(
        { user_id: req.user!.id, hidden_user_id: post.author_id },
        { onConflict: 'user_id,hidden_user_id', ignoreDuplicates: true }
      );
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/hide-member', requireAuth, async (req, res) => {
  try {
    const parsed = hideMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (parsed.data.hidden_user_id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot hide yourself' });
    }
    await getMemberContext(req.user!.id);
    const { error } = await getAdminClient().from('hidden_members').upsert(
      {
        user_id: req.user!.id,
        hidden_user_id: parsed.data.hidden_user_id,
      },
      { onConflict: 'user_id,hidden_user_id', ignoreDuplicates: true }
    );
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

export default router;
