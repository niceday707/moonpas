"use client";

// Supabase posts / comments CRUD 헬퍼 모음.
// 모든 함수는 클라이언트에서 직접 호출하며, 인증/권한은 RLS 정책으로 처리한다.

import { supabase } from "@/lib/supabase";
import type { Role } from "@/components/ui/Badge";

// 게시판 종류 — board_type 컬럼에 들어가는 키
export type BoardType =
  | "free" // 자유게시판
  | "notice" // 공지사항
  | "lost" // 분실물 센터
  | "market" // 나눔장터
  | "issue" // 이슈토론
  | "challenge" // 챌린지 (이미지 필수)
  | "college"
  | "curriculum"
  | "council"
  | "qa"
  | "youtube"
  | "resources"
  | "study"
  | "news"
  | "alumni"
  | "senior";

export const BOARD_LABEL: Record<BoardType, string> = {
  free: "자유게시판",
  notice: "공지사항",
  lost: "분실물 센터",
  market: "나눔장터",
  issue: "이슈토론",
  challenge: "챌린지",
  college: "대입정보",
  curriculum: "교육과정",
  council: "학생회",
  qa: "Q&A",
  youtube: "문튜브",
  resources: "자료실",
  study: "스터디",
  news: "뉴스",
  alumni: "졸업생",
  senior: "선배의 한마디",
};

// posts row + 작성자 join 결과
export type PostRow = {
  id: string;
  author_id: string;
  board_type: BoardType;
  title: string;
  content: string;
  image_url: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  author: { id: string; nickname: string; role: Role } | null;
  comment_count: number;
};

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: { id: string; nickname: string; role: Role } | null;
};

const POST_SELECT = `
  id, author_id, board_type, title, content, image_url,
  view_count, like_count, created_at, updated_at,
  author:profiles!posts_author_id_fkey ( id, nickname, role ),
  comments_aggregate:comments(count)
`;

type RawPost = Omit<PostRow, "author" | "comment_count"> & {
  author: { id: string; nickname: string; role: Role } | null;
  comments_aggregate: { count: number }[] | null;
};

function normalizePost(raw: RawPost): PostRow {
  const count = raw.comments_aggregate?.[0]?.count ?? 0;
  return {
    id: raw.id,
    author_id: raw.author_id,
    board_type: raw.board_type,
    title: raw.title,
    content: raw.content,
    image_url: raw.image_url,
    view_count: raw.view_count,
    like_count: raw.like_count,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    author: raw.author,
    comment_count: count,
  };
}

// ─────────────────────────────────────────────────────────
// posts
// ─────────────────────────────────────────────────────────

export const POSTS_PER_PAGE = 20;

/** board_type 별 목록 (페이지네이션) */
export async function listPosts(
  boardType: BoardType,
  page: number = 1,
): Promise<{ posts: PostRow[]; total: number }> {
  const from = (page - 1) * POSTS_PER_PAGE;
  const to = from + POSTS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from("posts")
    .select(POST_SELECT, { count: "exact" })
    .eq("board_type", boardType)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[listPosts] 실패", error);
    return { posts: [], total: 0 };
  }

  const posts = ((data ?? []) as unknown as RawPost[]).map(normalizePost);
  return { posts, total: count ?? 0 };
}

export async function getPost(postId: string): Promise<PostRow | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    console.error("[getPost] 실패", error);
    return null;
  }
  if (!data) return null;
  return normalizePost(data as unknown as RawPost);
}

export async function createPost(input: {
  authorId: string;
  boardType: BoardType;
  title: string;
  content: string;
  imageUrl?: string | null;
}): Promise<{
  id: string | null;
  error: string | null;
  code: string | null;
  details: string | null;
  hint: string | null;
}> {
  // 디버깅용 — 현재 세션 유저 id 와 insert 에 보내는 author_id 비교
  const { data: authData } = await supabase.auth.getUser();
  console.log("[createPost] 호출 시점", {
    sessionUserId: authData?.user?.id ?? null,
    sessionEmail: authData?.user?.email ?? null,
    payloadAuthorId: input.authorId,
    boardType: input.boardType,
    titleLen: input.title.length,
    contentLen: input.content.length,
    hasImage: !!input.imageUrl,
  });

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      board_type: input.boardType,
      title: input.title,
      content: input.content,
      image_url: input.imageUrl ?? null,
    })
    .select("id")
    .single();

  if (error) {
    const e = error as unknown as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    console.error("[createPost] insert 실패 — 전체 에러 객체", error);
    console.error("[createPost] 분해", {
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
    });
    return {
      id: null,
      error: e.message ?? "알 수 없는 오류",
      code: e.code ?? null,
      details: e.details ?? null,
      hint: e.hint ?? null,
    };
  }

  console.log("[createPost] insert 성공", data);
  return {
    id: data?.id ?? null,
    error: null,
    code: null,
    details: null,
    hint: null,
  };
}

export async function updatePost(
  postId: string,
  patch: { title: string; content: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    console.error("[updatePost] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function deletePost(postId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) {
    console.error("[deletePost] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

/** 조회수 +1 (security definer RPC) */
export async function incrementViewCount(postId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_post_view", { p_id: postId });
  if (error) {
    console.warn("[incrementViewCount] 실패", error);
  }
}

// ─────────────────────────────────────────────────────────
// comments
// ─────────────────────────────────────────────────────────

const COMMENT_SELECT = `
  id, post_id, author_id, content, created_at,
  author:profiles!comments_author_id_fkey ( id, nickname, role )
`;

export async function listComments(postId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[listComments] 실패", error);
    return [];
  }
  return (data ?? []) as unknown as CommentRow[];
}

export async function createComment(input: {
  authorId: string;
  postId: string;
  content: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("comments").insert({
    author_id: input.authorId,
    post_id: input.postId,
    content: input.content,
  });
  if (error) {
    console.error("[createComment] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteComment(commentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) {
    console.error("[deleteComment] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

// ─────────────────────────────────────────────────────────
// 사용자 통계 — 대시보드 프로필 카드에서 사용
// ─────────────────────────────────────────────────────────

export type UserStats = {
  posts: number;
  comments: number;
  receivedLikes: number;
};

export async function getUserStats(userId: string): Promise<UserStats> {
  const [postsRes, commentsRes, likesRes] = await Promise.all([
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", userId),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("author_id", userId),
    supabase.from("posts").select("like_count").eq("author_id", userId),
  ]);

  const likeRows = (likesRes.data ?? []) as Array<{ like_count: number | null }>;
  const receivedLikes = likeRows.reduce(
    (sum, row) => sum + (row.like_count ?? 0),
    0,
  );

  return {
    posts: postsRes.count ?? 0,
    comments: commentsRes.count ?? 0,
    receivedLikes,
  };
}
