import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { colors, fonts } from '../src/theme';
import { supabaseConfigured } from '../src/lib/supabase';

export default function Index() {
  const { session, profile, loading, profileReady, profileError, refreshProfile, signOut } =
    useAuth();
  const [retrying, setRetrying] = useState(false);

  if (!supabaseConfigured) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (loading || (session && !profileReady)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.beige} />
        <Text style={styles.hint}>Loading your account…</Text>
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/welcome" />;

  // Session exists but API unreachable / timed out — don't spin forever
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Can’t reach the server</Text>
        <Text style={styles.body}>
          {profileError ||
            'Check that the API is running and EXPO_PUBLIC_API_URL matches this device’s network.'}
        </Text>
        <Pressable
          style={styles.btn}
          disabled={retrying}
          onPress={async () => {
            setRetrying(true);
            await refreshProfile();
            setRetrying(false);
          }}
        >
          {retrying ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>Try again</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.linkWrap}
          onPress={async () => {
            await signOut();
          }}
        >
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (!profile.onboarding_completed_at) return <Redirect href="/onboarding/profile" />;
  return <Redirect href="/(tabs)/today" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
    paddingHorizontal: 28,
  },
  hint: {
    marginTop: 12,
    fontFamily: fonts.body,
    color: colors.onBgMuted,
    fontSize: 14,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.onBg,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onBgMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: colors.beige,
    borderRadius: 14,
    minHeight: 46,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnText: {
    fontFamily: fonts.body,
    color: colors.onBeige,
    fontWeight: '600',
    fontSize: 15,
  },
  linkWrap: { marginTop: 16, padding: 8 },
  link: { fontFamily: fonts.sub, color: colors.onBg, fontWeight: '600' },
});
