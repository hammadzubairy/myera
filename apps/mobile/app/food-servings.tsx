import { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { paramStr } from '../src/lib/foodDraft';

/** Legacy route — add-to-meal now lives on /food-search with an embedded sheet. */
export default function FoodServingsRedirect() {
  const raw = useLocalSearchParams<{ meal?: string; date?: string }>();

  useEffect(() => {
    const meal = paramStr(raw.meal, 'snack');
    const date = paramStr(raw.date, new Date().toISOString().slice(0, 10));
    router.replace({
      pathname: '/food-search',
      params: { meal, date },
    });
  }, [raw.meal, raw.date]);

  return <View style={{ flex: 1 }} />;
}
