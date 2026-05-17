"use client";

// ============================================================================
// 문태 미디어(MoonTube) — Supabase 데이터 헬퍼
// ----------------------------------------------------------------------------
// moontube_items / moontube_likes / moontube_saves / moontube_comments CRUD.
//
// 데이터 흐름:
//  · 피드:        listMoontubeItems() — visible/auto_approved 만, 최신순.
//  · 수동 등록:   createMoontubeItem() — RLS 가 source='manual' /
//                 review_status='visible' / created_by=auth.uid() 강제.
//  · 좋아요/저장: toggle* — likes/saves INSERT/DELETE 만. like_count 등 집계는
//                 DB 트리거(SECURITY DEFINER)가 moontube_items 에 자동 반영.
//  · 댓글:        list/create/deleteComment — 작성자 프로필 embed.
//
// ⚠️ 영상 내용 최종 검수는 사람의 몫(DECISIONS.md). 등록 시 muntz-profanity 의
//    findBannedWordInFields 로 제목/설명/댓글을 1차 차단한다(호출 측 + 여기).
// ============================================================================

import { supabase } from "@/lib/supabase";
import { findBannedWordInFields } from "@/lib/muntz-profanity";
import {
  normalizeGradeLabel,
  youtubeThumbnailUrl,
  type MoontubeItem,
  type MoontubeVideoType,
} from "@/lib/moontube-data";
import type { Role } from "@/components/ui/Badge";

// ─── DB row 타입 ─────────────────────────────────────────────────────────────
type MoontubeItemRow = {
  id: string;
  youtube_id: string;
  youtube_url: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  author_nickname: string;
  video_type: MoontubeVideoType;
  category: string;
  target_grade: string;
  description: string | null;
  safety_note: string | null;
  source: "manual" | "youtube_auto";
  review_status: MoontubeItem["reviewStatus"];
  like_count: number;
  save_count: number;
  view_count: number;
  comment_count: number;
  created_by: string | null;
  created_at: string;
};

function rowToItem(row: MoontubeItemRow): MoontubeItem {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    youtubeUrl: row.youtube_url,
    title: row.title,
    channelTitle: row.channel_title ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? youtubeThumbnailUrl(row.youtube_id),
    authorNickname: row.author_nickname,
    videoType: row.video_type,
    category: row.category,
    targetGrade: normalizeGradeLabel(row.target_grade),
    description: row.description ?? "",
    safetyNote: row.safety_note ?? undefined,
    source: row.source,
    reviewStatus: row.review_status,
    likeCount: row.like_count ?? 0,
    saveCount: row.save_count ?? 0,
    viewCount: row.view_count ?? 0,
    commentCount: row.comment_count ?? 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    isFallback: false,
  };
}

/** 현재 로그인 사용자 id (미로그인/실패 시 null) */
async function getUid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// ─── 조회 ─────────────────────────────────────────────────────────────────────

export type MoontubeFilter = {
  videoType?: MoontubeVideoType;
  category?: string;
  limit?: number;
};

/** 피드 조회 — visible/auto_approved 만 최신 등록순. 실패 시 빈 배열. */
export async function listMoontubeItems(
  filter: MoontubeFilter = {},
): Promise<MoontubeItem[]> {
  let q = supabase
    .from("moontube_items")
    .select("*")
    .in("review_status", ["visible", "auto_approved"])
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.videoType) q = q.eq("video_type", filter.videoType);
  if (filter.category) q = q.eq("category", filter.category);

  const { data, error } = await q;
  if (error) {
    console.error("[listMoontubeItems] 실패", error);
    return [];
  }
  return ((data ?? []) as MoontubeItemRow[]).map(rowToItem);
}

// ─── 수동 등록 ────────────────────────────────────────────────────────────────

export type MoontubeCreateInput = {
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  authorNickname: string;
  videoType: MoontubeVideoType;
  category: string;
  /** 라벨 또는 키 — 저장 전 라벨로 정규화 */
  targetGrade: string;
  description?: string;
  channelTitle?: string;
};

export type MoontubeCreateResult =
  | { ok: true; item: MoontubeItem }
  | {
      ok: false;
      reason: "unauthorized" | "duplicate" | "validation" | "network";
      message: string;
    };

/**
 * 학생/교사 수동 등록 (롱폼/쇼츠 공통).
 * RLS 가 source='manual' / review_status='visible' / created_by=auth.uid()
 * 를 강제하므로 클라이언트가 이 값을 위조해도 거부된다.
 */
export async function createMoontubeItem(
  input: MoontubeCreateInput,
  authorId: string,
): Promise<MoontubeCreateResult> {
  const title = input.title.trim();
  const nickname = input.authorNickname.trim();
  const description = input.description?.trim() || null;

  // 1차 금지어 차단 (사후 검수 보조)
  const banned = findBannedWordInFields([title, description, nickname]);
  if (banned) {
    return {
      ok: false,
      reason: "validation",
      message: `부적절한 단어가 포함되어 있어요: "${banned}"`,
    };
  }

  const row = {
    youtube_id: input.youtubeId,
    youtube_url: input.youtubeUrl,
    title,
    channel_title: input.channelTitle?.trim() || null,
    thumbnail_url: youtubeThumbnailUrl(input.youtubeId),
    author_nickname: nickname,
    video_type: input.videoType,
    category: input.category,
    target_grade: normalizeGradeLabel(input.targetGrade),
    description,
    source: "manual" as const,
    review_status: "visible" as const,
    created_by: authorId,
  };

  const { data, error } = await supabase
    .from("moontube_items")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    const code = (error as unknown as { code?: string }).code;
    const msg = error.message ?? "";
    console.error("[createMoontubeItem] insert 실패", { message: msg, code });

    if (code === "23505" || msg.includes("moontube_items_youtube_id")) {
      return {
        ok: false,
        reason: "duplicate",
        message: "이미 등록된 영상이에요.",
      };
    }
    if (msg.includes("row-level security") || msg.includes("violates")) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "등록 권한이 없습니다. 다시 로그인 후 시도해주세요.",
      };
    }
    return {
      ok: false,
      reason: "network",
      message: `등록에 실패했습니다.\n${msg}`,
    };
  }

  return { ok: true, item: rowToItem(data as MoontubeItemRow) };
}

// ─── fallback → DB 자동 등록 (좋아요/댓글 인터랙션 시 호출) ─────────────────
// fallback(API 자동 수집된 데모) 영상은 moontube_items 에 행이 없어 좋아요/댓글
// 의 item_id 외래키가 안 잡힌다. 사용자가 fallback 에 인터랙션을 시도하는 순간
// 이 함수가 실제 DB row 를 만들고 그 id 를 돌려준다. 이후 인터랙션은 그 id 로.
//
//  · SELECT-first: 동일 youtube_id 가 이미 있으면 그 row 의 id 를 그대로 반환.
//    한 명이 promote 해두면 모든 사용자가 같은 row 를 공유한다.
//  · INSERT 는 로그인 사용자만(RLS 강제 — source='manual'/review_status='visible'
//    /created_by=auth.uid()). 미로그인이면 ok:false → 호출 측이 기존 fallback
//    동작(로컬 더미)으로 폴백.
//  · 동시 클릭으로 인한 unique 충돌(23505) 은 다시 SELECT 해 합치된 id 회수.

export type EnsureMoontubeItemInput = {
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  channelTitle?: string;
  authorNickname: string;
  videoType: MoontubeVideoType;
  category: string;
  /** 라벨 또는 키 — 저장 전 라벨로 정규화 */
  targetGrade: string;
  description?: string;
};

export async function ensureMoontubeItem(
  input: EnsureMoontubeItemInput,
): Promise<{ ok: true; id: string } | { ok: false }> {
  // 1) 이미 DB 에 있는지 먼저 확인 (anon 도 가능)
  {
    const { data, error } = await supabase
      .from("moontube_items")
      .select("id")
      .eq("youtube_id", input.youtubeId)
      .maybeSingle();
    if (!error && data) {
      return { ok: true, id: (data as { id: string }).id };
    }
  }

  // 2) 없으면 새로 INSERT — RLS 통과를 위해 로그인 + manual/visible 강제
  const uid = await getUid();
  if (!uid) return { ok: false };

  const row = {
    youtube_id: input.youtubeId,
    youtube_url: input.youtubeUrl,
    title: input.title,
    channel_title: input.channelTitle ?? null,
    thumbnail_url: youtubeThumbnailUrl(input.youtubeId),
    author_nickname: input.authorNickname,
    video_type: input.videoType,
    category: input.category,
    target_grade: normalizeGradeLabel(input.targetGrade),
    description: input.description ?? null,
    source: "manual" as const,
    review_status: "visible" as const,
    created_by: uid,
  };

  const { data, error } = await supabase
    .from("moontube_items")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    // 동시 promote 로 인한 unique 충돌 → 다시 SELECT
    const code = (error as unknown as { code?: string }).code;
    if (code === "23505") {
      const { data: again } = await supabase
        .from("moontube_items")
        .select("id")
        .eq("youtube_id", input.youtubeId)
        .maybeSingle();
      if (again) return { ok: true, id: (again as { id: string }).id };
    }
    console.error("[ensureMoontubeItem] 실패", error);
    return { ok: false };
  }
  return { ok: true, id: (data as { id: string }).id };
}

/** 문제 영상 숨김 — review_status='hidden'. 본인/admin 만 (RLS 강제). */
export async function hideMoontubeItem(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase
    .from("moontube_items")
    .update({ review_status: "hidden" })
    .eq("id", id);
  if (error) {
    console.error("[hideMoontubeItem] 실패", { id, message: error.message });
    return {
      ok: false,
      message: "숨김 처리에 실패했습니다 (권한이 없거나 네트워크 오류).",
    };
  }
  return { ok: true, message: "숨김 처리되었습니다." };
}

// ─── 좋아요 / 저장 토글 ──────────────────────────────────────────────────────
// 카운트는 DB 트리거가 유지 → 여기서는 likes/saves 행만 넣고 뺀다.
// 반환된 최종 상태로 호출 측이 낙관적 UI 를 확정/롤백한다.

async function toggleReaction(
  table: "moontube_likes" | "moontube_saves",
  itemId: string,
): Promise<{ ok: boolean; active: boolean }> {
  const uid = await getUid();
  if (!uid) return { ok: false, active: false };

  // 현재 상태 확인
  const { data: existing, error: selErr } = await supabase
    .from(table)
    .select("id")
    .eq("item_id", itemId)
    .eq("user_id", uid)
    .maybeSingle();

  if (selErr) {
    console.error(`[toggleReaction:${table}] 조회 실패`, selErr);
    return { ok: false, active: false };
  }

  if (existing) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (error) {
      console.error(`[toggleReaction:${table}] delete 실패`, error);
      return { ok: false, active: true };
    }
    return { ok: true, active: false };
  }

  const { error } = await supabase
    .from(table)
    .insert({ item_id: itemId, user_id: uid });
  if (error) {
    // 동시 클릭으로 인한 unique 충돌은 "이미 눌림" 으로 간주
    const code = (error as unknown as { code?: string }).code;
    if (code === "23505") return { ok: true, active: true };
    console.error(`[toggleReaction:${table}] insert 실패`, error);
    return { ok: false, active: false };
  }
  return { ok: true, active: true };
}

/** 좋아요 토글 — { ok, liked } */
export async function toggleLike(
  itemId: string,
): Promise<{ ok: boolean; liked: boolean }> {
  const r = await toggleReaction("moontube_likes", itemId);
  return { ok: r.ok, liked: r.active };
}

/** 저장 토글 — { ok, saved } */
export async function toggleSave(
  itemId: string,
): Promise<{ ok: boolean; saved: boolean }> {
  const r = await toggleReaction("moontube_saves", itemId);
  return { ok: r.ok, saved: r.active };
}

/** 현재 사용자의 좋아요/저장 상태 일괄 조회 */
export async function getMyReactions(
  itemIds: string[],
): Promise<{ liked: Set<string>; saved: Set<string> }> {
  const empty = { liked: new Set<string>(), saved: new Set<string>() };
  const uid = await getUid();
  if (!uid || itemIds.length === 0) return empty;

  const [likeRes, saveRes] = await Promise.all([
    supabase
      .from("moontube_likes")
      .select("item_id")
      .eq("user_id", uid)
      .in("item_id", itemIds),
    supabase
      .from("moontube_saves")
      .select("item_id")
      .eq("user_id", uid)
      .in("item_id", itemIds),
  ]);

  const liked = new Set<string>();
  const saved = new Set<string>();
  if (!likeRes.error) {
    for (const r of (likeRes.data ?? []) as { item_id: string }[]) {
      liked.add(r.item_id);
    }
  }
  if (!saveRes.error) {
    for (const r of (saveRes.data ?? []) as { item_id: string }[]) {
      saved.add(r.item_id);
    }
  }
  return { liked, saved };
}

/** 조회수 +1 (SECURITY DEFINER RPC). 실패해도 조용히 무시 — 통계 보조용. */
export async function bumpView(itemId: string): Promise<void> {
  try {
    await supabase.rpc("moontube_bump_view", { p_item_id: itemId });
  } catch (e) {
    console.warn("[bumpView] 실패(무시)", e);
  }
}

// ─── 댓글 ─────────────────────────────────────────────────────────────────────

export type MoontubeComment = {
  id: string;
  itemId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  likeCount: number;
  /** 이 댓글이 호명한 사용자 id (멘션 알림/포커싱 용) */
  mentionUserId: string | null;
  author: {
    id: string;
    nickname: string;
    role: Role;
    avatarUrl: string | null;
  } | null;
  /** 내가 쓴 댓글인지 */
  isMine: boolean;
  /** 삭제 버튼 노출 여부 — 본인 또는 admin */
  canDelete: boolean;
};

const COMMENT_SELECT =
  "id, item_id, parent_id, content, like_count, mention_user_id, created_at, user_id, " +
  "author:profiles!user_id ( id, nickname, role, avatar_url )";

type RawCommentAuthor = {
  id: string;
  nickname: string | null;
  role: Role | null;
  avatar_url: string | null;
};

type RawComment = {
  id: string;
  item_id: string;
  parent_id: string | null;
  content: string;
  like_count: number | null;
  mention_user_id: string | null;
  created_at: string;
  user_id: string;
  author: RawCommentAuthor | RawCommentAuthor[] | null;
};

function pickAuthor(
  a: RawComment["author"],
): RawCommentAuthor | null {
  if (!a) return null;
  return Array.isArray(a) ? (a[0] ?? null) : a;
}

/** 댓글 목록 — 작성자 프로필 join, 오래된 순(스레드 표시용). */
export async function listComments(
  itemId: string,
): Promise<MoontubeComment[]> {
  const [uid, myRole] = await Promise.all([getUid(), getMyRole()]);

  const { data, error } = await supabase
    .from("moontube_comments")
    .select(COMMENT_SELECT)
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[listComments] 실패", error);
    return [];
  }

  const isAdmin = myRole === "admin";
  return ((data ?? []) as unknown as RawComment[]).map((raw) => {
    const author = pickAuthor(raw.author);
    const isMine = !!uid && raw.user_id === uid;
    return {
      id: raw.id,
      itemId: raw.item_id,
      parentId: raw.parent_id,
      content: raw.content,
      createdAt: raw.created_at,
      likeCount: raw.like_count ?? 0,
      mentionUserId: raw.mention_user_id,
      author: author
        ? {
            id: author.id,
            nickname: author.nickname?.trim() || "사용자",
            role: (author.role ?? "student") as Role,
            avatarUrl: author.avatar_url,
          }
        : null,
      isMine,
      canDelete: isMine || isAdmin,
    };
  });
}

/** 현재 사용자 역할 — 댓글 삭제 권한 판단용 */
async function getMyRole(): Promise<Role | null> {
  const uid = await getUid();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { role: Role }).role;
}

export type CreateCommentResult =
  | { ok: true; comment: MoontubeComment }
  | {
      ok: false;
      reason: "unauthorized" | "validation" | "network";
      message: string;
    };

/**
 * 댓글 작성 (금지어 필터 적용).
 * parentId 가 있으면 답글. 답글의 답글이라도 호출 측에서 root id 로 평탄화 권장.
 * mentionUserId 가 있으면 호명한 사용자 id 를 함께 기록(향후 알림 연동에 활용).
 */
export async function createComment(
  itemId: string,
  content: string,
  parentId?: string | null,
  mentionUserId?: string | null,
): Promise<CreateCommentResult> {
  const text = content.trim();
  if (!text) {
    return { ok: false, reason: "validation", message: "내용을 입력해주세요." };
  }
  const banned = findBannedWordInFields([text]);
  if (banned) {
    return {
      ok: false,
      reason: "validation",
      message: `부적절한 단어가 포함되어 있어요: "${banned}"`,
    };
  }
  const uid = await getUid();
  if (!uid) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "로그인 후 댓글을 작성할 수 있어요.",
    };
  }

  const { data, error } = await supabase
    .from("moontube_comments")
    .insert({
      item_id: itemId,
      user_id: uid,
      parent_id: parentId ?? null,
      mention_user_id: mentionUserId ?? null,
      content: text,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) {
    console.error("[createComment] 실패", error);
    const msg = error.message ?? "";
    if (msg.includes("row-level security") || msg.includes("violates")) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "댓글 작성 권한이 없습니다. 다시 로그인 후 시도해주세요.",
      };
    }
    return {
      ok: false,
      reason: "network",
      message: "댓글 등록에 실패했어요.",
    };
  }

  const raw = data as unknown as RawComment;
  const author = pickAuthor(raw.author);
  return {
    ok: true,
    comment: {
      id: raw.id,
      itemId: raw.item_id,
      parentId: raw.parent_id,
      content: raw.content,
      createdAt: raw.created_at,
      likeCount: raw.like_count ?? 0,
      mentionUserId: raw.mention_user_id,
      author: author
        ? {
            id: author.id,
            nickname: author.nickname?.trim() || "사용자",
            role: (author.role ?? "student") as Role,
            avatarUrl: author.avatar_url,
          }
        : null,
      isMine: true,
      canDelete: true,
    },
  };
}

/** 댓글 삭제 — 본인 또는 admin (RLS 강제). */
export async function deleteComment(
  commentId: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase
    .from("moontube_comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[deleteComment] 실패", error);
    return {
      ok: false,
      message: "댓글 삭제에 실패했어요 (권한이 없거나 네트워크 오류).",
    };
  }
  return { ok: true, message: "댓글을 삭제했어요." };
}

// ─── 댓글 좋아요 ─────────────────────────────────────────────────────────────
// like_count 캐시는 034 트리거가 SECURITY DEFINER 로 갱신.
// 여기서는 moontube_comment_likes 행만 넣고 뺀다.

/** 댓글 좋아요 토글 — { ok, liked } */
export async function toggleCommentLike(
  commentId: string,
): Promise<{ ok: boolean; liked: boolean }> {
  const uid = await getUid();
  if (!uid) return { ok: false, liked: false };

  const { data: existing, error: selErr } = await supabase
    .from("moontube_comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", uid)
    .maybeSingle();

  if (selErr) {
    console.error("[toggleCommentLike] 조회 실패", selErr);
    return { ok: false, liked: false };
  }

  if (existing) {
    const { error } = await supabase
      .from("moontube_comment_likes")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (error) {
      console.error("[toggleCommentLike] delete 실패", error);
      return { ok: false, liked: true };
    }
    return { ok: true, liked: false };
  }

  const { error } = await supabase
    .from("moontube_comment_likes")
    .insert({ comment_id: commentId, user_id: uid });
  if (error) {
    // 동시 클릭으로 인한 unique 충돌은 "이미 눌림" 으로 간주
    const code = (error as unknown as { code?: string }).code;
    if (code === "23505") return { ok: true, liked: true };
    console.error("[toggleCommentLike] insert 실패", error);
    return { ok: false, liked: false };
  }
  return { ok: true, liked: true };
}

/** 내가 좋아요 누른 댓글 id 집합 — 목록 진입 시 일괄 조회 */
export async function getMyCommentLikes(
  commentIds: string[],
): Promise<Set<string>> {
  const empty = new Set<string>();
  const uid = await getUid();
  if (!uid || commentIds.length === 0) return empty;

  const { data, error } = await supabase
    .from("moontube_comment_likes")
    .select("comment_id")
    .eq("user_id", uid)
    .in("comment_id", commentIds);

  if (error) {
    console.error("[getMyCommentLikes] 실패", error);
    return empty;
  }
  const set = new Set<string>();
  for (const r of (data ?? []) as { comment_id: string }[]) {
    set.add(r.comment_id);
  }
  return set;
}
