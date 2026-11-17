import { Platform } from 'react-native';
import { supabase } from './supabase';

function resolveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3001';
  // Chrome on this PC: LAN IPs often fail; prefer loopback for web
  if (Platform.OS === 'web') {
    try {
      const u = new URL(configured);
      if (u.hostname.startsWith('192.168.') || u.hostname.startsWith('10.')) {
        return `http://127.0.0.1:${u.port || '3001'}`;
      }
    } catch {
      /* keep configured */
    }
  }
  return configured;
}

const API_URL = resolveApiUrl();

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 12_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`Request timed out (${API_URL}). Is the API running?`);
    }
    throw new Error(
      e?.message?.includes('Network') || e?.message?.includes('Failed to fetch')
        ? `Cannot reach API at ${API_URL}`
        : e?.message || 'Network request failed'
    );
  } finally {
    clearTimeout(t);
  }
}

function formatApiError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const e = error as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
    if (e.fieldErrors && typeof e.fieldErrors === 'object') {
      for (const msgs of Object.values(e.fieldErrors)) {
        if (Array.isArray(msgs) && msgs[0]) return String(msgs[0]);
      }
    }
    if (Array.isArray(e.formErrors) && e.formErrors[0]) return String(e.formErrors[0]);
    if ('message' in e && typeof (e as { message?: unknown }).message === 'string') {
      return (e as { message: string }).message;
    }
  }
  return fallback;
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchJson(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(json.error, res.statusText || 'Request failed'));
  }
  return json as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetchJson(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(json.error, res.statusText || 'Request failed'));
  }
  return json as T;
}

export type CloudinaryFolder = 'myera/profiles' | 'myera/progress' | 'myera/posts';

export const api = {
  prepareSignup: (email: string) =>
    publicRequest<{ ok: boolean; reclaimed?: boolean }>('/auth/prepare-signup', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  syncProfile: () => request<{ profile: any }>('/auth/sync-profile', { method: 'POST', body: '{}' }),
  getProfile: () => request<{ profile: any }>('/me/profile'),
  updateProfile: (body: unknown) =>
    request<{ profile: any }>('/me/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  completeOnboarding: (body: unknown) =>
    request<{ profile: any }>('/me/onboarding', { method: 'POST', body: JSON.stringify(body) }),
  getToday: () => request<any>('/me/today'),
  getRegimens: () => request<{ regimens: any[] }>('/doses/regimens'),
  createRegimen: (body: unknown) =>
    request<{ regimen: any }>('/doses/regimens', { method: 'POST', body: JSON.stringify(body) }),
  changeRegimen: (body: unknown) =>
    request<{ regimen: any }>('/doses/regimens/change', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  stopRegimen: (id: string, body: { end_date?: string } = {}) =>
    request<{ regimen: any }>(`/doses/regimens/${encodeURIComponent(id)}/stop`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getDoseLogs: () => request<{ logs: any[] }>('/doses/logs'),
  createDoseLog: (body: unknown) =>
    request<{ log: any }>('/doses/logs', { method: 'POST', body: JSON.stringify(body) }),
  getWeights: () => request<{ logs: any[] }>('/weights'),
  createWeight: (body: unknown) =>
    request<{ log: any }>('/weights', { method: 'POST', body: JSON.stringify(body) }),
  getWeightChart: (range: string) =>
    request<any>(`/weights/chart?range=${encodeURIComponent(range)}`),
  getMeasurementTypes: () => request<{ types: any[] }>('/measurements/types'),
  getMeasurementSummary: () => request<{ measurements: any[] }>('/measurements/summary'),
  createMeasurementType: (body: unknown) =>
    request<{ type: any }>('/measurements/types', { method: 'POST', body: JSON.stringify(body) }),
  createMeasurementLog: (body: unknown) =>
    request<{ log: any }>('/measurements/logs', { method: 'POST', body: JSON.stringify(body) }),
  registerPushToken: (body: unknown) =>
    request('/push/token', { method: 'POST', body: JSON.stringify(body) }),
  getPushPrefs: () => request<{ prefs: any }>('/push/prefs'),
  updatePushPrefs: (body: unknown) =>
    request<{ prefs: any }>('/push/prefs', { method: 'PATCH', body: JSON.stringify(body) }),
  cloudinarySign: (folder: CloudinaryFolder = 'myera/profiles') =>
    request<{
      cloud_name: string;
      api_key: string;
      timestamp: number;
      folder: string;
      signature: string;
    }>('/uploads/cloudinary-sign', {
      method: 'POST',
      body: JSON.stringify({ folder }),
    }),
  uploadImageData: (folder: CloudinaryFolder, image: string) =>
    request<{ url: string; publicId: string }>('/uploads/image', {
      method: 'POST',
      body: JSON.stringify({ folder, image }),
    }),

  // Photos
  getPhotos: () => request<{ photos: any[] }>('/photos'),
  createPhoto: (body: unknown) =>
    request<{ photo: any }>('/photos', { method: 'POST', body: JSON.stringify(body) }),
  updatePhoto: (id: string, body: { url: string; public_id?: string | null }) =>
    request<{ photo: any }>(`/photos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePhoto: (id: string) => request(`/photos/${id}`, { method: 'DELETE' }),

  // Food
  searchFood: (q: string) =>
    request<{ results: any[] }>(`/food/search?q=${encodeURIComponent(q)}`),
  getFoodDay: (date?: string) =>
    request<{ day: any }>(`/food/day${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  createFoodLog: (body: unknown) =>
    request<{ log: any }>('/food/logs', { method: 'POST', body: JSON.stringify(body) }),
  updateFoodLog: (id: string, body: unknown) =>
    request<{ log: any }>(`/food/logs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFoodLog: (id: string) => request(`/food/logs/${id}`, { method: 'DELETE' }),
  setCalorieGoal: (calorie_goal_kcal: number) =>
    request<{ profile: any }>('/food/goal', {
      method: 'PATCH',
      body: JSON.stringify({ calorie_goal_kcal }),
    }),

  // Community
  getCommunityFeed: () => request<{ community: any; posts: any[] }>('/community/feed'),
  createPost: (body: unknown) =>
    request<{ post: any }>('/community/posts', { method: 'POST', body: JSON.stringify(body) }),
  deletePost: (id: string) => request(`/community/posts/${id}`, { method: 'DELETE' }),
  likePost: (id: string) =>
    request(`/community/posts/${id}/like`, { method: 'POST', body: '{}' }),
  unlikePost: (id: string) => request(`/community/posts/${id}/like`, { method: 'DELETE' }),
  getComments: (id: string) =>
    request<{ comments: any[] }>(`/community/posts/${id}/comments`),
  createComment: (id: string, body: unknown) =>
    request<{ comment: any }>(`/community/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteComment: (id: string) => request(`/community/comments/${id}`, { method: 'DELETE' }),
  reportPost: (id: string, body: unknown) =>
    request(`/community/posts/${id}/report`, { method: 'POST', body: JSON.stringify(body) }),
  hideMember: (hidden_user_id: string) =>
    request('/community/hide-member', {
      method: 'POST',
      body: JSON.stringify({ hidden_user_id }),
    }),

  // Shot schedule
  getShotSchedule: () => request<{ schedule: any }>('/shot-schedule'),
  upsertShotSchedule: (body: unknown) =>
    request<{ schedule: any }>('/shot-schedule', { method: 'PUT', body: JSON.stringify(body) }),
  snoozeShot: (hours = 1) =>
    request<{ schedule: any }>('/shot-schedule/snooze', {
      method: 'POST',
      body: JSON.stringify({ hours }),
    }),

  // Injection-day schedules (per product)
  getInjectionSchedules: () => request<{ schedules: any[] }>('/injection-schedules'),
  createInjectionSchedule: (body: unknown) =>
    request<{ schedule: any }>('/injection-schedules', { method: 'POST', body: JSON.stringify(body) }),
  updateInjectionSchedule: (id: string, body: unknown) =>
    request<{ schedule: any }>(`/injection-schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteInjectionSchedule: (id: string) =>
    request<{ ok: boolean }>(`/injection-schedules/${id}`, { method: 'DELETE' }),

  // Announcements
  getAnnouncements: () => request<{ announcements: any[] }>('/announcements'),
  getAnnouncementUnreadCount: () => request<{ count: number }>('/announcements/unread-count'),
  getPinnedAnnouncement: () => request<{ announcement: any | null }>('/announcements/pinned'),
  markAnnouncementRead: (id: string) =>
    request(`/announcements/${id}/read`, { method: 'POST', body: '{}' }),

  // Account
  deleteAccount: () => request<{ ok: boolean }>('/account', { method: 'DELETE' }),
};

async function uriToDataUrl(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that photo'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export async function uploadImage(
  uri: string,
  folder: CloudinaryFolder = 'myera/profiles',
  base64?: string | null,
  mimeType?: string | null
): Promise<{ url: string; publicId: string }> {
  let image = '';
  if (base64) {
    const raw = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const mime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    image = `data:${mime};base64,${raw}`;
  } else {
    image = await uriToDataUrl(uri);
  }
  if (!image.startsWith('data:image/')) {
    throw new Error('Could not read that photo');
  }
  try {
    return await api.uploadImageData(folder, image);
  } catch (first: any) {
    // One retry for flaky Cloudinary / network
    try {
      return await api.uploadImageData(folder, image);
    } catch (second: any) {
      throw new Error(second?.message || first?.message || 'Photo upload failed');
    }
  }
}

/** @deprecated use uploadImage */
export async function uploadProfilePhoto(uri: string): Promise<{ url: string; publicId: string }> {
  return uploadImage(uri, 'myera/profiles');
}
