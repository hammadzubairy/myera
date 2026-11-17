import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Chip, Field, IconBtn, Muted, Screen, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import { colors } from '../src/theme';

export default function AddMeasurementScreen() {
  const [types, setTypes] = useState<any[]>([]);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getMeasurementTypes().then(({ types: t }) => {
      setTypes(t || []);
      const waist = (t || []).find((x) => x.key === 'waist');
      if (waist) setTypeId(waist.id);
    }).catch(console.warn);
  }, []);

  async function save() {
    const value_in = Number(value);
    if (!value_in) return Alert.alert('Value', 'Enter measurement in inches.');
    try {
      setLoading(true);
      let tid = typeId;
      if (!tid && customLabel.trim()) {
        const created = await api.createMeasurementType({ label: customLabel.trim() });
        tid = created.type.id;
      }
      if (!tid) return Alert.alert('Type', 'Pick waist, hips, or add a custom measurement.');
      await api.createMeasurementLog({ type_id: tid, value_in, logged_on: date });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen tab="progress">
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <IconBtn onPress={() => router.back()}>
            <Text style={styles.back}>‹</Text>
          </IconBtn>
          <Title>Add measurement</Title>
          <View style={{ width: 36 }} />
        </View>
        <Muted style={{ marginBottom: 12 }}>Waist and hips by default, or add your own (Other).</Muted>
        <View style={styles.chips}>
          {types.map((t) => (
            <Chip
              key={t.id}
              label={t.label}
              selected={typeId === t.id}
              onPress={() => {
                setTypeId(t.id);
                setCustomLabel('');
              }}
            />
          ))}
          <Chip
            label="Other"
            selected={!typeId && Boolean(customLabel)}
            onPress={() => setTypeId(null)}
          />
        </View>
        {!typeId && (
          <Field
            label="Custom name"
            value={customLabel}
            onChangeText={setCustomLabel}
            placeholder="Arms"
            containerStyle={{ marginTop: 12 }}
          />
        )}
        <View style={{ gap: 12, marginTop: 12 }}>
          <Field
            label="Value (in)"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
          />
          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
          <Btn title="Save" onPress={save} loading={loading} />
        </View>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
