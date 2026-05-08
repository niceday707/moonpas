"use client";

// @멘션 자동완성 + 저장 유틸.
//   - getActiveMention: 텍스트 + 캐럿 위치에서 현재 입력 중인 @토큰 추출
//   - searchMentionableUsers: search_mentionable_users RPC 호출 (Supabase)
//   - parseMentionNicknames: 댓글 텍스트에서 @닉네임 패턴 모두 추출
//   - saveMentionsAndNotify: 댓글 저장 후 mentions/notifications 행 삽입

import { supabase } from "@/lib/supabase";
import type { Role } from "@/components/ui/Badge";

export type MentionUser = {
  id: string;
  nickname: string;
  role: Role;
  avatar_url: string | null;
  is_commenter: boolean;
  starts_with: boolean;
  last_active: string;
};

// 닉네임 허용 문자: 한글 완성형 + 영문 + 숫자 (NicknameSetupModal 과 동일 규칙)
const NICKNAME_CHAR_RE = /[가-힣a-zA-Z0-9]/;
const NICKNAME_TOKEN_RE = /^[가-힣a-zA-Z0-9]{0,30}$/;
const MENTION_PATTERN_RE = /@([가-힣a-zA-Z0-9]{2,10})/g;

/**
 * 현재 입력 중인 @토큰을 찾는다.
 * - 캐럿 바로 앞에서부터 거꾸로 스캔하여 @를 만나면 그 사이를 query 로 반환.
 * - @ 앞이 문자열 시작이거나 공백이어야 mention 으로 인정 (이메일 @ 회피).
 * - 닉네임 허용 문자 외 문자가 끼면 즉시 종료.
 */
export function getActiveMention(
  text: string,
  caret: number,
): { query: string; start: number; end: number } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      const before = i === 0 ? "" : text[i - 1];
      if (i === 0 || /\s/.test(before)) {
        const query = text.slice(i + 1, caret);
        if (!NICKNAME_TOKEN_RE.test(query)) return null;
        return { query, start: i, end: caret };
      }
      return null;
    }
    if (!NICKNAME_CHAR_RE.test(ch) && !/\s/.test(ch)) return null;
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

/** Supabase RPC 호출 — 검색 결과를 우선순위로 정렬해 반환 */
export async function searchMentionableUsers(input: {
  query: string;
  postId: string;
  currentUserId: string;
}): Promise<MentionUser[]> {
  const { data, error } = await supabase.rpc("search_mentionable_users", {
    p_query: input.query,
    p_post_id: input.postId,
    p_current_user_id: input.currentUserId,
  });
  if (error) {
    console.error("[searchMentionableUsers] RPC 실패", error);
    return [];
  }
  return (data as MentionUser[]) ?? [];
}

/** 댓글 본문에서 @닉네임 패턴을 모두 추출 (중복 제거) */
export function parseMentionNicknames(content: string): string[] {
  const nicknames: string[] = [];
  const seen = new Set<string>();
  for (const m of content.matchAll(MENTION_PATTERN_RE)) {
    const n = m[1];
    if (!seen.has(n)) {
      seen.add(n);
      nicknames.push(n);
    }
  }
  return nicknames;
}

/**
 * 댓글 저장 후 호출 — 본문에서 @닉네임 추출 → profiles 조회 →
 * 실제 존재하는 유저에 대해 mentions / notifications 행 삽입.
 *
 * 자기 자신을 멘션한 경우는 알림 생성하지 않음 (자가 알림 방지).
 */
export async function saveMentionsAndNotify(input: {
  commentId: string;
  postId: string;
  authorId: string;
  authorNickname: string;
  content: string;
}): Promise<void> {
  const nicknames = parseMentionNicknames(input.content);
  if (nicknames.length === 0) return;

  try {
    const { data: users, error: lookupErr } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("nickname", nicknames);
    if (lookupErr) {
      console.error("[saveMentionsAndNotify] profiles 조회 실패", lookupErr);
      return;
    }
    const targets = (users ?? []).filter(
      (u) => u.id !== input.authorId,
    ) as { id: string; nickname: string }[];
    if (targets.length === 0) return;

    const mentionRows = targets.map((u) => ({
      comment_id: input.commentId,
      mentioned_user_id: u.id,
    }));
    const { error: mErr } = await supabase
      .from("mentions")
      .insert(mentionRows);
    if (mErr) {
      console.error("[saveMentionsAndNotify] mentions insert 실패", mErr);
      // 알림은 시도 — 멘션 기록만 실패한 것일 수도 있음
    }

    const message = `${input.authorNickname}님이 댓글에서 회원님을 언급했습니다`;
    const notifRows = targets.map((u) => ({
      user_id: u.id,
      type: "mention",
      message,
      post_id: input.postId,
      comment_id: input.commentId,
    }));
    const { error: nErr } = await supabase
      .from("notifications")
      .insert(notifRows);
    if (nErr) {
      console.error("[saveMentionsAndNotify] notifications insert 실패", nErr);
    }
  } catch (e) {
    console.error("[saveMentionsAndNotify] 예외", e);
  }
}
