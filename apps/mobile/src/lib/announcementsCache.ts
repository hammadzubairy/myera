/** Shared cache so Community can prefetch before the Announcements screen opens. */
let cached: any[] | null = null;
let inflight: Promise<any[]> | null = null;

export function getCachedAnnouncements(): any[] | null {
  return cached;
}

export function setCachedAnnouncements(items: any[]) {
  cached = items;
}

export async function prefetchAnnouncements(fetcher: () => Promise<any[]>): Promise<any[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const items = await fetcher();
      cached = items;
      return items;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
