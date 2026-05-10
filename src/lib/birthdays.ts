"use client";

// 생일자 조회 헬퍼 — profiles(실제 가입 유저) + birthday_registry(관리자 등록)
// 두 출처를 같은 BirthdayPerson 형식으로 합쳐서 노출.
//
//  · profiles  → 닉네임 그대로 표시 + 실제 user.id (축하 메시지 receiver_id 로 사용)
//  · registry  → "[학년]-[반] [이름]" / "교사 [이름]" 형식. 메시지 송신은 불가.

import { supabase } from "@/lib/supabase";
import type { Role } from "@/components/ui/Badge";

export type BirthdaySource = "profile" | "registry";

/** KST 기준 오늘 Date (시간은 시스템 로컬과 다를 수 있으나 월/일 추출용으로만 사용) */
export function getKstToday(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
}

/**
 * KST 오늘에서 ±delta 일 떨어진 (month, day) 반환. 월/연 경계 처리.
 *   예) 1월 1일 + (-2) → {month: 12, day: 30}
 */
export function shiftKstDay(delta: number): { month: number; day: number } {
  const today = getKstToday();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + delta);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * 여러 delta 에 대응하는 (month, day) 배열. 중복 제거 없이 그대로 반환.
 *   예) deltas=[-2,-1,0,1] → 4 일치
 */
export function getKstDayRange(
  deltas: number[],
): Array<{ month: number; day: number }> {
  return deltas.map((d) => shiftKstDay(d));
}

/**
 * 생일자 통합 타입.
 *   source=profile  → id 가 실제 user UUID
 *   source=registry → id 가 `registry-${row.id}` synthetic key,
 *                      registryRowId 에 birthday_registry.id (number) 보관
 */
export type BirthdayPerson = {
  source: BirthdaySource;
  id: string;
  displayName: string;
  role: Role | null;
  avatar_url: string | null;
  birth_month: number;
  birth_day: number;
  /** registry 출처일 때만 — birthday_messages.registry_id 에 넣을 실제 행 id */
  registryRowId?: number;
};

export type BirthdayRegistryRow = {
  id: number;
  grade: number;
  class: number;
  name: string;
  birth_month: number;
  birth_day: number;
  created_at: string;
};

/**
 * registry 한 행의 표시명.
 *   grade=0  → "교사 [이름]"
 *   grade=99 → "[이름]" (직접입력. 행사명 등)
 *   그 외     → "[학년]-[반] [이름]"
 */
export function registryDisplayName(row: {
  grade: number;
  class: number;
  name: string;
}): string {
  if (row.grade === 99) return row.name;
  if (row.grade === 0) return `교사 ${row.name}`;
  return `${row.grade}-${row.class} ${row.name}`;
}

function registryToPerson(row: BirthdayRegistryRow): BirthdayPerson {
  return {
    source: "registry",
    id: `registry-${row.id}`,
    registryRowId: row.id,
    displayName: registryDisplayName(row),
    // 색상용: 교사/직접입력은 보라, 그 외 파란 그라데이션이 자연스럽다.
    role: row.grade === 0 || row.grade === 99 ? "teacher" : "student",
    avatar_url: null,
    birth_month: row.birth_month,
    birth_day: row.birth_day,
  };
}

type ProfileRow = {
  id: string;
  nickname: string | null;
  role: Role | null;
  avatar_url: string | null;
  birth_month: number | null;
  birth_day: number | null;
};

function profileToPerson(row: ProfileRow): BirthdayPerson | null {
  if (row.birth_month == null || row.birth_day == null) return null;
  const nickname = (row.nickname ?? "").trim();
  if (!nickname) return null;
  return {
    source: "profile",
    id: row.id,
    displayName: nickname,
    role: row.role,
    avatar_url: row.avatar_url,
    birth_month: row.birth_month,
    birth_day: row.birth_day,
  };
}

/** 여러 (월, 일) 조합의 생일자 한 번에 조회 — profiles + registry 통합. */
export async function fetchBirthdaysOnDays(
  days: Array<{ month: number; day: number }>,
): Promise<BirthdayPerson[]> {
  if (days.length === 0) return [];
  const orFilter = days
    .map((d) => `and(birth_month.eq.${d.month},birth_day.eq.${d.day})`)
    .join(",");

  const [profileRes, registryRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, role, avatar_url, birth_month, birth_day")
      .or(orFilter)
      .limit(200),
    supabase
      .from("birthday_registry")
      .select("*")
      .or(orFilter)
      .limit(200),
  ]);

  if (profileRes.error)
    console.warn("[birthdays] profiles 조회 실패", profileRes.error);
  if (registryRes.error)
    console.warn("[birthdays] registry 조회 실패", registryRes.error);

  const profilePeople = ((profileRes.data ?? []) as ProfileRow[])
    .map(profileToPerson)
    .filter((p): p is BirthdayPerson => !!p);
  const registryPeople = ((registryRes.data ?? []) as BirthdayRegistryRow[]).map(
    registryToPerson,
  );

  return [...profilePeople, ...registryPeople];
}

/** 특정 월의 생일자 한 번에 조회 — profiles + registry 통합. birth_day ASC. */
export async function fetchBirthdaysOfMonth(
  month: number,
): Promise<BirthdayPerson[]> {
  const [profileRes, registryRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, role, avatar_url, birth_month, birth_day")
      .eq("birth_month", month)
      .order("birth_day", { ascending: true })
      .limit(200),
    supabase
      .from("birthday_registry")
      .select("*")
      .eq("birth_month", month)
      .order("birth_day", { ascending: true })
      .limit(200),
  ]);

  if (profileRes.error)
    console.warn("[birthdays] profiles 조회 실패", profileRes.error);
  if (registryRes.error)
    console.warn("[birthdays] registry 조회 실패", registryRes.error);

  const profilePeople = ((profileRes.data ?? []) as ProfileRow[])
    .map(profileToPerson)
    .filter((p): p is BirthdayPerson => !!p);
  const registryPeople = ((registryRes.data ?? []) as BirthdayRegistryRow[]).map(
    registryToPerson,
  );

  return [...profilePeople, ...registryPeople].sort(
    (a, b) => a.birth_day - b.birth_day,
  );
}
