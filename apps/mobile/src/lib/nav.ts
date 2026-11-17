import { router } from 'expo-router';

/** Safe back — avoids GO_BACK when opened via deep link / direct route (e.g. Playwright). */
export function goBackOr(fallback: string = '/(tabs)/me') {
  try {
    if (typeof (router as any).canGoBack === 'function' && (router as any).canGoBack()) {
      router.back();
      return;
    }
  } catch {
    /* fall through */
  }
  router.replace(fallback as any);
}
