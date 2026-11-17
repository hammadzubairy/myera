import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { brand } from '../../src/assets/brand';
import { Btn, Muted, Screen } from '../../src/components/ui';
import { colors, fonts } from '../../src/theme';
import { completeOAuthRedirect } from '../../src/lib/oauth';
import { supabase, supabaseConfigured } from '../../src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const HERO_SLIDES = [brand.welcome, brand.after1, brand.before1, brand.after2] as const;
const HERO_BASE_HEIGHT = 340;

export default function WelcomeScreen() {
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [slide, setSlide] = useState(0);
  const listRef = useRef<FlatList<(typeof HERO_SLIDES)[number]>>(null);
  const insets = useSafeAreaInsets();
  const width = Dimensions.get('window').width;
  const heroHeight = HERO_BASE_HEIGHT + Math.max(0, insets.top);

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((prev) => {
        const next = (prev + 1) % HERO_SLIDES.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  async function afterAuth() {
    router.replace('/');
  }

  async function signInWithApple() {
    if (!supabaseConfigured) {
      Alert.alert('Configure Supabase', 'Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY in .env');
      return;
    }
    try {
      setBusy('apple');
      if (Platform.OS !== 'ios') {
        Alert.alert('Apple Sign-In', 'Available on iOS devices. Use email or Google on this platform.');
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      await afterAuth();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-in failed', e.message || String(e));
      }
    } finally {
      setBusy(null);
    }
  }

  async function signInWithGoogle() {
    if (!supabaseConfigured) {
      Alert.alert('Configure Supabase', 'Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY in .env');
      return;
    }
    try {
      setBusy('google');
      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : makeRedirectUri({ scheme: 'myera', path: 'auth/callback' });

      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, queryParams: { prompt: 'select_account' } },
        });
        if (error) throw error;
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google sign-in did not start.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        await completeOAuthRedirect(result.url);
        await afterAuth();
        return;
      }
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      throw new Error('Google sign-in was closed before it finished.');
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/provider is not enabled|unsupported provider/i.test(msg)) {
        Alert.alert(
          'Google sign-in needs a dashboard setup',
          'In Supabase, open Authentication → Providers → Google, turn it on, and paste the Google OAuth client ID and secret. Then add redirect URL myera://auth/callback (and your web address, if you use the browser).'
        );
        return;
      }
      Alert.alert('Google sign-in failed', msg);
    } finally {
      setBusy(null);
    }
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    setSlide(Math.max(0, Math.min(HERO_SLIDES.length - 1, idx)));
  }

  return (
    <Screen>
      <View style={styles.root}>
        <View style={[styles.heroWrap, { height: heroHeight }]}>
          <FlatList
            ref={listRef}
            data={HERO_SLIDES as unknown as (typeof HERO_SLIDES)[number][]}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index, animated: false });
              }, 50);
            }}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={{ width, height: heroHeight }}>
                <Image source={item} style={styles.heroImg} resizeMode="cover" />
              </View>
            )}
          />
          <LinearGradient
            colors={[colors.background, 'rgba(15,61,70,0.45)', 'transparent']}
            locations={[0, 0.35, 0.7]}
            style={[styles.topFade, { height: Math.max(72, insets.top + 48) }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(15,61,70,0.25)', colors.background]}
            locations={[0.55, 0.82, 1]}
            style={styles.bottomFade}
            pointerEvents="none"
          />
          <View style={styles.dots} pointerEvents="none">
            {HERO_SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === slide && styles.dotOn]} />
            ))}
          </View>
        </View>

        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.midSpacer} />

          <View style={styles.brandBlock}>
            <Image source={brand.logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.tagline}>
              Your dose, your progress, your wins. All in one place.
            </Text>
          </View>

          <View style={styles.stack}>
            <Pressable
              style={[styles.socialBtn, styles.appleBtn]}
              onPress={signInWithApple}
              disabled={busy === 'apple'}
            >
              <AppleGlyph />
              <Text style={styles.appleText}>Continue with Apple</Text>
            </Pressable>

            <Pressable
              style={[styles.socialBtn, styles.googleBtn]}
              onPress={signInWithGoogle}
              disabled={busy === 'google'}
            >
              <GoogleGlyph />
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>or use email</Text>
              <View style={styles.line} />
            </View>

            <Btn title="Sign in with email" onPress={() => router.push('/(auth)/sign-in')} />

            <Pressable onPress={() => router.push('/(auth)/sign-up')} style={styles.footer}>
              <Muted>
                New here? <Text style={styles.link}>Create an account</Text>
              </Muted>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Screen>
  );
}

function AppleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
      <Path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2 .1 0 .2 0 .3-.1.9-.3 1.4-1 2.4-1 .9 0 1.4.7 2.4 1 .2 0 .3.1.4.1 1.1-.1 1.9-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.2-.1 0-2.1-.8-2.1-3.3zM14.5 6.5c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.3.9.1 1.7-.4 2.3-1.1z" />
    </Svg>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingBottom: 14 },
  heroWrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  dots: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotOn: {
    backgroundColor: colors.onBg,
    width: 16,
  },
  midSpacer: { flex: 1, minHeight: 12 },
  brandBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  logo: {
    width: 150,
    height: 68,
  },
  tagline: {
    fontFamily: fonts.displayItalic,
    fontSize: 18,
    fontWeight: '500',
    color: colors.onBg,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 25,
    maxWidth: 300,
  },
  stack: { gap: 10, paddingHorizontal: 22 },
  socialBtn: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  appleBtn: { backgroundColor: colors.black },
  appleText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  googleBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  googleText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: colors.onBgLine },
  or: { fontFamily: fonts.sub, color: colors.onBgMuted, fontSize: 13, fontWeight: '400' },
  footer: { alignItems: 'center', paddingVertical: 8 },
  link: { color: colors.onBg, fontFamily: fonts.body, fontWeight: '700' },
});
