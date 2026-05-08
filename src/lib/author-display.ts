// 작성자 표시 헬퍼 — 익명 게시판 보호용
//
// 규칙:
//   · board_type === "anonymous"  →  무조건 "익명"
//   · 그 외 게시판  →  profiles.nickname (없으면 "사용자")
//   · 절대 학번/이름/user_id 가 노출되지 않도록 한 곳에서 처리한다.

import type { BoardType } from "@/lib/board";

type AuthorMini = {
  nickname?: string | null;
} | null | undefined;

/** 익명 처리가 적용된 작성자 표시명 — UI 의 모든 작성자 라벨은 이 함수를 통과해야 한다. */
export function displayAuthorNameFor(args: {
  boardType: BoardType;
  author: AuthorMini;
}): string {
  if (args.boardType === "anonymous") return "익명";
  const nickname = args.author?.nickname?.trim();
  return nickname && nickname.length > 0 ? nickname : "사용자";
}

/** 역할(학생/교사/학부모/졸업생) 배지 표시 여부 — 익명 게시판은 항상 false */
export function shouldShowAuthorBadgeFor(boardType: BoardType): boolean {
  return boardType !== "anonymous";
}
