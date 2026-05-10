// 학교 도메인 — 일반 Google OAuth 사용자(초대 코드 없이) 허용 이메일 도메인
export const ALLOWED_DOMAIN = "moontae.hs.jne.kr";

// 현재 재학생 학번 접두사 — 학생 이메일은 mt + 2자리연도 + 4자리학번 형식
// (예: mt240101@moontae.hs.jne.kr → 24학번)
// 매년 졸업 시 가장 오래된 항목을 빼고 새 입학연도를 추가해야 함.
// 졸업생(mt23 이하)은 초대 코드로만 가입 가능.
export const ALLOWED_STUDENT_PREFIXES = ["mt24", "mt25", "mt26"] as const;

// sessionStorage 키 — OAuth 리다이렉트 왕복 사이에도 유지
export const SS_INVITE_CODE = "inviteCode";
export const SS_INVITE_ROLE = "inviteRole";
