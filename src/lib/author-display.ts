// 작성자 표시 헬퍼 — 익명 게시판 보호용
//
// 규칙:
//   · board_type === "anonymous"  →  무조건 "익명"
//   · 그 외 게시판  →  profiles.nickname (없으면 "사용자")
//   · 학번+이름 형태(예: "2621주윤")가 닉네임으로 들어 있어도 "사용자" 로 마스킹
//   · 절대 학번/이름/user_id 가 노출되지 않도록 한 곳에서 처리한다.

import type { BoardType } from "@/lib/board";

type AuthorMini = {
  nickname?: string | null;
} | null | undefined;

// 학번+이름 패턴 — 학년/반/번호(보통 4~5자리 숫자) + 한글 이름(2~4자)
//   · "2621주윤", "10401김철수", "30215이영희" 등
//   · 닉네임에 우연히 들어가는 게 아니라 학교 구글 계정 표시 이름 그대로인 경우를 차단
const STUDENT_ID_NAME_PATTERN = /^\d{3,6}[가-힣]{2,4}$/;

/** 닉네임이 학번+이름 형태인지 — true 면 표시 금지 대상 */
export function looksLikeStudentIdName(nickname: string): boolean {
  return STUDENT_ID_NAME_PATTERN.test(nickname.trim());
}

/** 익명 처리가 적용된 작성자 표시명 — UI 의 모든 작성자 라벨은 이 함수를 통과해야 한다. */
export function displayAuthorNameFor(args: {
  boardType: BoardType;
  author: AuthorMini;
}): string {
  if (args.boardType === "anonymous") return "익명";
  const nickname = args.author?.nickname?.trim();
  if (!nickname) return "사용자";
  // 학교 구글 계정의 "학번+이름" 표시명이 그대로 닉네임으로 들어와도 노출 금지
  if (looksLikeStudentIdName(nickname)) return "사용자";
  return nickname;
}

/** 역할(학생/교사/학부모/졸업생) 배지 표시 여부 — 익명 게시판은 항상 false */
export function shouldShowAuthorBadgeFor(boardType: BoardType): boolean {
  return boardType !== "anonymous";
}
