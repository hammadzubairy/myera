import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { api } from './api';

type Profile = any;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True until the first profile attempt for the current session finishes (success or fail). */
  profileReady: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<Profile | null>;
  /** Apply a profile already returned by the API (skips sync + get round-trips). */
  applyProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!supabaseConfigured) {
      setProfileReady(true);
      return null;
    }
    setProfileError(null);
    try {
      await withTimeout(api.syncProfile(), 12_000, 'Profile sync');
      const { profile: p } = await withTimeout(api.getProfile(), 12_000, 'Profile fetch');
      setProfile(p);
      setProfileReady(true);
      return p;
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.log('[refreshProfile]', msg);
      setProfileError(msg);
      setProfileReady(true);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setProfileReady(true);
      return;
    }
    let cancelled = false;
    withTimeout(supabase.auth.getSession(), 10_000, 'Auth session')
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
      })
      .catch((e) => {
        console.log('[auth] getSession', e?.message || e);
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      setProfileReady(false);
      refreshProfile();
    } else {
      setProfile(null);
      setProfileError(null);
      setProfileReady(true);
    }
  }, [session?.user?.id, refreshProfile]);

  const applyProfile = useCallback((p: Profile | null) => {
    setProfile(p);
    setProfileError(null);
    setProfileReady(true);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileError(null);
    setProfileReady(true);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileReady,
      profileError,
      refreshProfile,
      applyProfile,
      signOut,
    }),
    [session, profile, loading, profileReady, profileError, refreshProfile, applyProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
