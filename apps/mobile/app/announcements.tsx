import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, IconBtn, Screen, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import {
  getCachedAnnouncements,
  prefetchAnnouncements,
  setCachedAnnouncements,
} from '../src/lib/announcementsCache';
import { goBackOr } from '../src/lib/nav';
import { colors, fonts } from '../src/theme';

export default function AnnouncementsScreen() {
  const cached = getCachedAnnouncements();
  const [items, setItems] = useState<any[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner && !getCachedAnnouncements()?.length) setLoading(true);
    try {
      const list = await prefetchAnnouncements(async () => {
        const { announcements } = await api.getAnnouncements();
        return announcements || [];
      });
      setItems(list);
      setCachedAnnouncements(list);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const hit = getCachedAnnouncements();
      if (hit) {
        setItems(hit);
        setLoading(false);
      }
      load(!hit);
    }, [load])
  );

  async function openItem(a: any) {
    if (!a.read) {
      try {
        await api.markAnnouncementRead(a.id);
        setItems((prev) => {
          const next = prev.map((x) => (x.id === a.id ? { ...x, read: true } : x));
          setCachedAnnouncements(next);
          return next;
        });
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <Screen tab="community">
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <IconBtn onPress={() => goBackOr('/(tabs)/today')}>
            <Text style={styles.back}>‹</Text>
          </IconBtn>
          <Title>Announcements</Title>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load(false);
                setRefreshing(false);
              }}
              tintColor={colors.pine}
            />
          }
        >
          {loading ? (
            <Card>
              <ActivityIndicator color={colors.pine} />
              <Text style={[styles.empty, { marginTop: 10 }]}>Loading announcements…</Text>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <Text style={styles.empty}>No announcements yet.</Text>
            </Card>
          ) : (
            items.map((a) => (
              <Pressable key={a.id} onPress={() => openItem(a)}>
                <Card style={styles.card}>
                  <View style={styles.head}>
                    {!a.read && <View style={styles.dot} />}
                    <Text style={[styles.title, a.read && styles.titleRead]}>{a.title}</Text>
                  </View>
                  <Text style={styles.body}>{a.body}</Text>
                  {!!a.published_at && (
                    <Text style={styles.meta}>
                      {new Date(a.published_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  )}
                </Card>
              </Pressable>
            ))
          )}
        </ScrollView>
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
    marginTop: 6,
    marginBottom: 10,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
  scroll: { paddingBottom: Platform.OS === 'web' ? 24 : 110, gap: 10 },
  card: { marginBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.todayGold,
  },
  title: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  titleRead: { fontWeight: '600', color: colors.muted },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    marginTop: 8,
    lineHeight: 22,
  },
  meta: {
    fontFamily: fonts.sub,
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
  },
});
