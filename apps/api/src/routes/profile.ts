import { Router } from 'express';
import {
  communityForGender,
  onboardingSchema,
  updateProfileSchema,
} from '@myera/shared';
import { requireAuth } from '../middleware/auth';
import { getAdminClient } from '../supabase';

const router = Router();

async function fetchProfile(userId: string) {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('profiles')
    .select('*, community:communities(*)')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await fetchProfile(req.user!.id);
    return res.json({ profile });
  } catch (e: any) {
    return res.status(404).json({ error: e.message || 'Profile not found' });
  }
});

router.patch('/profile', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', req.user!.id)
    .select('*, community:communities(*)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile: data });
});

router.post('/onboarding', requireAuth, async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const input = parsed.data;
  const sb = getAdminClient();

  let communitySlug: 'women' | 'men';
  try {
    communitySlug = communityForGender(input.gender, input.community_slug);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const { data: community, error: cErr } = await sb
    .from('communities')
    .select('*')
    .eq('slug', communitySlug)
    .single();
  if (cErr || !community) {
    return res.status(500).json({ error: 'Community not found. Run migrations.' });
  }

  const { data, error } = await sb
    .from('profiles')
    .update({
      full_name: input.full_name,
      height_in: input.height_in,
      start_weight_lb: input.current_weight_lb,
      current_weight_lb: input.current_weight_lb,
      goal_weight_lb: input.goal_weight_lb ?? null,
      gender: input.gender,
      other_gender_text: input.gender === 'other' ? input.other_gender_text ?? null : null,
      community_id: community.id,
      photo_url: input.photo_url ?? null,
      photo_public_id: input.photo_public_id ?? null,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.user!.id)
    .select('*, community:communities(*)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Seed initial weight log
  await sb.from('weight_logs').upsert(
    {
      user_id: req.user!.id,
      logged_on: new Date().toISOString().slice(0, 10),
      weight_lb: input.current_weight_lb,
    },
    { onConflict: 'user_id,logged_on' }
  );

  await sb.from('notification_prefs').upsert({ user_id: req.user!.id });

  return res.json({ profile: data });
});

router.get('/today', requireAuth, async (req, res) => {
  try {
    const profile = await fetchProfile(req.user!.id);
    const sb = getAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: activeDoseRows }, { data: foodLogs }] = await Promise.all([
      sb
        .from('dose_regimens')
        .select('*')
        .eq('user_id', req.user!.id)
        .or('end_date.is.null,end_date.gte.9000-01-01')
        .order('start_date', { ascending: false }),
      sb
        .from('food_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', req.user!.id)
        .eq('logged_on', today),
    ]);

    const start = profile.start_weight_lb;
    const current = profile.current_weight_lb;
    const goal = profile.goal_weight_lb;
    const lb_lost =
      start != null && current != null ? Math.round((start - current) * 10) / 10 : null;
    const to_go_lb =
      goal != null && current != null ? Math.round((current - goal) * 10) / 10 : null;

    let week_number: number | null = null;
    if (profile.onboarding_completed_at) {
      const startDate = new Date(profile.onboarding_completed_at);
      week_number =
        Math.floor((Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    }

    const activeDoses = activeDoseRows || [];
    const logs = foodLogs || [];
    const calories_eaten = Math.round(
      logs.reduce((s, l) => s + Number(l.calories || 0), 0)
    );
    const protein_g =
      Math.round(logs.reduce((s, l) => s + Number(l.protein_g || 0), 0) * 10) / 10;
    const carbs_g =
      Math.round(logs.reduce((s, l) => s + Number(l.carbs_g || 0), 0) * 10) / 10;
    const fat_g =
      Math.round(logs.reduce((s, l) => s + Number(l.fat_g || 0), 0) * 10) / 10;
    const calorie_goal_kcal = profile.calorie_goal_kcal ?? 1600;

    let next_shot_label: string | null = null;
    if (activeDoses.length) {
      const { data: schedule } = await sb
        .from('shot_schedules')
        .select('*')
        .eq('user_id', req.user!.id)
        .maybeSingle();

      const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (schedule?.frequency === 'daily') {
        next_shot_label = 'Due today';
      } else {
        const shotDay =
          schedule?.shot_day != null && schedule.shot_day >= 0 && schedule.shot_day <= 6
            ? schedule.shot_day
            : 6;
        next_shot_label = `Due ${DAYS[shotDay]}`;
      }
    }

    return res.json({
      profile,
      week_number,
      lb_lost,
      to_go_lb,
      active_dose: activeDoses[0] ?? null,
      active_doses: activeDoses,
      next_shot_label,
      calorie_goal_kcal,
      calories_eaten,
      protein_g,
      carbs_g,
      fat_g,
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
