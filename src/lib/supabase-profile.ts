"use client";

// Supabase 인증 사용자 + profiles 테이블 row 를 함께 다루는 훅 모음.
// 기존 lib/profile.ts (localStorage 기반 dev 프로필) 와는 별개로 동작한다.

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type SupabaseProfile = {
  id: string;
  nickname: string;
  created_at: string;
};

/** 현재 Supabase 세션의 사용자. 미로그인 시 null */
export function useSupabaseUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUser(data.user ?? null);
      })
      .catch(() => {
        // env 미설정 등으로 클라이언트 초기화 실패 시: 미로그인 상태로 처리
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    let unsubscribe: (() => void) | null = null;
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    } catch {
      // ignore
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return { user, loading };
}

/** profiles 테이블의 본인 row. 없으면 null */
export function useSupabaseProfile(): {
  user: User | null;
  profile: SupabaseProfile | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user, loading: userLoading } = useSupabaseUser();
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, created_at")
        .eq("id", uid)
        .maybeSingle();
      setProfile((data as SupabaseProfile | null) ?? null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    fetchProfile(user.id);
  }, [user, fetchProfile]);

  const refetch = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  return { user, profile, loading: userLoading || profileLoading, refetch };
}

/** profiles 테이블에 닉네임 upsert */
export async function saveNickname(
  userId: string,
  nickname: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, nickname }, { onConflict: "id" });
  return { error: error?.message ?? null };
}

/** 구글 OAuth 메타데이터에서 사용자가 보여줄 만한 이름을 뽑는다 */
export function pickDisplayName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const candidates = [
    meta?.full_name,
    meta?.name,
    meta?.user_name,
    meta?.preferred_username,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  // 이메일 로컬파트로 폴백
  const email = user.email ?? "";
  return email.split("@")[0] ?? "";
}
