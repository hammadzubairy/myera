import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Field, IconBtn, Muted, Screen, Title } from '../../src/components/ui';
import { KeyboardFormScroll } from '../../src/components/KeyboardFormScroll';
import { colors, fonts } from '../../src/theme';
import { supabase } from '../../src/lib/supabase';
import { notify } from '../../src/lib/notify';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace('/');
    } catch (e: any) {
      notify('Sign in failed', e.message || String(e));
      Alert.alert('Sign in failed', e.message || String(e));
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
            <Title>Sign in</Title>
            <View style={{ width: 36 }} />
          </View>
          <Muted style={styles.subtitle}>
            Use the email and password for your My Era-RX account.
          </Muted>
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
            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
            <Btn title="Sign in" onPress={onSubmit} loading={loading} />
            <Pressable onPress={() => router.push('/(auth)/sign-up')}>
              <Muted style={{ textAlign: 'center' }}>
                New here? <Text style={styles.link}>Create an account</Text>
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
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 4 },
  forgot: {
    fontFamily: fonts.sub,
    color: colors.onBg,
    fontSize: 14,
  },
  link: { color: colors.onBg, fontWeight: '700' },
});
