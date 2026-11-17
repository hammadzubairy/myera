import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconBtn, Screen, Title } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { notify } from '../../src/lib/notify';
import { colors, fonts } from '../../src/theme';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api.getComments(id);
      setComments(r.comments || []);
    } catch (e) {
      console.warn(e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function send() {
    if (!text.trim() || !id) return;
    try {
      setLoading(true);
      const { comment } = await api.createComment(id, { body: text.trim() });
      setComments((prev) => [...prev, comment]);
      setText('');
    } catch (e: any) {
      notify('Comment failed', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function remove(commentId: string) {
    try {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e: any) {
      notify('Delete failed', e.message || String(e));
    }
  }

  return (
    <Screen tab="community">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.top}>
            <IconBtn onPress={() => router.back()}>
              <Text style={styles.back}>‹</Text>
            </IconBtn>
            <Title>Comments</Title>
            <View style={{ width: 36 }} />
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={styles.empty}>No comments yet. Be the first.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.avatar}>
                  {item.author_photo_url ? (
                    <Image source={{ uri: item.author_photo_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.letter}>
                      {(item.author_name || '?')[0]?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={styles.bubble}
                  onLongPress={
                    item.author_id === user?.id ? () => remove(item.id) : undefined
                  }
                >
                  <Text style={styles.name}>{item.author_name || 'Member'}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                </Pressable>
              </View>
            )}
          />

          <View style={styles.composer}>
            <View style={styles.avatar}>
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.letter}>
                  {(profile?.full_name || '?')[0]?.toUpperCase()}
                </Text>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Write a comment…"
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              multiline
            />
            <Pressable
              style={[styles.send, (!text.trim() || loading) && { opacity: 0.45 }]}
              onPress={send}
              disabled={!text.trim() || loading}
            >
              <Text style={styles.sendText}>{loading ? '…' : 'Post'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
  empty: { fontFamily: fonts.body, color: colors.onBgMuted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sageSoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarImg: { width: 32, height: 32 },
  letter: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.pine },
  bubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  name: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.todayInk,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.todayInk,
    marginTop: 3,
    lineHeight: 19,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.onBgLine,
    paddingBottom: Platform.OS === 'web' ? 100 : 20,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.todayInk,
  },
  send: {
    backgroundColor: colors.beige,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.onBeige,
  },
});
