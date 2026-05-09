"use client";

// Supabase 인증 사용자 + profiles 테이블 row 를 함께 다루는 훅 모음.
// 기존 lib/profile.ts (localStorage 기반 dev 프로필) 와는 별개로 동작한다.

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/components/ui/Badge";

export type SupabaseProfile = {
  id: string;
  nickname: string;
  role: Role;
  avatar_url: string | null;
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

/**
 * profiles 테이블의 본인 row.
 * - row 가 실제로 없는 경우와 fetch 자체가 실패한 경우(네트워크/RLS)를 분리해야 한다.
 *   둘을 합쳐서 null 로 처리하면 호출 측에서 "row 없음 → 신규 가입" 으로 오인하고
 *   닉네임 모달을 띄워 기존 row 를 덮어쓰는 사고가 난다 (실제 발생한 사례 있음).
 */
export function useSupabaseProfile(): {
  user: User | null;
  profile: SupabaseProfile | null;
  /** fetch 단계에서 발생한 에러. row 가 없을 뿐인 경우엔 null. */
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user, loading: userLoading } = useSupabaseUser();
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, role, avatar_url, created_at")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        // 네트워크 / RLS / 권한 등 — row 부재가 아니라 "조회 실패".
        // profile 상태는 기존 값을 유지(null 일 수 있음)하되 절대 신규로 오인되지 않도록
        // error 를 별도로 노출한다.
        console.error("[useSupabaseProfile] fetch 실패", error);
        setProfileError(error.message);
        return;
      }
      setProfileError(null);
      setProfile((data as SupabaseProfile | null) ?? null);
    } catch (e) {
      console.error("[useSupabaseProfile] fetch 예외", e);
      setProfileError(e instanceof Error ? e.message : String(e));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    fetchProfile(user.id);
  }, [user, fetchProfile]);

  const refetch = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  return {
    user,
    profile,
    error: profileError,
    loading: userLoading || profileLoading,
    refetch,
  };
}

/**
 * 최초 가입 시 profiles row 를 생성한다 — INSERT only, upsert 아님.
 *
 * 과거 구현(saveNickname)은 .upsert({id, nickname, role}, {onConflict:'id'})
 * 였는데, 닉네임 모달이 어떤 이유로든 기존 사용자에게 다시 열리면
 * 본인의 nickname/role 이 통째로 덮어써졌다 (admin 가 student 로 강등되는 사고).
 * 이제는 INSERT 가 23505(unique violation) 로 거부되면 호출 측이 "이미 존재함"
 * 으로 안전하게 분기할 수 있다.
 *
 * 반환:
 *   - { error: null }                                 → 신규 INSERT 성공
 *   - { error: '...', alreadyExists: true }           → 이미 row 가 있음 (덮어쓰기 방지)
 *   - { error: '...' , alreadyExists: false }         → 그 외 실패
 */
export async function createInitialProfile(
  userId: string,
  nickname: string,
  role: Role,
): Promise<{ error: string | null; alreadyExists: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: userId, nickname, role })
    .select()
    .maybeSingle();

  if (error) {
    const code = (error as unknown as { code?: string }).code;
    const alreadyExists = code === "23505";
    console.error("[createInitialProfile] insert 실패", {
      userId,
      nickname,
      role,
      message: error.message,
      code,
      alreadyExists,
    });
    return { error: error.message, alreadyExists };
  }

  console.log("[createInitialProfile] insert 성공", data);
  return { error: null, alreadyExists: false };
}

/**
 * 본인 profiles.nickname 만 변경. role / avatar_url / created_at 등 다른 컬럼은
 * 절대 건드리지 않는다. 중복 검사는 호출 측 또는 updateNicknameInDb 가 담당.
 */
export async function updateMyNickname(
  userId: string,
  nickname: string,
): Promise<{ error: string | null }> {
  const trimmed = nickname.trim();
  if (!trimmed) {
    return { error: "닉네임을 입력해주세요." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ nickname: trimmed })
    .eq("id", userId);
  if (error) {
    console.error("[updateMyNickname] update 실패", {
      userId,
      nickname: trimmed,
      message: error.message,
    });
  }
  return { error: error?.message ?? null };
}

/** 닉네임 변경 결과 — 호출 측에서 사용자에게 보여줄 메시지를 분기하기 위함 */
export type UpdateNicknameResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "unauthorized" | "network" | "unknown"; message: string };

/**
 * profiles.nickname 변경.
 * - 쿨다운 없음 — 언제든 호출 가능
 * - 중복 검사: ILIKE 로 대소문자 무시, 자기 자신은 제외(.neq id)
 * - UPDATE 가 0행 영향이면 RLS 차단 또는 row 부재로 보고 unauthorized 처리
 */
export async function updateNicknameInDb(
  userId: string,
  nickname: string,
): Promise<UpdateNicknameResult> {
  const trimmed = nickname.trim();
  if (!trimmed) {
    return { ok: false, reason: "unknown", message: "닉네임을 입력해주세요." };
  }

  // 1) 중복 검사 — 대소문자/공백 차이로 자기 자신과 충돌하지 않도록 .neq("id", userId)
  try {
    const { data: dup, error: dupErr } = await supabase
      .from("profiles")
      .select("id")
      .ilike("nickname", trimmed)
      .neq("id", userId)
      .limit(1);
    if (dupErr) {
      console.error("[updateNicknameInDb] 중복 검사 실패", dupErr);
      // 중복 검사 실패해도 UPDATE 자체는 시도 — DB 의 unique 제약이 있다면 거기서 잡힘
    } else if (dup && dup.length > 0) {
      return {
        ok: false,
        reason: "duplicate",
        message: "이미 사용 중인 닉네임이에요.",
      };
    }
  } catch (e) {
    console.error("[updateNicknameInDb] 중복 검사 예외", e);
  }

  // 2) 실제 UPDATE — 본인 row 만 (RLS 가 차단하면 0행 영향)
  const { data, error } = await supabase
    .from("profiles")
    .update({ nickname: trimmed })
    .eq("id", userId)
    .select("id, nickname")
    .maybeSingle();

  if (error) {
    console.error("[updateNicknameInDb] UPDATE 실패", {
      userId,
      nickname: trimmed,
      message: error.message,
      code: (error as unknown as { code?: string }).code,
      details: (error as unknown as { details?: string }).details,
      hint: (error as unknown as { hint?: string }).hint,
    });
    // Postgres unique violation
    const code = (error as unknown as { code?: string }).code;
    if (code === "23505") {
      return {
        ok: false,
        reason: "duplicate",
        message: "이미 사용 중인 닉네임이에요.",
      };
    }
    return {
      ok: false,
      reason: "network",
      message: `닉네임 변경에 실패했어요.\n${error.message}`,
    };
  }

  if (!data) {
    // RLS 가 막았거나 row 가 없는 경우 — 0행 영향
    console.warn("[updateNicknameInDb] 0행 영향 (RLS 차단 또는 row 부재)", {
      userId,
    });
    return {
      ok: false,
      reason: "unauthorized",
      message:
        "닉네임을 변경할 권한이 없어요. 다시 로그인 후 시도해주세요.",
    };
  }

  console.log("[updateNicknameInDb] 성공", data);
  return { ok: true };
}

/** profiles.avatar_url 업데이트. null 이면 기본 아바타로 되돌림 */
export async function saveAvatarUrl(
  userId: string,
  avatarUrl: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);
  if (error) {
    console.error("[saveAvatarUrl] update 실패", { userId, message: error.message });
  }
  return { error: error?.message ?? null };
}

/** 구글 OAuth 메타데이터에서 사용자가 보여줄 만한 이름을 뽑는다.
 *  단, "2621주윤" 같은 학번+이름 형태는 닉네임 폴백으로 부적절하므로 빈 문자열을 돌려준다. */
export function pickDisplayName(user: User | null): string {
  if (!user) return "";
  const STUDENT_ID_NAME_PATTERN = /^\d{3,6}[가-힣]{2,4}$/;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const candidates = [
    meta?.full_name,
    meta?.name,
    meta?.user_name,
    meta?.preferred_username,
  ];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const trimmed = c.trim();
    if (!trimmed) continue;
    if (STUDENT_ID_NAME_PATTERN.test(trimmed)) continue; // 학번+이름은 폴백 거부
    return trimmed;
  }
  const email = user.email ?? "";
  const local = email.split("@")[0] ?? "";
  if (STUDENT_ID_NAME_PATTERN.test(local)) return "";
  return local;
}
