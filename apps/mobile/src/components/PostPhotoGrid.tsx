import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Renders 1–3 post photos. Never invents extra images. */
export function PostPhotoGrid({
  urls,
  onError,
}: {
  urls: string[];
  onError?: (url: string) => void;
}) {
  const list = (urls || []).filter(Boolean).slice(0, 3);
  if (!list.length) return null;

  if (list.length === 1) {
    return (
      <Image
        source={{ uri: list[0] }}
        style={styles.one}
        resizeMode="cover"
        onError={() => onError?.(list[0])}
      />
    );
  }

  if (list.length === 2) {
    return (
      <View style={styles.row}>
        {list.map((url) => (
          <Image
            key={url}
            source={{ uri: url }}
            style={styles.half}
            resizeMode="cover"
            onError={() => onError?.(url)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.three}>
      <Image
        source={{ uri: list[0] }}
        style={styles.threeTop}
        resizeMode="cover"
        onError={() => onError?.(list[0])}
      />
      <View style={styles.row}>
        <Image
          source={{ uri: list[1] }}
          style={styles.half}
          resizeMode="cover"
          onError={() => onError?.(list[1])}
        />
        <Image
          source={{ uri: list[2] }}
          style={styles.half}
          resizeMode="cover"
          onError={() => onError?.(list[2])}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  one: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 13,
    marginTop: 12,
    backgroundColor: colors.communityCommentBg,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  half: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 13,
    backgroundColor: colors.communityCommentBg,
  },
  three: { marginTop: 12, gap: 0 },
  threeTop: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 13,
    backgroundColor: colors.communityCommentBg,
  },
});
