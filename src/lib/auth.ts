"use client";

// ──────────────────────────────────────────────────────────────────────
// 개발 모드 토글
// true  → 로그인 체크 우회. 모든 페이지에 자유롭게 접근 가능하고
//         글쓰기·댓글 등 로그인 필요 기능도 모두 동작한다.
//         단, AuthGate로 감싼 페이지 상단에는 노란색 안내 배너가 노출된다.
// false → 실제 로그인 체크 작동. (Supabase 연동 후 false로 변경)
// ──────────────────────────────────────────────────────────────────────
export const IS_DEV_MODE = true;

// 임시 인증 훅 — Supabase 연동 전까지는 IS_DEV_MODE 값으로 로그인 여부를 흉내낸다.
// Supabase 연동 후엔 이 파일 한 곳만 교체하면 전체 게이트가 동작한다.
export function useAuth(): { isLoggedIn: boolean; isDevMode: boolean } {
  return { isLoggedIn: IS_DEV_MODE, isDevMode: IS_DEV_MODE };
}

// 구글 로그인 시도 — 아직 Supabase 미연동이므로 안내만 띄운다.
export function attemptGoogleLogin() {
  if (typeof window !== "undefined") {
    window.alert("Supabase 연동 후 사용 가능합니다");
  }
}
