import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, radii } from '../theme';
import { api } from '../lib/api';

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  descriptors?: Record<string, { options?: { title?: string } }>;
  navigation?: any;
};

type IconProps = { color: string; strokeWidth: number };

const TABS: {
  name: string;
  label: string;
  icon: (p: IconProps) => React.ReactNode;
}[] = [
  {
    name: 'today',
    label: 'Today',
    icon: ({ color, strokeWidth: sw }) => (
      <>
        <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={sw} fill="none" />
        <Path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          stroke={color}
          strokeWidth={sw}
          fill="none"
        />
      </>
    ),
  },
  {
    name: 'progress',
    label: 'Progress',
    icon: ({ color, strokeWidth: sw }) => (
      <>
        <Path d="M3 17l5-5 4 3 8-8" stroke={color} strokeWidth={sw} fill="none" />
        <Path d="M15 7h5v5" stroke={color} strokeWidth={sw} fill="none" />
      </>
    ),
  },
  {
    name: 'food',
    label: 'Food',
    icon: ({ color, strokeWidth: sw }) => (
      <>
        <Path d="M4 12h16a8 8 0 0 1-16 0z" stroke={color} strokeWidth={sw} fill="none" />
        <Path d="M9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4" stroke={color} strokeWidth={sw} fill="none" />
      </>
    ),
  },
  {
    name: 'community',
    label: 'Community',
    icon: ({ color, strokeWidth: sw }) => (
      <>
        <Circle cx="9" cy="8" r="3.5" stroke={color} strokeWidth={sw} fill="none" />
        <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" stroke={color} strokeWidth={sw} fill="none" />
        <Circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth={sw} fill="none" />
        <Path d="M16 14.2a5 5 0 0 1 5.5 5.8" stroke={color} strokeWidth={sw} fill="none" />
      </>
    ),
  },
  {
    name: 'me',
    label: 'Me',
    icon: ({ color, strokeWidth: sw }) => (
      <>
        <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={sw} fill="none" />
        <Path d="M4 21a8 8 0 0 1 16 0" stroke={color} strokeWidth={sw} fill="none" />
      </>
    ),
  },
];

const TAB_ROUTES = TABS.map((t) => ({ key: t.name, name: t.name }));

/** Floating tab bar for stack screens (e.g. /dose) that sit outside (tabs). */
export function StandaloneTabBar({ active = 'today' }: { active?: string }) {
  const index = Math.max(
    0,
    TAB_ROUTES.findIndex((r) => r.name === active)
  );
  const navigation = {
    navigate: (name: string) => {
      // Leave any stack screens (search, modals) and land on the tab
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace(`/(tabs)/${name}` as any);
    },
  };
  return (
    <View style={styles.standaloneWrap} pointerEvents="box-none">
      <MyEraTabBar
        state={{ index, routes: TAB_ROUTES }}
        navigation={navigation}
      />
    </View>
  );
}

export function MyEraTabBar({ state, descriptors, navigation }: TabBarProps) {
  const [communityUnread, setCommunityUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const uc = await api.getAnnouncementUnreadCount();
      setCommunityUnread(uc.count || 0);
    } catch {
      /* keep prior */
    }
  }, []);

  const activeName = state.routes[state.index]?.name;

  useEffect(() => {
    // Initial badge + when landing on Community
    if (!activeName || activeName === 'community') {
      loadUnread();
    }
  }, [loadUnread, activeName]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS.find((t) => t.name === route.name);
          const label =
            tab?.label || descriptors?.[route.key]?.options?.title || route.name;
          const strokeWidth = focused ? 2.1 : 1.8;
          const color = focused ? colors.todayCream : colors.todayMuted;
          const showBadge = route.name === 'community' && communityUnread > 0;

          const onPress = () => {
            if (focused) return;
            if (navigation?.navigate) {
              const event = navigation.emit?.({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (event?.defaultPrevented) return;
              navigation.navigate(route.name);
              return;
            }
            router.replace(`/(tabs)/${route.name}` as any);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              hitSlop={focused ? undefined : { top: 10, bottom: 10, left: 8, right: 8 }}
              style={[styles.tabPress, focused && styles.tabPressOn]}
            >
              <View style={[styles.tab, focused && styles.tabOn]}>
                <View>
                  <Svg width={25} height={25} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    {tab?.icon({ color, strokeWidth })}
                  </Svg>
                  {showBadge ? (
                    <View style={[styles.badge, focused && styles.badgeOn]}>
                      <Text style={styles.badgeText}>
                        {communityUnread > 9 ? '9+' : String(communityUnread)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {focused ? (
                  <Text style={styles.label} numberOfLines={1}>
                    {label}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const PILL_H = 52;

const styles = StyleSheet.create({
  standaloneWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  wrap: {
    position: Platform.OS === 'web' ? 'relative' : 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'web' ? 0 : 17,
    zIndex: 50,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'web' ? 14 : 0,
    backgroundColor: Platform.OS === 'web' ? colors.todayBg : 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.todayCream,
    borderRadius: radii.tabBar,
    padding: 6,
    minHeight: 77,
    shadowColor: '#0A2C33',
    shadowOpacity: 0.45,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  tabPress: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  tabPressOn: {
    flexGrow: 2.2,
    flexShrink: 0,
    minWidth: 124,
  },
  tab: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    height: PILL_H,
    paddingHorizontal: 10,
    // Exact half-height radius: Android can't build a rounded outline from an
    // oversized radius (999) and falls back to a square clip/shadow.
    borderRadius: PILL_H / 2,
  },
  tabOn: {
    backgroundColor: colors.todayHero,
    paddingHorizontal: 18,
    borderRadius: PILL_H / 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.todayCream,
    flexShrink: 0,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 99,
    backgroundColor: colors.todayGold,
    borderWidth: 2,
    borderColor: colors.todayCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: {
    borderColor: colors.todayHero,
    top: -7,
    right: -7,
  },
  badgeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    color: colors.todayInk,
    lineHeight: 13,
  },
});
