import { InteractionManager } from 'react-native';

const STALE_MS = 30_000;
const lastFetchAt = new Map<string, number>();

/** Defer tab refetch until after transition; skip if data is fresh (<30s). */
export function runTabFocusLoad(
  key: string,
  hasData: boolean,
  load: () => void | Promise<void>,
  opts?: { force?: boolean }
): () => void {
  const now = Date.now();
  const last = lastFetchAt.get(key) || 0;
  const fresh = hasData && now - last < STALE_MS;
  if (!opts?.force && fresh) {
    return () => undefined;
  }

  const task = InteractionManager.runAfterInteractions(() => {
    lastFetchAt.set(key, Date.now());
    void load();
  });

  return () => {
    task.cancel();
  };
}

export function markTabFetched(key: string) {
  lastFetchAt.set(key, Date.now());
}
