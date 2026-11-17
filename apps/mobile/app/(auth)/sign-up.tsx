import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Field, IconBtn, Muted, Screen, Title } from '../../src/components/ui';
import { KeyboardFormScroll } from '../../src/components/KeyboardFormScroll';
import { colors } from '../../src/theme';
import { api } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { notify } from '../../src/lib/notify';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      try {
        await api.prepareSignup(email.trim());
      } catch (prepErr) {
        console.warn('[signup] prepare', prepErr);
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.session) {
        notify(
          'Check your email',
          'Confirm your email if required, then sign in to finish setup.'
        );
        router.replace('/(auth)/sign-in');
        return;
      }
      router.replace('/onboarding/profile');
    } catch (e: any) {
      notify('Sign up failed', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <SafeAreaView style={styles.safe}>
        <KeyboardFormScroll contentContainerStyle={styles.scroll}>
          <View style={styles.top}>
            <IconBtn onPress={() => router.back()}>
              <Text style={styles.back}>‹</Text>
            </IconBtn>
            <Title>Create account</Title>
            <View style={{ width: 36 }} />
          </View>
          <Muted style={styles.subtitle}>Step 1 of 2 — then set up your profile.</Muted>
          <View style={styles.form}>
            <Field
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <Field
              label="Password"
              secureToggle
              value={password}
              onChangeText={setPassword}
            />
            <Btn title="Continue" onPress={onSubmit} loading={loading} />
            <Pressable onPress={() => router.push('/(auth)/sign-in')}>
              <Muted style={{ textAlign: 'center' }}>
                Already have an account? <Text style={styles.link}>Sign in</Text>
              </Muted>
            </Pressable>
          </View>
        </KeyboardFormScroll>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  scroll: { paddingBottom: 32 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.onBg, lineHeight: 30, marginTop: -2 },
  subtitle: { marginBottom: 20 },
  form: { gap: 14 },
  link: { color: colors.onBg, fontWeight: '700' },
});
