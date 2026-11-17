import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REPORT_REASON_LABELS, type ReportReason } from '@myera/shared';
import Svg, { Path } from 'react-native-svg';
import { PostPhotoGrid } from '../../src/components/PostPhotoGrid';
import { Screen } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { prefetchAnnouncements } from '../../src/lib/announcementsCache';
import { useAuth } from '../../src/lib/auth';
import { notify } from '../../src/lib/notify';
import { runTabFocusLoad } from '../../src/lib/tabFocus';
import { colors, fonts } from '../../src/theme';

const REASONS = Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][];

export default function CommunityScreen() {
  const { profile, user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [reportPost, setReportPost] = useState<any | null>(null);
  const [postMenu, setPostMenu] = useState<any | null>(null);
  const [previewComments, setPreviewComments] = useState<Record<string, any>>({});
  const [reporting, setReporting] = useState(false);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [failedUrls, setFailedUrls] = useState<Record<string, true>>({});
  const [likingIds, setLikingIds] = useState<Record<string, true>>({});
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const load = useCallback(async () => {
    try {
      const [r, uc] = await Promise.all([
        api.getCommunityFeed(),
        api.getAnnouncementUnreadCount().catch(() => ({ count: 0 })),
      ]);
      const list = r.posts || [];
      setPosts(list);
      setUnread(uc.count || 0);

      const map: Record<string, any> = {};
      for (const p of list) {
        if (p.latest_comment) map[p.id] = p.latest_comment;
      }
      setPreviewComments(map);

      // Warm announcements cache so the bell screen opens instantly
      prefetchAnnouncements(async () => {
        const { announcements } = await api.getAnnouncements();
        return announcements || [];
      }).catch(() => undefined);
    } catch (e: any) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      return runTabFocusLoad('community', postsRef.current.length > 0, load);
    }, [load])
  );

  function markUrlFailed(url: string) {
    setFailedUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }

  function openComment(post: any) {
    setCommentingId(post.id);
    setCommentDraft('');
  }

  async function sendComment(postId: string) {
    const body = commentDraft.trim();
    if (!body) return;
    try {
      setCommentSending(true);
      const { comment } = await api.createComment(postId, { body });
      setPreviewComments((prev) => ({ ...prev, [postId]: comment }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
        )
      );
      setCommentDraft('');
      setCommentingId(null);
    } catch (e: any) {
      notify('Comment failed', e.message || String(e));
    } finally {
      setCommentSending(false);
    }
  }

  async function toggleLike(post: any) {
    if (likingIds[post.id]) return;
    const wasLiked = !!post.liked_by_me;
    const prevCount = Number(post.like_count) || 0;
    setLikingIds((prev) => ({ ...prev, [post.id]: true }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !wasLiked,
              like_count: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
            }
          : p
      )
    );
    try {
      if (wasLiked) {
        await api.unlikePost(post.id);
      } else {
        await api.likePost(post.id);
      }
    } catch (e: any) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, liked_by_me: wasLiked, like_count: prevCount }
            : p
        )
      );
      notify('Like failed', e.message || String(e));
    } finally {
      setLikingIds((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
    }
  }

  async function deleteOwn(post: any) {
    try {
      await api.deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e: any) {
      notify('Delete failed', e.message || String(e));
    }
  }

  function confirmDelete(post: any) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Delete this post?')) deleteOwn(post);
      return;
    }
    Alert.alert('Delete post', 'Delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteOwn(post) },
    ]);
  }

  async function submitReport(reason: ReportReason) {
    if (!reportPost) return;
    try {
      setReporting(true);
      await api.reportPost(reportPost.id, { reason, hide_author: false });
      setReportPost(null);
      notify('Reported', 'Our team will review it. The author won’t know who reported.');
    } catch (e: any) {
      notify('Report failed', e.message || String(e));
    } finally {
      setReporting(false);
    }
  }

  async function hidePostsFromAuthor() {
    if (!reportPost) return;
    const authorId = reportPost.author_id;
    if (!authorId) {
      notify('Could not hide', 'Missing author for this post.');
      return;
    }
    try {
      setReporting(true);
      await api.hideMember(authorId);
      setReportPost(null);
      notify('Hidden', `Posts from ${firstName(reportPost.author_name)} won’t show in your feed.`);
      await load();
    } catch (e: any) {
      notify('Could not hide', e.message || String(e));
    } finally {
      setReporting(false);
    }
  }

  function openPostOptions(post: any) {
    if (post.author_id === user?.id) {
      setPostMenu(post);
      return;
    }
    setReportPost(post);
  }

  return (
    <Screen style={{ backgroundColor: colors.communityBg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.communityAccent}
            />
          }
        >
          <View style={styles.top}>
            <Text style={styles.title}>Community</Text>
            <View>
              <Pressable
                style={styles.bellBtn}
                onPress={() => router.push('/announcements')}
                accessibilityLabel="Announcements"
                hitSlop={6}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
                    stroke={colors.communityInk}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Pressable style={styles.composer} onPress={() => router.push('/new-post')}>
            <View style={styles.composerAvatar}>
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.composerAvatarImg} />
              ) : null}
            </View>
            <Text style={styles.composerHint}>Share a win from today</Text>
          </Pressable>

          {posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.empty}>No posts yet. Share a win to get started.</Text>
            </View>
          ) : (
            posts.map((post) => {
              const preview = previewComments[post.id];
              const milestone =
                post.include_weight_change &&
                post.weight_change_lb != null &&
                Math.abs(Number(post.weight_change_lb)) >= 1
                  ? `${Number(post.weight_change_lb) >= 0 ? '−' : '+'}${Math.abs(
                      Number(post.weight_change_lb)
                    )} lb milestone`
                  : null;
              const galleryUrls = (post.photo_urls || []).filter(
                (u: string) => u && !failedUrls[u]
              );
              const beforeOk =
                post.include_before_after &&
                post.before_url &&
                post.after_url &&
                !failedUrls[post.before_url] &&
                !failedUrls[post.after_url];

              return (
                <View key={post.id} style={styles.card}>
                  <View style={styles.authorRow}>
                    <View style={styles.avatar}>
                      {post.author_photo_url ? (
                        <Image
                          source={{ uri: post.author_photo_url }}
                          style={styles.avatarImg}
                          onError={() => markUrlFailed(post.author_photo_url)}
                        />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.authorName} numberOfLines={1}>
                        {post.author_name || 'Member'}
                      </Text>
                      <Text style={styles.time}>{formatPostTime(post.created_at)}</Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => openPostOptions(post)}
                      accessibilityLabel="Post options"
                      style={styles.menuBtn}
                    >
                      <Text style={styles.menuDots}>⋯</Text>
                    </Pressable>
                  </View>

                  {!!milestone && <Text style={styles.milestone}>{milestone}</Text>}

                  <Text style={[styles.body, milestone ? { marginTop: 10 } : { marginTop: 10 }]}>
                    {post.body}
                  </Text>

                  <PostPhotoGrid urls={galleryUrls} onError={markUrlFailed} />

                  {beforeOk ? (
                    <View style={styles.pairBlock}>
                      <Text style={styles.pairLabel}>Before & after</Text>
                      <View style={styles.pairRow}>
                        <Image
                          source={{ uri: post.before_url }}
                          style={styles.pairImg}
                          resizeMode="cover"
                          onError={() => markUrlFailed(post.before_url)}
                        />
                        <Image
                          source={{ uri: post.after_url }}
                          style={styles.pairImg}
                          resizeMode="cover"
                          onError={() => markUrlFailed(post.after_url)}
                        />
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    <Pressable style={styles.actionBtn} onPress={() => toggleLike(post)}>
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
                          stroke={
                            post.liked_by_me ? colors.communityAccent : colors.communityMuted
                          }
                          fill={post.liked_by_me ? colors.communityMilestoneBg : 'none'}
                          strokeWidth={1.8}
                        />
                      </Svg>
                      <Text
                        style={[styles.actionText, post.liked_by_me && styles.liked]}
                      >
                        {post.like_count || 0}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => openComment(post)}>
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M4 5h16v11H9l-5 4z"
                          stroke={colors.communityMuted}
                          strokeWidth={1.8}
                          strokeLinejoin="round"
                        />
                      </Svg>
                      <Text style={styles.actionText}>{post.comment_count || 0}</Text>
                    </Pressable>
                  </View>

                  {!!preview && (
                    <Pressable
                      style={styles.commentInset}
                      onPress={() => router.push(`/post/${post.id}`)}
                    >
                      <View style={styles.commentAvatar}>
                        {preview.author_photo_url && !failedUrls[preview.author_photo_url] ? (
                          <Image
                            source={{ uri: preview.author_photo_url }}
                            style={styles.commentAvatarImg}
                            onError={() => markUrlFailed(preview.author_photo_url)}
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.commentName} numberOfLines={1}>
                          {preview.author_name || 'Member'}
                        </Text>
                        <Text style={styles.commentBody} numberOfLines={3}>
                          {preview.body}
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {commentingId === post.id ? (
                    <View style={styles.commentComposer}>
                      <View style={styles.commentAvatar}>
                        {profile?.photo_url ? (
                          <Image
                            source={{ uri: profile.photo_url }}
                            style={styles.commentAvatarImg}
                          />
                        ) : null}
                      </View>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Write a comment…"
                        placeholderTextColor={colors.communityMuted}
                        value={commentDraft}
                        onChangeText={setCommentDraft}
                        autoFocus
                        multiline
                      />
                      <Pressable
                        style={[
                          styles.commentSend,
                          (!commentDraft.trim() || commentSending) && { opacity: 0.45 },
                        ]}
                        onPress={() => sendComment(post.id)}
                        disabled={!commentDraft.trim() || commentSending}
                      >
                        <Text style={styles.commentSendText}>
                          {commentSending ? '…' : 'Post'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!postMenu} transparent animationType="fade">
        <Pressable style={styles.menuBackdrop} onPress={() => setPostMenu(null)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                const p = postMenu;
                setPostMenu(null);
                confirmDelete(p);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete post</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => setPostMenu(null)}>
              <Text style={[styles.menuItemText, { color: colors.communityMuted }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!reportPost} transparent animationType="fade">
        <Pressable style={styles.reportBackdrop} onPress={() => setReportPost(null)}>
          <Pressable style={styles.reportSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.reportGrab} />
            <Text style={styles.reportTitle}>Report this post</Text>
            <Text style={styles.reportSub}>
              Our team will review it. {firstName(reportPost?.author_name)} won’t know who reported
              it.
            </Text>
            {REASONS.map(([key, label], idx) => (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.reasonRow,
                  idx > 0 && styles.reasonRowBorder,
                  pressed && styles.reasonRowPressed,
                  reporting && { opacity: 0.55 },
                ]}
                android_ripple={{ color: 'rgba(15,61,70,0.12)' }}
                disabled={reporting}
                onPress={() => submitReport(key)}
              >
                <Text style={styles.reasonText}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.hideBtn, reporting && { opacity: 0.55 }]}
              onPress={hidePostsFromAuthor}
              disabled={reporting}
            >
              <Text style={styles.hideBtnText}>
                Hide posts from {firstName(reportPost?.author_name, 'this member')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function firstName(full: string | null | undefined, fallback = 'They') {
  const token = String(full || '')
    .trim()
    .split(/\s+/)[0];
  return token || fallback;
}

function formatPostTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (hours < 48) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'web' ? 120 : 145,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  title: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 29,
    fontWeight: '700',
    color: colors.onBg,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.communityCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.todayGold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    color: colors.communityInk,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    backgroundColor: colors.communityCard,
    borderRadius: 17,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  composerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.communityMilestoneBg,
    overflow: 'hidden',
  },
  composerAvatarImg: { width: 32, height: 32 },
  composerHint: {
    fontFamily: fonts.body,
    color: colors.communityMuted,
    fontSize: 15,
  },
  emptyCard: {
    backgroundColor: colors.communityCard,
    borderRadius: 20,
    padding: 18,
  },
  empty: { fontFamily: fonts.body, color: colors.communityMuted },
  card: {
    backgroundColor: colors.communityCard,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.communityMilestoneBg,
    overflow: 'hidden',
  },
  avatarImg: { width: 38, height: 38 },
  authorName: {
    fontFamily: fonts.body,
    color: colors.communityInk,
    fontWeight: '700',
    fontSize: 15,
  },
  time: {
    fontFamily: fonts.body,
    color: colors.communityMuted,
    fontSize: 12,
    marginTop: 2,
  },
  menuBtn: { paddingHorizontal: 2, paddingVertical: 2 },
  menuDots: {
    fontFamily: fonts.body,
    color: colors.communityMuted,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '600',
  },
  milestone: {
    alignSelf: 'flex-start',
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.communityMilestoneInk,
    backgroundColor: colors.communityMilestoneBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  body: {
    fontFamily: fonts.body,
    color: colors.communityInk,
    lineHeight: 22,
    fontSize: 15,
  },
  pairBlock: { marginTop: 12 },
  pairLabel: {
    fontFamily: fonts.sub,
    fontSize: 12,
    fontWeight: '700',
    color: colors.communityMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pairRow: { flexDirection: 'row', gap: 8 },
  pairImg: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 13,
    backgroundColor: colors.communityCommentBg,
  },
  actions: { flexDirection: 'row', gap: 18, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: {
    fontFamily: fonts.body,
    color: colors.communityMuted,
    fontSize: 14,
  },
  liked: { color: colors.communityAccent },
  commentInset: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
    backgroundColor: colors.communityCommentBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.communityMilestoneBg,
    overflow: 'hidden',
    marginTop: 1,
  },
  commentAvatarImg: { width: 26, height: 26 },
  commentName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.communityInk,
  },
  commentBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.communityInk,
    marginTop: 2,
    lineHeight: 19,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    backgroundColor: colors.communityCommentBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.communityInk,
  },
  commentSend: {
    backgroundColor: colors.communityAccent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentSendText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.communityCard,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 20, 0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.communityCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'web' ? 16 : 32,
  },
  menuItem: { paddingVertical: 16, paddingHorizontal: 20 },
  menuItemText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.communityInk,
  },
  reportBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 20, 0.45)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: colors.reportSheet,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 24 : 34,
  },
  reportGrab: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.reportGrabber,
    marginBottom: 18,
  },
  reportTitle: {
    fontFamily: fonts.body,
    fontSize: 19,
    fontWeight: '700',
    color: colors.reportInk,
  },
  reportSub: {
    fontFamily: fonts.body,
    color: colors.reportMuted,
    fontSize: 14,
    marginTop: 5,
    marginBottom: 8,
    lineHeight: 20,
  },
  reasonRow: {
    minHeight: 46,
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  reasonRowPressed: {
    backgroundColor: 'rgba(15,61,70,0.08)',
  },
  reasonRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.reportDivider,
  },
  reasonText: {
    fontFamily: fonts.body,
    color: colors.reportInk,
    fontSize: 16,
    fontWeight: '500',
  },
  hideBtn: {
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.reportBorder,
    backgroundColor: colors.reportSheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideBtnText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.reportInk,
  },
});
