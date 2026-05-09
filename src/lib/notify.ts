"use client";

// 알림 생성 헬퍼 — notifications 테이블에 row 를 INSERT 하는 4가지 케이스.
//
//   - notifyComment : 누군가 내 글에 댓글
//   - notifyReply   : 누군가 내 댓글에 답글 (+ 인스타 스타일 mention_user_id)
//   - notifyLike    : 누군가 내 글에 좋아요
//   - notifyNotice  : 새 공지사항 (전체 사용자 fan-out, 최대 500명)
//
// 공통 규칙
//   1) 자기 자신에게는 알림을 만들지 않는다 (본인 글에 본인 댓글/좋아요 등).
//   2) 익명 게시판은 actor 닉네임을 "익명" 으로 마스킹한다.
//      대댓글의 경우 익명게시판은 mention_user_id 자체가 NULL 이므로,
//      누구에게 답글인지 식별 불가 → 답글 알림은 만들지 않는다.
//   3) 수신자의 notification_settings(JSONB) 에서 해당 채널이 꺼져 있으면 만들지 않는다.
//      row 가 없거나 컬럼이 NULL 이어도 기본값(true) 으로 동작.
//   4) RLS 정책상 actor (인증된 사용자) 가 직접 INSERT — 트리거 없이 클라이언트가 처리.

import { supabase } from "@/lib/supabase";
import type { BoardType } from "@/lib/board";

// ─────────────────────────────────────────────────────────
// 알림 설정 폴백
// ─────────────────────────────────────────────────────────

type NotificationSettings = {
  onComment: boolean;
  onReply: boolean;
  onLike: boolean;
  onNotice: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  onComment: true,
  onReply: true,
  onLike: true,
  onNotice: true,
};

/**
 * 수신자의 알림 설정을 조회해 해당 채널이 켜져 있는지 확인.
 * profiles row 가 없거나 컬럼이 NULL/부분 누락이어도 기본값(true) 로 폴백.
 */
async function recipientAllows(
  userId: string,
  key: keyof NotificationSettings,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("notification_settings")
      .eq("id", userId)
      .maybeSingle();
    const ns = (data?.notification_settings ??
      null) as Partial<NotificationSettings> | null;
    return ns?.[key] ?? DEFAULT_SETTINGS[key];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

/** 수신자 다중 조회 — fan-out 시 N+1 회피용 */
async function filterRecipientsByChannel(
  userIds: string[],
  key: keyof NotificationSettings,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, notification_settings")
      .in("id", userIds);
    if (error || !data) return userIds; // 조회 실패 시 모두 허용으로 폴백
    return (data as Array<{
      id: string;
      notification_settings: Partial<NotificationSettings> | null;
    }>)
      .filter((r) => (r.notification_settings?.[key] ?? DEFAULT_SETTINGS[key]))
      .map((r) => r.id);
  } catch {
    return userIds;
  }
}

/** 익명 게시판은 actor 닉네임을 "익명" 으로 마스킹. 빈 문자열이면 "누군가". */
function maskActor(nickname: string | null | undefined, boardType: BoardType): string {
  if (boardType === "anonymous") return "익명";
  const trimmed = (nickname ?? "").trim();
  return trimmed || "누군가";
}

// ─────────────────────────────────────────────────────────
// 1) 댓글 알림
// ─────────────────────────────────────────────────────────

export async function notifyComment(input: {
  postId: string;
  commentId: string;
  actorId: string;
  actorNickname: string;
}): Promise<void> {
  try {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id, board_type")
      .eq("id", input.postId)
      .maybeSingle();
    if (!post) return;
    const authorId = post.author_id as string;
    const boardType = post.board_type as BoardType;

    if (!authorId || authorId === input.actorId) return;
    if (!(await recipientAllows(authorId, "onComment"))) return;

    const actor = maskActor(input.actorNickname, boardType);
    const { error } = await supabase.from("notifications").insert({
      user_id: authorId,
      type: "comment",
      message: `${actor}님이 회원님의 글에 댓글을 달았습니다`,
      post_id: input.postId,
      comment_id: input.commentId,
    });
    if (error) console.error("[notifyComment] insert 실패", error);
  } catch (e) {
    console.error("[notifyComment] 예외", e);
  }
}

// ─────────────────────────────────────────────────────────
// 2) 대댓글(답글) 알림
//
//    수신자 후보 (중복 제거, 자기 자신 제외):
//      a) 부모 댓글(=root) 작성자
//      b) mention_user_id (인스타 스타일 답글에서 "@닉네임" 으로 호명한 사용자)
//
//    익명 게시판은 actor/대상 식별이 모두 마스킹되므로 알림을 만들지 않는다.
// ─────────────────────────────────────────────────────────

export async function notifyReply(input: {
  postId: string;
  parentCommentId: string;
  /** 인스타 스타일 답글에서 "@닉네임" 으로 호명한 사용자 (없으면 null). 익명 게시판은 항상 null. */
  mentionUserId: string | null;
  commentId: string;
  actorId: string;
  actorNickname: string;
}): Promise<void> {
  try {
    const { data: post } = await supabase
      .from("posts")
      .select("board_type")
      .eq("id", input.postId)
      .maybeSingle();
    if (!post) return;
    const boardType = post.board_type as BoardType;

    // 익명 게시판은 답글 알림 비대상 (수신자 식별 불가)
    if (boardType === "anonymous") return;

    const { data: parent } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", input.parentCommentId)
      .maybeSingle();
    const parentAuthorId = (parent?.author_id as string | undefined) ?? null;

    // 수신자 후보 — 부모 댓글 작성자 + mention_user_id (자기 자신 제외, 중복 제거)
    const candidates = new Set<string>();
    if (parentAuthorId && parentAuthorId !== input.actorId) {
      candidates.add(parentAuthorId);
    }
    if (input.mentionUserId && input.mentionUserId !== input.actorId) {
      candidates.add(input.mentionUserId);
    }
    if (candidates.size === 0) return;

    const targets = await filterRecipientsByChannel(
      Array.from(candidates),
      "onReply",
    );
    if (targets.length === 0) return;

    const actor = maskActor(input.actorNickname, boardType);
    const message = `${actor}님이 회원님의 댓글에 답글을 달았습니다`;
    const rows = targets.map((uid) => ({
      user_id: uid,
      type: "reply",
      message,
      post_id: input.postId,
      comment_id: input.commentId,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) console.error("[notifyReply] insert 실패", error);
  } catch (e) {
    console.error("[notifyReply] 예외", e);
  }
}

// ─────────────────────────────────────────────────────────
// 3) 좋아요 알림
//
//    좋아요 토글 중 INSERT(=처음 누름) 케이스에서만 호출되어야 한다.
//    취소(DELETE) 시에는 알림을 만들지 않는다 — toggleLike 호출부에서 보장.
// ─────────────────────────────────────────────────────────

export async function notifyLike(input: {
  postId: string;
  actorId: string;
  /** actor 의 표시용 닉네임. 미지정/빈 값이면 profiles 에서 조회. */
  actorNickname?: string | null;
}): Promise<void> {
  try {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id, board_type")
      .eq("id", input.postId)
      .maybeSingle();
    if (!post) return;
    const authorId = post.author_id as string;
    const boardType = post.board_type as BoardType;

    if (!authorId || authorId === input.actorId) return;
    if (!(await recipientAllows(authorId, "onLike"))) return;

    let nickname = input.actorNickname ?? "";
    if (!nickname.trim()) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", input.actorId)
        .maybeSingle();
      nickname = (prof?.nickname as string | undefined) ?? "";
    }

    const actor = maskActor(nickname, boardType);
    const { error } = await supabase.from("notifications").insert({
      user_id: authorId,
      type: "like",
      message: `${actor}님이 회원님의 글을 좋아합니다`,
      post_id: input.postId,
      comment_id: null,
    });
    if (error) console.error("[notifyLike] insert 실패", error);
  } catch (e) {
    console.error("[notifyLike] 예외", e);
  }
}

// ─────────────────────────────────────────────────────────
// 4) 공지사항 알림 — fan-out
//
//    profiles 테이블의 사용자 중 본인 제외 최대 500명에게 INSERT.
//    onNotice 가 켜진 사람만 대상.  500개를 한 번에 INSERT 하면 요청이 너무
//    커지므로 100개씩 청크로 나눠서 보낸다.
// ─────────────────────────────────────────────────────────

const NOTICE_FAN_OUT_LIMIT = 500;
const NOTIFICATIONS_INSERT_CHUNK = 100;

export async function notifyNotice(input: {
  postId: string;
  title: string;
  /** 공지 작성자 — 본인 제외 */
  authorId: string;
}): Promise<void> {
  try {
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, notification_settings")
      .neq("id", input.authorId)
      .limit(NOTICE_FAN_OUT_LIMIT);
    if (error || !rows) {
      if (error) console.error("[notifyNotice] profiles 조회 실패", error);
      return;
    }

    const targets = (rows as Array<{
      id: string;
      notification_settings: Partial<NotificationSettings> | null;
    }>)
      .filter(
        (r) =>
          r.notification_settings?.onNotice ??
          DEFAULT_SETTINGS.onNotice,
      )
      .map((r) => r.id);
    if (targets.length === 0) return;

    const message = `새 공지사항: ${input.title}`;
    const baseRows = targets.map((uid) => ({
      user_id: uid,
      type: "notice",
      message,
      post_id: input.postId,
      comment_id: null,
    }));

    for (let i = 0; i < baseRows.length; i += NOTIFICATIONS_INSERT_CHUNK) {
      const slice = baseRows.slice(i, i + NOTIFICATIONS_INSERT_CHUNK);
      const { error: insErr } = await supabase
        .from("notifications")
        .insert(slice);
      if (insErr) {
        console.error("[notifyNotice] insert 실패 (chunk)", insErr);
        // 한 청크 실패해도 다음 청크는 계속 시도
      }
    }
  } catch (e) {
    console.error("[notifyNotice] 예외", e);
  }
}
