"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 사용자 프로필 스토어
// localStorage 에 저장되는 단일 사용자(=ME) 프로필.
// 닉네임/프로필 이미지 변경 시 mock-data 의 ME 객체에 즉시 반영해서
// 게시판·댓글 등 모든 화면이 함께 갱신되도록 한다.
//
// Supabase 연동 시 이 파일 한 곳만 교체하면 전체 프로필 흐름이 동작한다.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import type { Role } from "@/components/ui/Badge";
import { setMyNickname, setMyProfileImage } from "@/lib/mock-data";

const STORAGE_KEY = "moonpas:profile";

export type UserProfile = {
  /** 화면에 노출되는 닉네임 */
  nickname: string;
  /** 사용자 역할 — 학생/교사/학부모/졸업생 */
  role: Role;
  /** 프로필 이미지 (data URL). 없으면 이니셜 아바타 */
  profileImage: string | null;
  /** 마지막으로 닉네임을 변경한 시각 (ISO). null 이면 한 번도 변경한 적 없음 → 쿨다운 없음 */
  lastNicknameChange: string | null;
};

// 개발 모드 기본값. Supabase 연동 후엔 실제 사용자 데이터로 대체된다.
const DEFAULT_PROFILE: UserProfile = {
  nickname: "김민준",
  role: "student",
  profileImage: null,
  lastNicknameChange: null,
};

let current: UserProfile = { ...DEFAULT_PROFILE };
let hydrated = false;

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    current = { ...DEFAULT_PROFILE, ...parsed };
    // 저장된 값으로 mock-data ME 동기화
    setMyNickname(current.nickname);
    setMyProfileImage(current.profileImage);
  } catch {
    // localStorage 실패는 조용히 무시 (시크릿 모드 등)
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

const listeners = new Set<() => void>();
function notifyProfile(): void {
  listeners.forEach((fn) => fn());
}

/** 프로필 변경 구독 (React 외부에서 사용) */
export function subscribeProfile(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 현재 프로필 스냅샷을 React 컴포넌트에서 구독 */
export function useProfile(): UserProfile {
  const [snap, setSnap] = useState<UserProfile>(current);

  useEffect(() => {
    hydrate();
    setSnap(current);
    return subscribeProfile(() => setSnap(current));
  }, []);

  return snap;
}

// ─────────────────────────────────────────────
// 닉네임 유효성 검사
// ─────────────────────────────────────────────

// 한글 완성형 + 영문 + 숫자, 2~10자
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,10}$/;

// 매우 가벼운 욕설 필터 — 추후 보강 예정.
const PROFANITY_LIST = [
  "씨발",
  "시발",
  "병신",
  "개새",
  "fuck",
  "shit",
  "asshole",
];

// 운영자 사칭 방지용 예약어
const RESERVED_NICKNAMES = [
  "관리자",
  "운영자",
  "매니저",
  "admin",
  "moderator",
  "moonpas",
  "문파스",
];

// 더미 중복 체크용 — 실제로는 Supabase 쿼리로 교체될 예정.
const DUMMY_TAKEN_NICKNAMES = [
  "김민수",
  "박철수",
  "이영희",
  "tester",
  "테스터",
];

export type ValidationError =
  | "empty"
  | "length"
  | "charset"
  | "profanity"
  | "reserved"
  | "duplicate"
  | "same"
  | "cooldown";

export const ERROR_MESSAGES: Record<ValidationError, string> = {
  empty: "닉네임을 입력해주세요.",
  length: "닉네임은 2~10자여야 해요.",
  charset: "한글, 영문, 숫자만 사용할 수 있어요.",
  profanity: "사용할 수 없는 단어가 포함되어 있어요.",
  reserved: "사용할 수 없는 닉네임이에요.",
  duplicate: "이미 사용 중인 닉네임이에요.",
  same: "지금 쓰고 있는 닉네임과 같아요.",
  // 쿨다운 정책 폐지 — 이 값은 더 이상 반환되지 않지만 타입 호환성을 위해 키만 유지.
  cooldown: "",
};

/** 형식·금칙어만 검사 (서버 통신 없이 즉시 판정). 통과하면 null */
export function validateNicknameFormat(name: string): ValidationError | null {
  const trimmed = name.trim();
  if (!trimmed) return "empty";
  if (trimmed.length < 2 || trimmed.length > 10) return "length";
  if (!NICKNAME_REGEX.test(trimmed)) return "charset";

  const lower = trimmed.toLowerCase();
  if (PROFANITY_LIST.some((w) => lower.includes(w.toLowerCase())))
    return "profanity";
  if (RESERVED_NICKNAMES.some((w) => lower === w.toLowerCase()))
    return "reserved";

  return null;
}

/** 더미 중복 체크. true 면 사용 가능. */
function isNicknameAvailable(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return !DUMMY_TAKEN_NICKNAMES.some((w) => w.toLowerCase() === lower);
}

// ─────────────────────────────────────────────
// 닉네임 쿨다운 — 폐지. 언제든 변경 가능.
// (`nicknameCooldownDaysLeft` 는 외부에서 import 되고 있으므로 0 만 반환.)
// ─────────────────────────────────────────────

/** 닉네임 변경까지 남은 일수. 쿨다운 정책 폐지로 항상 0 을 반환한다. */
export function nicknameCooldownDaysLeft(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  profile: UserProfile = current,
): number {
  return 0;
}

/** 한 번도 변경한 적 없는 최초 설정 상태인지 */
export function isInitialNicknameSetup(
  profile: UserProfile = current,
): boolean {
  return profile.lastNicknameChange === null;
}

// ─────────────────────────────────────────────
// 변경 함수
// ─────────────────────────────────────────────

type UpdateResult =
  | { ok: true }
  | { ok: false; error: ValidationError };

/**
 * 닉네임 변경 시도. 쿨다운 정책은 폐지됐으므로 형식·중복·동일 닉네임 검사만 수행한다.
 */
export async function attemptUpdateNickname(name: string): Promise<UpdateResult> {
  hydrate();
  const trimmed = name.trim();

  const formatErr = validateNicknameFormat(trimmed);
  if (formatErr) return { ok: false, error: formatErr };

  const initialSetup = isInitialNicknameSetup();
  if (!initialSetup && trimmed === current.nickname) {
    return { ok: false, error: "same" };
  }

  // 서버 응답 흉내내기
  await new Promise((r) => setTimeout(r, 380));

  if (!isNicknameAvailable(trimmed)) return { ok: false, error: "duplicate" };

  current = {
    ...current,
    nickname: trimmed,
    lastNicknameChange: new Date().toISOString(),
  };
  persist();
  setMyNickname(trimmed);
  notifyProfile();
  return { ok: true };
}

/** 프로필 이미지 업데이트 (data URL 또는 null) */
export async function attemptUpdateProfileImage(
  imageUrl: string | null,
): Promise<void> {
  hydrate();
  await new Promise((r) => setTimeout(r, 200));
  current = { ...current, profileImage: imageUrl };
  persist();
  setMyProfileImage(imageUrl);
  notifyProfile();
}

/** 개발용 — 프로필 전체 초기화 (테스트 시 사용) */
export function resetProfileForDev(): void {
  current = { ...DEFAULT_PROFILE };
  persist();
  setMyNickname(current.nickname);
  setMyProfileImage(current.profileImage);
  notifyProfile();
}
