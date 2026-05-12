"use client";

// 알림 생성 헬퍼 — /api/notifications/create (service_role) 를 통해 INSERT.
//
//   - notifyComment : 누군가 내 글에 댓글
//   - notifyReply   : 누군가 내 댓글에 답글
//   - notifyLike    : 누군가 내 글에 좋아요
//   - notifyNotice  : 새 공지사항 (전체 사용자 fan-out, 최대 500명)
//
// 왜 서버 API 경유인가:
//   브라우저에서 supabase anon key 로 직접 INSERT 하면:
//     1) actor_id FK 위반 (profiles row 미생성 엣지케이스) → silent fail
//     2) RLS INSERT 정책 변경 이력에 따른 불안정
//     3) 에러가 브라우저 콘솔에만 남아 추적 불가
//   /api/notifications/create 에서 service_role key 로 처리함으로써 해결.
//
// 공통 규칙
//   1) 수신자의 notification_settings 에서 해당 채널이 꺼져 있으면 생성 안 함.
//   2) 익명 게시판은 actor 닉네임을 "익명" 으로 마스킹.
//      대댓글의 경우 익명게시판은 answer_user_id 자체가 NULL 이므로 알림 생성 안 함.
//   3) RLS 정책상 직접 INSERT 대신 서버 API 경유.

import { supabase } from "@/lib/supabase";

type BoardType = string;

// ─────────────────────────────────────────────────────────
// 내부 헬퍼: 세션 토큰
// ─────────────────────────────────────────────────────────

async function getSessionToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 내부 헬퍼: 서버 API 를 통해 알림 INSERT
//   /api/notifications/create 에서 service_role key 로 RLS 우회 INSERT
// ─────────────────────────────────────────────────────────

type NotifRow = {
  user_id: string;
  type: string;
  message: string;
  post_id?: string | null;
  comment_id?: string | null;
  actor_id?: string | null;
};

async function createNotifications(token: string, rows: NotifRow[]): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    const res = await fetch("/api/notifications/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error("[createNotifications] API 실패", res.status, j);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[createNotifications] fetch 오류", e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// 푸시 알림 발송 헬퍼 (fire-and-forget)
// ─────────────────────────────────────────────────────────

function sendPush(userIds: string[], title: string, body: string, link: string): void {
  if (userIds.length === 0) return;
  supabase.auth.getSession().then(({ data: { session } }) => {
    const token = session?.access_token;
    if (!token) return;
    fetch("/api/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userIds, title, body, link }),
    }).catch(() => {});
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────
// 알림 설정 폴백
// ─────────────────────────────────────────────────────────

type NotificationSettings = {
  onComment: boolean;
  onReply: boolean;
  onLike: boolean;
  onNotice: boolean;
  // 028 추가 — 게시판별 새 글 알림.
  // onNotice 는 하위호환을 위해 유지하지만 새 코드는 onSchoolNotice 사용.
  onCommunity: boolean;
  onEta: boolean;
  onChallenge: boolean;
  onAlumni: boolean;
  onSchoolNotice: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  onComment: true,
  onReply: true,
  onLike: true,
  onNotice: true,
  onCommunity: true,
  onEta: true,
  onChallenge: true,
  onAlumni: true,
  onSchoolNotice: true,
};

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
    const ns = (data?.notification_settings ?? null) as Partial<NotificationSettings> | null;
    return ns?.[key] ?? DEFAULT_SETTINGS[key];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

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
    if (error || !data) return userIds;
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
    const token = await getSessionToken();
    if (!token) return;

    const { data: post } = await supabase
      .from("posts")
      .select("author_id, board_type")
      .eq("id", input.postId)
      .maybeSingle();
    if (!post) return;
    const authorId = post.author_id as string;
    const boardType = post.board_type as BoardType;

    if (!authorId) return;
    if (!(await recipientAllows(authorId, "onComment"))) return;

    const actor = maskActor(input.actorNickname, boardType);
    const msg = `${actor}님이 회원님의 글에 댓글을 달았습니다`;
    const ok = await createNotifications(token, [{
      user_id:    authorId,
      actor_id:   input.actorId,
      type:       "comment",
      message:    msg,
      post_id:    input.postId,
      comment_id: input.commentId,
    }]);
    if (ok) sendPush([authorId], "문파스 댓글 알림", msg, `/board/free/${input.postId}`);
  } catch (e) {
    console.error("[notifyComment] 예외", e);
  }
}

// ─────────────────────────────────────────────────────────
// 2) 대댓글(답글) 알림
//    익명 게시판은 actor/대상 식별이 마스킹되므로 알림을 만들지 않는다.
// ─────────────────────────────────────────────────────────

export async function notifyReply(input: {
  postId: string;
  parentCommentId: string;
  mentionUserId: string | null;
  commentId: string;
  actorId: string;
  actorNickname: string;
}): Promise<void> {
  try {
    const token = await getSessionToken();
    if (!token) return;

    const { data: post } = await supabase
      .from("posts")
      .select("board_type")
      .eq("id", input.postId)
      .maybeSingle();
    if (!post) return;
    const boardType = post.board_type as BoardType;

    if (boardType === "anonymous") return;

    const { data: parent } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", input.parentCommentId)
      .maybeSingle();
    const parentAuthorId = (parent?.author_id as string | undefined) ?? null;

    const candidates = new Set<string>();
    if (parentAuthorId) candidates.add(parentAuthorId);
    if (input.mentionUserId) candidates.add(input.mentionUserId);
    if (candidates.size === 0) return;

    const targets = await filterRecipientsByChannel(Array.from(candidates), "onReply");
    if (targets.length === 0) return;

    const actor = maskActor(input.actorNickname, boardType);
    const message = `${actor}님이 회원님의 댓글에 답글을 달았습니다`;
    const ok = await createNotifications(token, targets.map((uid) => ({
      user_id:    uid,
      actor_id:   input.actorId,
      type:       "reply",
      message,
      post_id:    input.postId,
      comment_id: input.commentId,
    })));
    if (ok) sendPush(targets, "문파스 답글 알림", message, `/board/free/${input.postId}`);
  } catch (e) {
    console.error("[notifyReply] 예외", e);
  }
}

// ─────────────────────────────────────────────────────────
// 3) 좋아요 알림
//    toggleLike 에서 INSERT(=처음 누름) 케이스에서만 호출.
// ─────────────────────────────────────────────────────────

export async function notifyLike(input: {
  postId: string;
  actorId: string;
  actorNickname?: string | null;
}): Promise<void> {
  try {
    const token = await getSessionToken();
    if (!token) return;

    const { data: post } = await supabase
      .from("posts")
      .select("author_id, board_type")
      .eq("id", input.postId)
      .maybeSingle();
    if (!post) return;
    const authorId = post.author_id as string;
    const boardType = post.board_type as BoardType;

    if (!authorId) return;
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
    const msg = `${actor}님이 회원님의 글을 좋아합니다`;
    const ok = await createNotifications(token, [{
      user_id:    authorId,
      actor_id:   input.actorId,
      type:       "like",
      message:    msg,
      post_id:    input.postId,
      comment_id: null,
    }]);
    if (ok) sendPush([authorId], "문파스 좋아요 알림", msg, `/board/free/${input.postId}`);
  } catch (e) {
    console.error("[notifyLike] 예외", e);
  }
}

// ─────────────────────────────────────────────────────────
// 4) 공지사항 알림 — fan-out (레거시, onSchoolNotice 키 사용)
//    profiles 의 본인 제외 최대 500명에게 알림.
//    하위호환을 위해 함수는 유지하되 필터 키만 onSchoolNotice 로 갱신.
//    신규 호출부는 notifyNewPost 사용 권장.
// ─────────────────────────────────────────────────────────

const NOTICE_FAN_OUT_LIMIT = 500;

export async function notifyNotice(input: {
  postId: string;
  title: string;
  authorId: string;
}): Promise<void> {
  try {
    const token = await getSessionToken();
    if (!token) return;

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
      .filter((r) => r.notification_settings?.onSchoolNotice ?? DEFAULT_SETTINGS.onSchoolNotice)
      .map((r) => r.id);
    if (targets.length === 0) return;

    const message = `새 공지사항: ${input.title}`;
    const notifRows: NotifRow[] = targets.map((uid) => ({
      user_id:    uid,
      actor_id:   input.authorId,
      type:       "notice",
      message,
      post_id:    input.postId,
      comment_id: null,
    }));

    const ok = await createNotifications(token, notifRows);
    if (ok) sendPush(targets, "문파스 공지", message, `/board/notice/${input.postId}`);
  } catch (e) {
    console.error("[notifyNotice] 예외", e);
  }
}

// ─────────────────────────────────────────────────────────
// 5) 게시판별 새 글 알림 — fan-out
//    boardType 에 따라 notification_settings 의 어떤 키를 확인할지 매핑.
//    매핑에 없는 boardType 은 알림 생성하지 않음.
// ─────────────────────────────────────────────────────────

/**
 * board_type → notification_settings 키 매핑.
 * 매핑에 없는 board_type 은 null (알림 안 보냄).
 */
export function getBoardNotificationKey(
  boardType: string,
): keyof NotificationSettings | null {
  switch (boardType) {
    // 커뮤니티 — 자유롭게 글이 쌓이는 게시판
    case "free":
    case "lost":
    case "market":
    case "debate":
    case "qa":
    case "guess_who":
      return "onCommunity";
    // 문태 에타 (완전 익명 게시판)
    case "anonymous":
      return "onEta";
    // 학생 챌린지 — 챌린지 메인 글 + 인증 글 모두 포함
    case "challenge":
      return "onChallenge";
    // 문태 교우 (졸업생 관련 게시판)
    case "alumni":
    case "alumni_news":
    case "senior":
      return "onAlumni";
    // 학교 알림 (운영진 공지사항)
    case "notice":
      return "onSchoolNotice";
    // 그 외 (college / curriculum / council / youtube / resources /
    // study / news / event_*) — 새 글 알림 대상 아님
    default:
      return null;
  }
}

export async function notifyNewPost(input: {
  postId: string;
  title: string;
  authorId: string;
  boardType: string;
}): Promise<void> {
  try {
    const settingKey = getBoardNotificationKey(input.boardType);
    if (!settingKey) return;

    const token = await getSessionToken();
    if (!token) return;

    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, notification_settings")
      .neq("id", input.authorId)
      .limit(NOTICE_FAN_OUT_LIMIT);
    if (error || !rows) {
      if (error) console.error("[notifyNewPost] profiles 조회 실패", error);
      return;
    }

    const targets = (rows as Array<{
      id: string;
      notification_settings: Partial<NotificationSettings> | null;
    }>)
      .filter(
        (r) =>
          r.notification_settings?.[settingKey] ??
          DEFAULT_SETTINGS[settingKey],
      )
      .map((r) => r.id);
    if (targets.length === 0) return;

    const message = `새 글: ${input.title}`;
    const notifRows: NotifRow[] = targets.map((uid) => ({
      user_id:    uid,
      actor_id:   input.authorId,
      type:       settingKey === "onSchoolNotice" ? "notice" : "post",
      message,
      post_id:    input.postId,
      comment_id: null,
    }));

    const ok = await createNotifications(token, notifRows);
    if (ok) {
      // /board/challenge/{postId} 는 [challengeId] 라우트와 충돌해서
      // 챌린지는 챌린지 상세로 보내는 게 자연스럽지만, fan-out 알림은
      // 다양한 컨텍스트(메인 글/인증 글)가 섞이므로 일반 라우팅으로 통일한다.
      const link =
        input.boardType === "challenge"
          ? `/board/challenge/${input.postId}`
          : `/board/${input.boardType}/${input.postId}`;
      sendPush(targets, "문파스 새 글", message, link);
    }
  } catch (e) {
    console.error("[notifyNewPost] 예외", e);
  }
}
