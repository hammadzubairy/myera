import React from 'react';
import { Tabs } from 'expo-router';
import { MyEraTabBar } from '../../src/components/TabBar';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <MyEraTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Keep scenes opaque on the app green so a fade never flashes white.
        freezeOnBlur: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.todayBg },
        transitionSpec: {
          animation: 'timing',
          config: { duration: 280 },
        },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="food" options={{ title: 'Food' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
