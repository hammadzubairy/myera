import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { kgToLb, type Units, weightUnitLabel } from '@myera/shared';
import { Btn, Field, IconBtn, Screen, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { colors } from '../src/theme';
import { notify } from '../src/lib/notify';

export default function LogWeightScreen() {
  const { profile } = useAuth();
  const units: Units = profile?.units === 'kg_cm' ? 'kg_cm' : 'lb_in';
  const wUnit = weightUnitLabel(units);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    const entered = Number(weight);
    if (!entered) return notify('Weight', `Enter weight in ${wUnit}.`);
    const weight_lb = units === 'kg_cm' ? kgToLb(entered) : entered;
    try {
      setLoading(true);
      await api.createWeight({ logged_on: date, weight_lb });
      router.back();
    } catch (e: any) {
      notify('Could not log weight', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen tab="today">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.top}>
              <IconBtn onPress={() => router.back()}>
                <Text style={styles.back}>‹</Text>
              </IconBtn>
              <Title>Log weight</Title>
              <View style={{ width: 36 }} />
            </View>
            <View style={styles.form}>
              <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
              <Field
                label={`Weight (${wUnit})`}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
              <Btn title="Save" onPress={save} loading={loading} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    marginBottom: 16,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
  form: { gap: 14 },
});
