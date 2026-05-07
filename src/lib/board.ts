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
export type PostStatus = "active" | "resolved";

export type PostRow = {
  id: string;
  author_id: string;
  board_type: BoardType;
  title: string;
  content: string;
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
  view_count: number;
  like_count: number;
  is_pinned: boolean;
  status: PostStatus;
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

// PostgREST 임베딩은 FK 컬럼명으로 가리키는 게 가장 안전 (FK constraint 이름이 환경마다 달라질 수 있어서).
const POST_SELECT = `
  id, author_id, board_type, title, content, image_url, file_url, file_name,
  view_count, like_count, is_pinned, status, created_at, updated_at,
  author:profiles!author_id ( id, nickname, role ),
  comments_aggregate:comments(count)
`;

type RawPost = Omit<PostRow, "author" | "comment_count" | "is_pinned" | "status"> & {
  is_pinned: boolean | null;
  status: PostStatus | null;
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
    file_url: raw.file_url,
    file_name: raw.file_name,
    view_count: raw.view_count,
    like_count: raw.like_count,
    is_pinned: raw.is_pinned ?? false,
    status: (raw.status as PostStatus | null) ?? "active",
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

/** board_type 별 목록 (페이지네이션). 옵션으로 고정글 우선 정렬 및 상태 필터 지원 */
export async function listPosts(
  boardType: BoardType,
  page: number = 1,
  options?: { pinnedFirst?: boolean; status?: PostStatus | null },
): Promise<{ posts: PostRow[]; total: number }> {
  const from = (page - 1) * POSTS_PER_PAGE;
  const to = from + POSTS_PER_PAGE - 1;

  let query = supabase
    .from("posts")
    .select(POST_SELECT, { count: "exact" })
    .eq("board_type", boardType);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.pinnedFirst) {
    query = query.order("is_pinned", { ascending: false });
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[listPosts] 실패", error);
    return { posts: [], total: 0 };
  }

  const posts = ((data ?? []) as unknown as RawPost[]).map(normalizePost);
  return { posts, total: count ?? 0 };
}

/** 공지사항 고정/해제 — 관리자/교사만 호출 (RLS 가 권한 검증) */
export async function togglePostPin(
  postId: string,
  pinned: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: pinned })
    .eq("id", postId);
  if (error) {
    console.error("[togglePostPin] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

/** 분실물 상태 변경 — 작성자만 호출 (RLS 가 권한 검증) */
export async function setPostStatus(
  postId: string,
  status: PostStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("posts")
    .update({ status })
    .eq("id", postId);
  if (error) {
    console.error("[setPostStatus] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

// ─────────────────────────────────────────────────────────
// 분실물 게시판 — content 안에 JSON 으로 구조화 저장
// ─────────────────────────────────────────────────────────

export type LostContent = {
  /** 분실 장소 (예: "3층 화장실 앞") */
  location: string;
  /** 분실 날짜 (yyyy-mm-dd, 비워두면 빈 문자열) */
  lostDate: string;
  /** 자유 서술 본문 */
  description: string;
};

/** 분실물 글 본문 파싱 — JSON 구조면 분해, 아니면 description 으로만 사용 */
export function parseLostContent(content: string): LostContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "description" in obj &&
      typeof (obj as { description: unknown }).description === "string"
    ) {
      const o = obj as { location?: unknown; lostDate?: unknown; description: string };
      return {
        location: typeof o.location === "string" ? o.location : "",
        lostDate: typeof o.lostDate === "string" ? o.lostDate : "",
        description: o.description,
      };
    }
  } catch {
    // 일반 텍스트 본문
  }
  return { location: "", lostDate: "", description: content };
}

export function stringifyLostContent(input: LostContent): string {
  return JSON.stringify({
    location: input.location.trim(),
    lostDate: input.lostDate,
    description: input.description.trim(),
  });
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
  fileUrl?: string | null;
  fileName?: string | null;
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
    hasFile: !!input.fileUrl,
  });

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      board_type: input.boardType,
      title: input.title,
      content: input.content,
      image_url: input.imageUrl ?? null,
      file_url: input.fileUrl ?? null,
      file_name: input.fileName ?? null,
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
  patch: {
    title: string;
    content: string;
    imageUrl?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
  },
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {
    title: patch.title,
    content: patch.content,
    updated_at: new Date().toISOString(),
  };
  // 정의된(=undefined 가 아닌) 필드만 업데이트. null 이면 명시적 제거.
  if (patch.imageUrl !== undefined) update.image_url = patch.imageUrl;
  if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
  if (patch.fileName !== undefined) update.file_name = patch.fileName;

  const { error } = await supabase.from("posts").update(update).eq("id", postId);

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
  author:profiles!author_id ( id, nickname, role )
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

/** 최근 N일 내 like_count + view_count 가 높은 글 상위 K개 (대시보드 HOT) */
export async function getHotPosts(
  days: number = 7,
  limit: number = 5,
): Promise<PostRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .gte("created_at", since)
    // PostgREST 가 (col + col) 정렬을 지원하지 않으므로 후보를 넉넉히 받아 클라이언트에서 정렬한다.
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[getHotPosts] 실패", error);
    return [];
  }
  const posts = ((data ?? []) as unknown as RawPost[]).map(normalizePost);
  posts.sort(
    (a, b) =>
      b.like_count + b.view_count - (a.like_count + a.view_count),
  );
  return posts.slice(0, limit);
}

/** 오늘(현지 자정 기준) 작성된 글 개수 — 슬림바에서 사용 */
export async function getTodayPostCount(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  if (error) {
    console.error("[getTodayPostCount] 실패", error);
    return 0;
  }
  return count ?? 0;
}

/** 모든 board_type 별 게시글 개수 — TopBar 메가메뉴 표시용 */
export async function getBoardCounts(): Promise<Partial<Record<BoardType, number>>> {
  const { data, error } = await supabase.from("posts").select("board_type");
  if (error || !data) {
    if (error) console.error("[getBoardCounts] 실패", error);
    return {};
  }
  const counts: Partial<Record<BoardType, number>> = {};
  for (const row of data as Array<{ board_type: BoardType }>) {
    counts[row.board_type] = (counts[row.board_type] ?? 0) + 1;
  }
  return counts;
}

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
