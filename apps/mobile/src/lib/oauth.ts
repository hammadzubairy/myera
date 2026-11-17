import { supabase } from './supabase';

function param(url: string, key: string): string | null {
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] || '';
  const fromQuery = new URLSearchParams(query).get(key);
  if (fromQuery) return fromQuery;
  return new URLSearchParams(hash).get(key);
}

/** Finish a Supabase OAuth redirect (PKCE code, or legacy hash tokens). */
export async function completeOAuthRedirect(url: string) {
  const code = param(url, 'code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
      throw error;
    }
    return;
  }

  const access_token = param(url, 'access_token');
  const refresh_token = param(url, 'refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return;
  }

  const oauthError = param(url, 'error_description') || param(url, 'error');
  if (oauthError) throw new Error(decodeURIComponent(oauthError.replace(/\+/g, ' ')));
  throw new Error('Google did not return a sign-in session.');
}
