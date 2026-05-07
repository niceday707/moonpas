// 초대 코드 형식: 소문자 1개 + 숫자 4개 (총 5자, 예: a2957)
// /admin 페이지에서 코드 자동 생성 시 사용한다.

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** 형식 검증: 소문자 1자 + 숫자 4자 */
export const INVITE_CODE_REGEX = /^[a-z][0-9]{4}$/;

/** 새 초대 코드 1개 생성 */
export function generateInviteCode(): string {
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${letter}${num}`;
}

/** 중복 없이 n개 생성 */
export function generateInviteCodes(n: number): string[] {
  const set = new Set<string>();
  // 36만 가지 → 작은 n 에서는 충돌이 거의 없지만 안전하게 루프
  while (set.size < n) {
    set.add(generateInviteCode());
  }
  return Array.from(set);
}

/** 입력값 정규화 — 공백/대소문자 차이를 제거 */
export function normalizeInviteCode(input: string): string {
  return input.trim().toLowerCase();
}
