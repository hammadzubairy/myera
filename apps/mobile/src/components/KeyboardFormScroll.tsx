import React, { useEffect, useRef, useState } from 'react';
import {
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  showsVerticalScrollIndicator?: boolean;
};

/**
 * Form scroll that keeps focused fields above the keyboard.
 * iOS: KeyboardAvoidingView padding + automaticallyAdjustKeyboardInsets.
 * Android (edge-to-edge): extra content padding + scroll focused input into view,
 * since adjustResize does not shrink the React root.
 */
export function KeyboardFormScroll({
  children,
  contentContainerStyle,
  style,
  keyboardDismissMode,
  showsVerticalScrollIndicator = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);

  function scrollFocusedIntoView() {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const focused =
      (TextInput.State as { currentlyFocusedInput?: () => unknown }).currentlyFocusedInput?.() ??
      (TextInput.State as { currentlyFocusedField?: () => number | null }).currentlyFocusedField?.();
    if (focused == null) return;

    const targetNode = typeof focused === 'number' ? focused : findNodeHandle(focused as React.Component);
    if (!targetNode) return;

    const responder = (
      scroll as unknown as {
        getScrollResponder?: () => {
          scrollResponderScrollNativeHandleToKeyboard?: (
            node: number,
            offset: number,
            animated: boolean
          ) => void;
        };
      }
    ).getScrollResponder?.();

    // Leave room so the field sits clearly above the keyboard.
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(targetNode, 96, true);
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height ?? 0;
      // Android edge-to-edge: keyboard height overlaps the bottom inset already drawn under content.
      const pad = Platform.OS === 'android' ? Math.max(0, h - insets.bottom) : 0;
      setKeyboardPad(pad);
      // Wait for padding layout, then scroll the focused field up.
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollFocusedIntoView);
      });
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardPad(0));

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [insets.bottom]);

  const flat = StyleSheet.flatten(contentContainerStyle) ?? {};
  const basePadBottom = typeof flat.paddingBottom === 'number' ? flat.paddingBottom : 32;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: basePadBottom + keyboardPad }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
