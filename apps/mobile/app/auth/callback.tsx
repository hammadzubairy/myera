import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { completeOAuthRedirect } from '../../src/lib/oauth';
import { colors, fonts } from '../../src/theme';

/** Native return path for Google sign-in (`myera://auth/callback`). */
export default function AuthCallbackScreen() {
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let cancelled = false;

    async function finish(url: string | null) {
      if (!url || cancelled || !url.includes('code=') && !url.includes('access_token=')) return;
      try {
        await completeOAuthRedirect(url);
        if (!cancelled) router.replace('/');
      } catch (e: any) {
        if (!cancelled) {
          setMessage(e?.message || 'Google sign-in failed');
          setTimeout(() => router.replace('/(auth)/welcome'), 1600);
        }
      }
    }

    Linking.getInitialURL().then(finish);
    const sub = Linking.addEventListener('url', (event) => finish(event.url));
    const timer = setTimeout(() => {
      if (!cancelled) router.replace('/(auth)/welcome');
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand }}>
      <ActivityIndicator color={colors.pine} />
      <Text style={{ marginTop: 12, fontFamily: fonts.body, color: colors.muted }}>{message}</Text>
    </View>
  );
}
