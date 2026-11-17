import { getAdminClient } from '../supabase';

type PrefKey = 'community' | 'announcements' | 'shot_reminders';

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/** Expo Push HTTP API — FR-7.3 / FR-10.3 applied by callers (audience + copy). */
export async function sendExpoPush(
  userIds: string[],
  message: PushMessage,
  prefKey?: PrefKey
): Promise<number> {
  if (!userIds.length) return 0;
  const sb = getAdminClient();

  let allowed = [...new Set(userIds)];
  if (prefKey) {
    const { data: prefs } = await sb
      .from('notification_prefs')
      .select('user_id, community, announcements, shot_reminders')
      .in('user_id', allowed);
    const byUser = new Map((prefs || []).map((p: any) => [p.user_id as string, p]));
    allowed = allowed.filter((id) => {
      const p = byUser.get(id);
      if (!p) return true; // default on
      return p[prefKey] !== false;
    });
  }

  if (!allowed.length) return 0;

  const { data: tokens } = await sb
    .from('push_tokens')
    .select('token, user_id')
    .in('user_id', allowed);

  const expoTokens = (tokens || [])
    .map((t: any) => t.token as string)
    .filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));

  if (!expoTokens.length) return 0;

  let sent = 0;
  for (let i = 0; i < expoTokens.length; i += 100) {
    const chunk = expoTokens.slice(i, i + 100);
    const payload = chunk.map((to) => ({
      to,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data || {},
    }));
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) sent += chunk.length;
      else console.warn('[push] Expo send failed', await res.text());
    } catch (e) {
      console.warn('[push] Expo send error', e);
    }
  }
  return sent;
}

export async function userIdsForAudience(
  audience: 'all' | 'women' | 'men'
): Promise<string[]> {
  const sb = getAdminClient();
  if (audience !== 'all') {
    const { data: comm } = await sb
      .from('communities')
      .select('id')
      .eq('slug', audience)
      .maybeSingle();
    if (!comm) return [];
    const { data } = await sb
      .from('profiles')
      .select('id')
      .eq('community_id', comm.id)
      .is('deleted_at', null)
      .is('suspended_at', null);
    return (data || []).map((r: any) => r.id as string);
  }

  const { data } = await sb
    .from('profiles')
    .select('id')
    .is('deleted_at', null)
    .is('suspended_at', null);
  return (data || []).map((r: any) => r.id as string);
}
