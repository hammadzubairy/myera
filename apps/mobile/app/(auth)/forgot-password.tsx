import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Field, IconBtn, Muted, Screen, Title } from '../../src/components/ui';
import { KeyboardFormScroll } from '../../src/components/KeyboardFormScroll';
import { colors } from '../../src/theme';
import { supabase } from '../../src/lib/supabase';
import { notify } from '../../src/lib/notify';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      notify('Check your email', 'We sent a password reset link if that account exists.');
      router.back();
    } catch (e: any) {
      notify('Reset failed', e.message || String(e));
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
            <Title>Reset password</Title>
            <View style={{ width: 36 }} />
          </View>
          <Muted style={styles.subtitle}>
            Enter your email and we will send a reset link.
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
            <Btn title="Send reset link" onPress={onSubmit} loading={loading} />
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
});
