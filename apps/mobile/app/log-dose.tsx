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
import { Btn, Chip, Field, IconBtn, Muted, Screen, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import { colors } from '../src/theme';
import { notify } from '../src/lib/notify';

/** /log-dose?id=<regimen id> logs that medication; without id, pick one when several are active. */
export default function LogDoseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [active, setActive] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof id === 'string' && id ? id : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .getRegimens()
      .then(({ regimens }) => {
        const list = (regimens || []).filter((r) => {
          const e = r.end_date;
          return e == null || e === '' || String(e) >= '9000-01-01';
        });
        setActive(list);
        const initial = list.find((r) => r.id === selectedId) || list[0];
        if (initial) {
          setSelectedId(initial.id);
          setAmount(String(initial.amount_mg));
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(r: any) {
    setSelectedId(r.id);
    setAmount(String(r.amount_mg));
  }

  async function save() {
    const amount_mg = Number(amount);
    if (!amount_mg) return notify('Amount', 'Enter dose amount in mg.');
    try {
      setLoading(true);
      await api.createDoseLog({
        logged_on: date,
        amount_mg,
        ...(selectedId ? { regimen_id: selectedId } : {}),
      });
      router.back();
    } catch (e: any) {
      notify('Could not log dose', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const showPicker = active.length > 1;

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
              <Title>Log dose</Title>
              <View style={{ width: 36 }} />
            </View>
            <View style={styles.form}>
              {showPicker ? (
                <View>
                  <Muted style={{ marginBottom: 8 }}>Medication</Muted>
                  <View style={styles.chips}>
                    {active.map((r) => (
                      <Chip
                        key={r.id}
                        label={`${r.medication_name} · ${Number(r.amount_mg)} mg`}
                        selected={selectedId === r.id}
                        onPress={() => pick(r)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
              <Field
                label="Amount (mg)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Btn title="Save log" onPress={save} loading={loading} />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
