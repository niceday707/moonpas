"use client";

// Supabase 세션 기반 실제 인증 훅. 더 이상 dev 모드 우회 없음.
import { useSupabaseUser } from "@/lib/supabase-profile";

// 호환성을 위해 남겨두지만 항상 false.
export const IS_DEV_MODE = false;

export function useAuth(): {
  isLoggedIn: boolean;
  isDevMode: boolean;
  loading: boolean;
} {
  const { user, loading } = useSupabaseUser();
  return { isLoggedIn: !!user, isDevMode: false, loading };
}

/** 로그인 페이지로 이동 (Google OAuth 진입점) */
export function attemptGoogleLogin() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/** 로그아웃 후 메인으로 */
export async function attemptLogout() {
  if (typeof window === "undefined") return;
  const { supabase } = await import("@/lib/supabase");
  await supabase.auth.signOut();
  window.location.href = "/";
}
