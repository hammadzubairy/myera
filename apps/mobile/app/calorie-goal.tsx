import React, { useEffect, useState } from 'react';
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
import { Btn, Field, IconBtn, Screen, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { notify } from '../src/lib/notify';
import { colors } from '../src/theme';

export default function CalorieGoalScreen() {
  const { profile, refreshProfile } = useAuth();
  const [goal, setGoal] = useState('1600');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.calorie_goal_kcal) setGoal(String(profile.calorie_goal_kcal));
  }, [profile?.calorie_goal_kcal]);

  async function save() {
    const n = Math.round(Number(goal));
    if (!n || n < 800 || n > 6000) {
      return notify('Calorie goal', 'Enter a goal between 800 and 6000.');
    }
    try {
      setLoading(true);
      await api.setCalorieGoal(n);
      await refreshProfile();
      router.back();
    } catch (e: any) {
      notify('Could not save', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen tab="food">
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
              <Title>Calorie goal</Title>
              <View style={{ width: 36 }} />
            </View>
            <Field
              label="Daily calories (kcal)"
              value={goal}
              onChangeText={setGoal}
              keyboardType="number-pad"
            />
            <Btn title="Save goal" onPress={save} loading={loading} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  scroll: { paddingBottom: 32, gap: 14 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
});
