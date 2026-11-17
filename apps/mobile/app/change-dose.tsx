import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Field, IconBtn, Muted, Screen, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import { colors } from '../src/theme';
import { notify } from '../src/lib/notify';

/**
 * /change-dose?id=<regimen id>  → change that medication's dose (old one gets an end date)
 * /change-dose                  → add a new medication alongside any active ones
 */
export default function ChangeDoseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const regimenId = typeof id === 'string' && id ? id : null;
  const isChange = Boolean(regimenId);

  const [medication, setMedication] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .getRegimens()
      .then(({ regimens }) => {
        const active = (regimens || []).filter((r: any) => {
          const e = r.end_date;
          return e == null || e === '' || String(e) >= '9000-01-01';
        });
        if (regimenId) {
          const target = active.find((r) => r.id === regimenId);
          if (target) {
            setMedication(target.medication_name);
            setAmount(String(target.amount_mg));
          }
        } else if (active.length === 0) {
          // First medication: suggest the common one
          setMedication((m) => m || 'Semaglutide');
        }
      })
      .catch(() => undefined);
  }, [regimenId]);

  async function save() {
    const amount_mg = Number(amount);
    if (!medication.trim()) return notify('Medication', 'Enter medication name.');
    if (!amount_mg) return notify('Amount', 'Enter dose amount in mg.');
    try {
      setLoading(true);
      const body = {
        medication_name: medication.trim(),
        amount_mg,
        start_date: startDate,
      };
      if (regimenId) await api.changeRegimen({ ...body, regimen_id: regimenId });
      else await api.createRegimen(body);
      router.back();
    } catch (e: any) {
      notify('Could not save dose', e.message || String(e));
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
              <Title>{isChange ? 'Change dose' : 'Add dose'}</Title>
              <View style={{ width: 36 }} />
            </View>
            <Muted style={{ marginBottom: 14 }}>
              {isChange
                ? 'The previous dose will close with an end date in your history.'
                : 'Add a medication. Any doses you already take stay active.'}
            </Muted>
            <View style={styles.form}>
              <Field label="Medication" value={medication} onChangeText={setMedication} />
              <Field
                label="Amount (mg)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Field label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
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
    marginBottom: 12,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
  form: { gap: 14 },
});
