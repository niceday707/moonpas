"use client";

// Supabase posts / comments CRUD 헬퍼 모음.
// 모든 함수는 클라이언트에서 직접 호출하며, 인증/권한은 RLS 정책으로 처리한다.

import { supabase } from "@/lib/supabase";
import { notifyLike } from "@/lib/notify";
import type { Role } from "@/components/ui/Badge";

// 게시판 종류 — board_type 컬럼에 들어가는 키
export type BoardType =
  | "free" // 자유게시판
  | "notice" // 공지사항
  | "lost" // 분실물 센터
  | "market" // 나눔장터
  | "debate" // 이슈토론 (DB CHECK 제약: 'debate')
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
  | "alumni_news"
  | "senior"
  // 문태 이벤트 — 각 코너마다 전용 UI 컴포넌트로 라우팅
  | "event_member" // 회원 참여방 (정회원 미션)
  | "event_find" // 찹쌀 꽈배기 (숨은 이모지 찾기)
  | "event_praise" // 칭찬합시다
  | "event_study" // 공부 인증
  | "event_quiz" // 오늘의 퀴즈
  | "anonymous"; // 문태 에타 (완전 익명 게시판)

export const BOARD_LABEL: Record<BoardType, string> = {
  free: "자유게시판",
  notice: "공지사항",
  lost: "분실물 센터",
  market: "나눔장터",
  debate: "이슈토론",
  challenge: "챌린지",
  college: "대입정보",
  curriculum: "교육과정",
  council: "학생회",
  qa: "Q&A",
  youtube: "문튜브",
  resources: "자료실",
  study: "학습게시판",
  news: "뉴스",
  alumni: "졸업생",
  alumni_news: "동문 뉴스",
  senior: "선배의 한마디",
  event_member: "회원 참여방",
  event_find: "찹쌀 꽈배기",
  event_praise: "칭찬합시다",
  event_study: "공부 인증",
  event_quiz: "오늘의 퀴즈",
  anonymous: "문태 에타",
};

// posts row + 작성자 join 결과
export type PostStatus = "active" | "resolved";

// ── 학습게시판(board_type='study') 태그 ───────────────────
// DB CHECK 와 동일한 화이트리스트. UI 라벨은 STUDY_*_LABEL 맵 참고.
// 'all' = 학년 무관 글 (예: 수능 일반 질문). 023 마이그레이션의 grade CHECK 도 'all' 추가.
export type StudyGrade = "all" | "1" | "2" | "3";
export type StudySubjectTag = "korean" | "english" | "math" | "social" | "science" | "etc";
export type StudyPostCategory = "question" | "tip" | "share";

export const STUDY_GRADE_LABEL: Record<StudyGrade, string> = {
  all: "전체",
  "1": "1학년",
  "2": "2학년",
  "3": "3학년",
};
export const STUDY_SUBJECT_TAG_LABEL: Record<StudySubjectTag, string> = {
  korean: "국어",
  english: "영어",
  math: "수학",
  social: "사회",
  science: "과학",
  // DB 값은 'etc' 그대로 — UI 라벨만 "교양" 으로 표기.
  etc: "교양",
};
export const STUDY_POST_CATEGORY_LABEL: Record<StudyPostCategory, string> = {
  question: "질문",
  tip: "꿀팁",
  share: "자료공유",
};

/** 교과별 뱃지 색상 — 카드/필터 칩 공용 (Tailwind 클래스). */
export const STUDY_SUBJECT_TAG_STYLE: Record<StudySubjectTag, string> = {
  korean:  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  english: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  math:    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  social:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  science: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  etc:     "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
};

/** 글 종류 뱃지 색상 — 질문=파란, 꿀팁=골드, 자료공유=초록. */
export const STUDY_POST_CATEGORY_STYLE: Record<StudyPostCategory, string> = {
  question: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  tip:      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  share:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

// ── 챌린지(board_type='challenge') 카테고리 ─────────────────
// post_category 컬럼을 재사용해서 저장 — 학습게시판과는 board_type 으로 분리.
export type ChallengeCategory = "attendance" | "study_cert" | "exercise";

export const CHALLENGE_CATEGORY_LABEL: Record<ChallengeCategory, string> = {
  attendance: "등교 인증",
  study_cert: "공부 인증",
  exercise: "운동 인증",
};

export const CHALLENGE_CATEGORY_ICON: Record<ChallengeCategory, string> = {
  attendance: "☀️",
  study_cert: "📚",
  exercise: "💪",
};

export const CHALLENGE_CATEGORY_STYLE: Record<ChallengeCategory, string> = {
  attendance: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  study_cert: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  exercise: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
};

// 등교 인증 시간 제한 (KST) — 08:10 까지만 인증 가능
export const ATTENDANCE_DEADLINE_HOUR = 8;
export const ATTENDANCE_DEADLINE_MINUTE = 10;

/** 챌린지 인증 상태 — 'approved' (정상, 기본값) / 'rejected' (관리자 취소) */
export type ChallengeStatus = "approved" | "rejected";

export type PostRow = {
  id: string;
  /** anonymous 게시판은 빈 문자열로 마스킹 — 학번/이름/UUID 모두 노출 금지 */
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
  vote_a: number;
  vote_b: number;
  created_at: string;
  updated_at: string;
  /** anonymous 게시판은 항상 null — nickname/role 등이 데이터 단계에서 제거됨 */
  author: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
  comment_count: number;
  /** 본인 글 여부 — anonymous 게시판에서 author_id 가 마스킹돼도 isOwner 판별에 사용 */
  is_mine: boolean;
  // 학습게시판 전용 — 그 외 board_type 에서는 항상 null.
  grade: StudyGrade | null;
  subject_tag: StudySubjectTag | null;
  // post_category 는 학습게시판('question'|'tip'|'share') 또는
  // 챌린지('attendance'|'study_cert'|'exercise') 두 용도로 쓰임 — board_type 으로 의미 분기.
  post_category: StudyPostCategory | ChallengeCategory | null;
  // 챌린지 전용 — 그 외에는 null/undefined.
  challenge_status: ChallengeStatus | null;
  challenge_rejected_reason: string | null;
};

export type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  /** anonymous 게시판은 빈 문자열로 마스킹 (대신 anon_seed/is_mine/is_post_author 사용) */
  author_id: string;
  content: string;
  created_at: string;
  /** anonymous 게시판은 항상 null */
  author: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
  /** 본인 댓글 여부 */
  is_mine: boolean;
  /** 글쓴이의 댓글 여부 — 익명게시판 "글쓴이" 배지/라벨용 */
  is_post_author: boolean;
  /** 익명게시판 익명N 번호 부여용 결정적 시드 (post_id + author_id 해시) — 다른 글에선 매칭 불가 */
  anon_seed: string | null;
  /**
   * 답글의 답글일 때 "@닉네임" 으로 호명된 사용자의 user_id (선택).
   * 익명 게시판은 항상 null. 본문의 @멘션 텍스트와 함께 보조 포인터로만 사용.
   */
  mention_user_id: string | null;
  /** mention_user_id 에 해당하는 사용자 (조회 결과). 익명/미설정 시 null. */
  mention_user: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
  /** 댓글 좋아요 수 (comment_reactions 집계) */
  like_count: number;
  /** 현재 로그인 사용자의 리액션. 미로그인/없음 → null */
  my_reaction: "like" | "dislike" | null;
};

// PostgREST 임베딩은 FK 컬럼명으로 가리키는 게 가장 안전 (FK constraint 이름이 환경마다 달라질 수 있어서).
const POST_SELECT = `
  id, author_id, board_type, title, content, image_url, file_url, file_name,
  view_count, like_count, is_pinned, status, vote_a, vote_b, created_at, updated_at,
  grade, subject_tag, post_category, challenge_status, challenge_rejected_reason,
  author:profiles!author_id ( id, nickname, role, avatar_url ),
  comments_aggregate:comments(count)
`;

type RawPost = Omit<
  PostRow,
  | "author"
  | "comment_count"
  | "is_pinned"
  | "status"
  | "vote_a"
  | "vote_b"
  | "challenge_status"
  | "challenge_rejected_reason"
> & {
  is_pinned: boolean | null;
  status: PostStatus | null;
  vote_a: number | null;
  vote_b: number | null;
  challenge_status: ChallengeStatus | null;
  challenge_rejected_reason: string | null;
  author: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
  comments_aggregate: { count: number }[] | null;
};

function normalizePost(raw: RawPost, currentUserId: string | null): PostRow {
  const count = raw.comments_aggregate?.[0]?.count ?? 0;
  const isAnon = raw.board_type === "anonymous";
  const isMine = !!currentUserId && raw.author_id === currentUserId;
  return {
    id: raw.id,
    // 익명 게시판은 author_id 도 노출하지 않음 (UI 비교는 is_mine 으로)
    author_id: isAnon ? "" : raw.author_id,
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
    vote_a: raw.vote_a ?? 0,
    vote_b: raw.vote_b ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    // 익명 게시판은 작성자 식별 정보(nickname/role/avatar) 일체 제거
    author: isAnon ? null : raw.author,
    comment_count: count,
    is_mine: isMine,
    grade: (raw.grade as StudyGrade | null) ?? null,
    subject_tag: (raw.subject_tag as StudySubjectTag | null) ?? null,
    post_category:
      (raw.post_category as StudyPostCategory | ChallengeCategory | null) ?? null,
    // challenge_status 가 NULL/미적용 환경이면 'approved' 로 간주 (DEFAULT 값과 동일).
    challenge_status: (raw.challenge_status as ChallengeStatus | null) ?? "approved",
    challenge_rejected_reason: raw.challenge_rejected_reason ?? null,
  };
}

/** 현재 로그인 사용자 ID — 데이터 마스킹용. 미로그인/오류 시 null. */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** 결정적 해시 (post_id + author_id) → 같은 글 내에서만 같은 시드, 다른 글에선 매칭 불가 */
function makeAnonSeed(postId: string, authorId: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  const mix = `${postId}:${authorId}`;
  for (let i = 0; i < mix.length; i++) {
    const c = mix.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  return (h1.toString(16) + h2.toString(16)).slice(0, 16);
}

type RawComment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  mention_user_id: string | null;
  author: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
  mention_user: {
    id: string;
    nickname: string;
    role: Role;
    avatar_url: string | null;
  } | null;
};

/** 댓글 정규화 — 익명 게시판 글의 댓글이면 작성자 식별 정보 제거 */
function normalizeComment(
  raw: RawComment,
  currentUserId: string | null,
  postBoardType: BoardType,
  postAuthorIdRaw: string,
): CommentRow {
  const isAnon = postBoardType === "anonymous";
  const isMine = !!currentUserId && raw.author_id === currentUserId;
  const isPostAuthor = raw.author_id === postAuthorIdRaw;
  return {
    id: raw.id,
    post_id: raw.post_id,
    parent_id: raw.parent_id,
    // 익명게시판 댓글은 author_id 마스킹
    author_id: isAnon ? "" : raw.author_id,
    content: raw.content,
    created_at: raw.created_at,
    author: isAnon ? null : raw.author,
    is_mine: isMine,
    is_post_author: isPostAuthor,
    // 다른 글에선 매칭 불가능한 시드 — 같은 글 댓글 내에서만 동일 작성자 그룹화에 사용
    anon_seed: isAnon ? makeAnonSeed(raw.post_id, raw.author_id) : null,
    // 익명 게시판은 멘션 포인터도 노출하지 않음
    mention_user_id: isAnon ? null : raw.mention_user_id,
    mention_user: isAnon ? null : raw.mention_user,
    // 리액션 — listComments 에서 별도로 채워짐 (기본값)
    like_count: 0,
    my_reaction: null,
  };
}

/** 댓글 ID 목록에 대한 리액션 집계 및 현재 사용자 리액션 조회 */
async function fetchCommentReactions(
  commentIds: string[],
  uid: string | null,
): Promise<{
  likeCountMap: Map<string, number>;
  myReactionMap: Map<string, "like" | "dislike">;
}> {
  if (commentIds.length === 0) {
    return { likeCountMap: new Map(), myReactionMap: new Map() };
  }
  try {
    const { data, error } = await supabase
      .from("comment_reactions")
      .select("comment_id, user_id, reaction")
      .in("comment_id", commentIds);
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      comment_id: string;
      user_id: string;
      reaction: "like" | "dislike";
    }>;

    const likeCountMap = new Map<string, number>();
    const myReactionMap = new Map<string, "like" | "dislike">();

    for (const row of rows) {
      if (row.reaction === "like") {
        likeCountMap.set(row.comment_id, (likeCountMap.get(row.comment_id) ?? 0) + 1);
      }
      if (uid && row.user_id === uid) {
        myReactionMap.set(row.comment_id, row.reaction);
      }
    }
    return { likeCountMap, myReactionMap };
  } catch {
    // comment_reactions 테이블 미적용 환경 — 조용히 빈 값 반환
    return { likeCountMap: new Map(), myReactionMap: new Map() };
  }
}

// ─────────────────────────────────────────────────────────
// posts
// ─────────────────────────────────────────────────────────

export const POSTS_PER_PAGE = 20;

/** board_type 별 목록 (페이지네이션). 옵션으로 고정글 우선 정렬 및 상태/내용 필터 지원 */
export async function listPosts(
  boardType: BoardType,
  page: number = 1,
  options?: {
    pinnedFirst?: boolean;
    status?: PostStatus | null;
    /** content 컬럼에 ILIKE 매칭할 패턴 (예: '%"subject":"korean"%') */
    contentLike?: string | null;
    /** 정렬 기준 — 기본 created_at DESC */
    sortBy?: "created_at" | "like_count";
    // 학습게시판 전용 — null/undefined 면 필터 적용 안 함 ("전체" 의미).
    grade?: StudyGrade | null;
    subjectTag?: StudySubjectTag | null;
    // 학습게시판은 StudyPostCategory, 챌린지는 ChallengeCategory 가 들어옴 — board_type 분기로 의미 구분.
    postCategory?: StudyPostCategory | ChallengeCategory | null;
  },
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

  if (options?.contentLike) {
    query = query.ilike("content", options.contentLike);
  }

  if (options?.grade) {
    query = query.eq("grade", options.grade);
  }
  if (options?.subjectTag) {
    query = query.eq("subject_tag", options.subjectTag);
  }
  if (options?.postCategory) {
    query = query.eq("post_category", options.postCategory);
  }

  if (options?.pinnedFirst) {
    query = query.order("is_pinned", { ascending: false });
  }

  const sortCol = options?.sortBy ?? "created_at";
  const { data, error, count } = await query
    .order(sortCol, { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[listPosts] 실패", error);
    return { posts: [], total: 0 };
  }

  const uid = await getCurrentUserId();
  const posts = ((data ?? []) as unknown as RawPost[]).map((r) =>
    normalizePost(r, uid),
  );
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
  const uid = await getCurrentUserId();
  return normalizePost(data as unknown as RawPost, uid);
}

export async function createPost(input: {
  authorId: string;
  boardType: BoardType;
  title: string;
  content: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  // 학습게시판(board_type='study') 전용 — 다른 board 에서는 무시.
  grade?: StudyGrade | null;
  subjectTag?: StudySubjectTag | null;
  postCategory?: StudyPostCategory | null;
  // 챌린지(board_type='challenge') 전용 — post_category 컬럼에 저장됨.
  challengeCategory?: ChallengeCategory | null;
  // 챌린지 v2 — 학생이 만든 개별 챌린지에 인증 글 연결
  challengeId?: string | null;
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

  // 학습게시판 외에는 태그 컬럼을 반드시 NULL 로 INSERT — 잘못된 board 에서 태그가 새지 않도록 가드.
  const isStudyBoard = input.boardType === "study";
  const isChallengeBoard = input.boardType === "challenge";

  // 등교 인증은 KST 08:10 까지만 허용.
  if (isChallengeBoard && input.challengeCategory === "attendance") {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const h = kst.getUTCHours();
    const m = kst.getUTCMinutes();
    const past =
      h > ATTENDANCE_DEADLINE_HOUR ||
      (h === ATTENDANCE_DEADLINE_HOUR && m > ATTENDANCE_DEADLINE_MINUTE);
    if (past) {
      return {
        id: null,
        error: "등교 인증은 오전 8시 10분까지만 가능합니다",
        code: "ATTENDANCE_DEADLINE",
        details: null,
        hint: null,
      };
    }
  }

  // post_category 는 학습게시판이면 StudyPostCategory, 챌린지면 ChallengeCategory 로 분기 저장.
  const postCategoryValue = isStudyBoard
    ? (input.postCategory ?? null)
    : isChallengeBoard
    ? (input.challengeCategory ?? null)
    : null;

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
      grade: isStudyBoard ? (input.grade ?? null) : null,
      subject_tag: isStudyBoard ? (input.subjectTag ?? null) : null,
      post_category: postCategoryValue,
      challenge_id: isChallengeBoard ? (input.challengeId ?? null) : null,
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
    // 학습게시판 전용 — 다른 board 의 수정에서는 그대로 undefined 로 두면 변경되지 않음.
    grade?: StudyGrade | null;
    subjectTag?: StudySubjectTag | null;
    // 학습게시판은 StudyPostCategory, 챌린지는 ChallengeCategory 가 들어옴.
    postCategory?: StudyPostCategory | ChallengeCategory | null;
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
  if (patch.grade !== undefined) update.grade = patch.grade;
  if (patch.subjectTag !== undefined) update.subject_tag = patch.subjectTag;
  if (patch.postCategory !== undefined) update.post_category = patch.postCategory;

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
  id, post_id, parent_id, author_id, content, created_at, mention_user_id,
  author:profiles!author_id ( id, nickname, role, avatar_url ),
  mention_user:profiles!mention_user_id ( id, nickname, role, avatar_url )
`;

// 마이그레이션 012 미적용 환경 폴백용 — mention_user_id 컬럼/임베딩 없이도 동작.
const COMMENT_SELECT_LEGACY = `
  id, post_id, parent_id, author_id, content, created_at,
  author:profiles!author_id ( id, nickname, role, avatar_url )
`;

export async function listComments(postId: string): Promise<CommentRow[]> {
  // 글의 board_type / author_id 를 먼저 가져와야 익명 마스킹 규칙을 적용할 수 있다
  const [{ data: postMeta }, primary, uid] = await Promise.all([
    supabase
      .from("posts")
      .select("board_type, author_id")
      .eq("id", postId)
      .maybeSingle(),
    supabase
      .from("comments")
      .select(COMMENT_SELECT)
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    getCurrentUserId(),
  ]);

  let data: unknown = primary.data;
  let error = primary.error;
  // mention_user_id 컬럼 / FK 미적용 환경에서는 PostgREST 가 에러를 반환 →
  // 레거시 SELECT 로 한 번 더 시도 (구조화 멘션 정보 없이 동작)
  if (error) {
    console.warn(
      "[listComments] v2 SELECT 실패 — legacy SELECT 폴백",
      error.message,
    );
    const legacy = await supabase
      .from("comments")
      .select(COMMENT_SELECT_LEGACY)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    console.error("[listComments] 실패", error);
    return [];
  }

  const boardType = (postMeta?.board_type as BoardType | undefined) ?? "free";
  const postAuthorId = (postMeta?.author_id as string | undefined) ?? "";

  const rawList = (data as Partial<RawComment>[] | null) ?? [];

  // 리액션 집계 — 별도 테이블에서 댓글 ID 목록으로 한 번에 조회
  const commentIds = rawList.map((r) => r.id).filter(Boolean) as string[];
  const { likeCountMap, myReactionMap } = await fetchCommentReactions(commentIds, uid);

  return rawList.map((raw) => {
    // 레거시 응답 보강 — 누락 필드 기본값
    const filled: RawComment = {
      id: raw.id ?? "",
      post_id: raw.post_id ?? postId,
      parent_id: raw.parent_id ?? null,
      author_id: raw.author_id ?? "",
      content: raw.content ?? "",
      created_at: raw.created_at ?? new Date().toISOString(),
      mention_user_id: raw.mention_user_id ?? null,
      author: raw.author ?? null,
      mention_user: raw.mention_user ?? null,
    };
    const comment = normalizeComment(filled, uid, boardType, postAuthorId);
    comment.like_count = likeCountMap.get(filled.id) ?? 0;
    comment.my_reaction = myReactionMap.get(filled.id) ?? null;
    return comment;
  });
}

export async function createComment(input: {
  authorId: string;
  postId: string;
  content: string;
  /**
   * 답글이면 "최상위 댓글의 id" 를 넘긴다.
   *   답글의 답글이라도 parent_id 는 항상 root 댓글로 평탄화되도록
   *   호출 측(CommentComposer/페이지)에서 보장.
   */
  parentId?: string | null;
  /** "@닉네임" 으로 호명한 사용자 (대댓글의 답글일 때만). 익명 게시판은 항상 null. */
  mentionUserId?: string | null;
}): Promise<{ error: string | null; commentId: string | null }> {
  const payload: Record<string, unknown> = {
    author_id: input.authorId,
    post_id: input.postId,
    content: input.content,
    parent_id: input.parentId ?? null,
  };
  if (input.mentionUserId) {
    payload.mention_user_id = input.mentionUserId;
  }

  let { data, error } = await supabase
    .from("comments")
    .insert(payload)
    .select("id")
    .single();

  // mention_user_id 컬럼이 아직 없는 환경(마이그레이션 012 미적용) 폴백 —
  // 동일 행을 mention_user_id 없이 다시 INSERT
  if (error && input.mentionUserId && /mention_user_id/.test(error.message)) {
    console.warn(
      "[createComment] mention_user_id 컬럼 미적용 — 폴백 INSERT",
      error.message,
    );
    const fallback = await supabase
      .from("comments")
      .insert({
        author_id: input.authorId,
        post_id: input.postId,
        content: input.content,
        parent_id: input.parentId ?? null,
      })
      .select("id")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("[createComment] 실패", error);
    return { error: error.message, commentId: null };
  }
  return { error: null, commentId: (data?.id as string | undefined) ?? null };
}

export async function deleteComment(commentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) {
    console.error("[deleteComment] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

/**
 * 댓글 리액션 토글 (좋아요/싫어요).
 *   - 없음 → INSERT (reaction 활성화)
 *   - 같은 버튼 재클릭 → DELETE (리액션 취소)
 *   - 다른 버튼 클릭 → UPDATE (like ↔ dislike 전환)
 */
export async function toggleCommentReaction(
  commentId: string,
  reaction: "like" | "dislike",
): Promise<{
  error: string | null;
  my_reaction: "like" | "dislike" | null;
  like_count: number;
}> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) {
    return { error: "로그인이 필요해요.", my_reaction: null, like_count: 0 };
  }

  const { data: existing, error: readErr } = await supabase
    .from("comment_reactions")
    .select("reaction")
    .eq("comment_id", commentId)
    .eq("user_id", uid)
    .maybeSingle();

  if (readErr) {
    return { error: readErr.message, my_reaction: null, like_count: 0 };
  }

  let nextReaction: "like" | "dislike" | null = null;

  if (!existing) {
    const { error: insErr } = await supabase
      .from("comment_reactions")
      .insert({ comment_id: commentId, user_id: uid, reaction });
    if (insErr) return { error: insErr.message, my_reaction: null, like_count: 0 };
    nextReaction = reaction;
  } else if ((existing as { reaction: string }).reaction === reaction) {
    const { error: delErr } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", uid);
    if (delErr) return { error: delErr.message, my_reaction: reaction, like_count: 0 };
    nextReaction = null;
  } else {
    const { error: updErr } = await supabase
      .from("comment_reactions")
      .update({ reaction })
      .eq("comment_id", commentId)
      .eq("user_id", uid);
    if (updErr) return { error: updErr.message, my_reaction: (existing as { reaction: "like" | "dislike" }).reaction, like_count: 0 };
    nextReaction = reaction;
  }

  const { count } = await supabase
    .from("comment_reactions")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId)
    .eq("reaction", "like");

  return { error: null, my_reaction: nextReaction, like_count: count ?? 0 };
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
  const uid = await getCurrentUserId();
  const posts = ((data ?? []) as unknown as RawPost[]).map((r) =>
    normalizePost(r, uid),
  );
  posts.sort(
    (a, b) =>
      b.like_count + b.view_count - (a.like_count + a.view_count),
  );
  return posts.slice(0, limit);
}

/** 전체 게시판 통합 최신글 — 대시보드 피드용 */
export async function getLatestPosts(limit: number = 15): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getLatestPosts] 실패", error);
    return [];
  }
  const uid = await getCurrentUserId();
  return ((data ?? []) as unknown as RawPost[]).map((r) =>
    normalizePost(r, uid),
  );
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

/**
 * board_type 별 가장 최근 글의 created_at(ISO 문자열) — TopBar 메가메뉴 NEW 뱃지용.
 * 24시간 이내 새 글 여부를 클라이언트에서 비교하기 위해 사용한다.
 */
export async function getBoardLatestDates(): Promise<Partial<Record<BoardType, string>>> {
  const { data, error } = await supabase
    .from("posts")
    .select("board_type, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("[getBoardLatestDates] 실패", error);
    return {};
  }
  const latest: Partial<Record<BoardType, string>> = {};
  for (const row of data as Array<{ board_type: BoardType; created_at: string }>) {
    // order desc 이므로 board_type 별 첫 등장이 최신값.
    if (latest[row.board_type] === undefined) {
      latest[row.board_type] = row.created_at;
    }
  }
  return latest;
}

// ─────────────────────────────────────────────────────────
// 나눔장터 — content 안에 { condition, description } JSON
// ─────────────────────────────────────────────────────────

export type MarketCondition = "new" | "good" | "used";
export const MARKET_CONDITION_LABEL: Record<MarketCondition, string> = {
  new: "새상품",
  good: "사용감 있음",
  used: "사용감 많음",
};

export type MarketContent = {
  condition: MarketCondition;
  description: string;
};

const VALID_CONDITIONS: MarketCondition[] = ["new", "good", "used"];

/** 한국어 라벨도 받아주는 호환 파서 (시드 데이터가 한글로 저장된 경우 대비) */
function normalizeCondition(input: unknown): MarketCondition {
  if (typeof input !== "string") return "good";
  if ((VALID_CONDITIONS as string[]).includes(input)) {
    return input as MarketCondition;
  }
  // 한국어 → 키
  if (input.includes("새")) return "new";
  if (input.includes("많음")) return "used";
  if (input.includes("있음")) return "good";
  return "good";
}

export function parseMarketContent(content: string): MarketContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "description" in obj &&
      typeof (obj as { description: unknown }).description === "string"
    ) {
      const o = obj as { condition?: unknown; description: string };
      return {
        condition: normalizeCondition(o.condition),
        description: o.description,
      };
    }
  } catch {
    // 일반 텍스트
  }
  return { condition: "good", description: content };
}

export function stringifyMarketContent(input: MarketContent): string {
  return JSON.stringify({
    condition: input.condition,
    description: input.description.trim(),
  });
}

// ─────────────────────────────────────────────────────────
// 이슈토론 — content 안에 { description, optionA, optionB } JSON
// ─────────────────────────────────────────────────────────

export type IssueContent = {
  /** 토론 배경/설명 */
  description: string;
  /** A 선택지 라벨 (기본: 찬성) */
  optionA: string;
  /** B 선택지 라벨 (기본: 반대) */
  optionB: string;
};

export function parseIssueContent(content: string): IssueContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "description" in obj &&
      typeof (obj as { description: unknown }).description === "string"
    ) {
      const o = obj as {
        description: string;
        optionA?: unknown;
        optionB?: unknown;
      };
      return {
        description: o.description,
        optionA: typeof o.optionA === "string" && o.optionA.trim() ? o.optionA : "찬성",
        optionB: typeof o.optionB === "string" && o.optionB.trim() ? o.optionB : "반대",
      };
    }
  } catch {
    // 일반 텍스트
  }
  return { description: content, optionA: "찬성", optionB: "반대" };
}

export function stringifyIssueContent(input: IssueContent): string {
  return JSON.stringify({
    description: input.description.trim(),
    optionA: input.optionA.trim() || "찬성",
    optionB: input.optionB.trim() || "반대",
  });
}

// ─────────────────────────────────────────────────────────
// 학습 Q&A — content 안에 { subject, question } JSON
// ─────────────────────────────────────────────────────────

export const QA_SUBJECTS = [
  { value: "korean", label: "국어" },
  { value: "english", label: "영어" },
  { value: "math", label: "수학" },
  { value: "science", label: "과학" },
  { value: "social", label: "사회" },
  { value: "etc", label: "기타" },
] as const;

export type QaSubject = (typeof QA_SUBJECTS)[number]["value"];

const QA_SUBJECT_VALUES: ReadonlySet<string> = new Set(
  QA_SUBJECTS.map((s) => s.value),
);

export function getQaSubjectLabel(subject: QaSubject): string {
  return QA_SUBJECTS.find((s) => s.value === subject)?.label ?? "기타";
}

/** 과목별 색상 클래스 — 뱃지/필터에서 공통 사용 */
export const QA_SUBJECT_STYLE: Record<QaSubject, string> = {
  korean:
    "bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300",
  english:
    "bg-blue-500/15 text-blue-600 ring-blue-500/30 dark:text-blue-300",
  math:
    "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
  science:
    "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300",
  social:
    "bg-orange-500/15 text-orange-600 ring-orange-500/30 dark:text-orange-300",
  etc:
    "bg-gray-500/15 text-gray-600 ring-gray-500/30 dark:text-gray-300",
};

export type QaContent = {
  subject: QaSubject;
  question: string;
};

export function parseQaContent(content: string): QaContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "question" in obj &&
      typeof (obj as { question: unknown }).question === "string"
    ) {
      const o = obj as { subject?: unknown; question: string };
      const subject: QaSubject =
        typeof o.subject === "string" && QA_SUBJECT_VALUES.has(o.subject)
          ? (o.subject as QaSubject)
          : "etc";
      return { subject, question: o.question };
    }
  } catch {
    // 일반 텍스트
  }
  return { subject: "etc", question: content };
}

export function stringifyQaContent(input: QaContent): string {
  return JSON.stringify({
    subject: input.subject,
    question: input.question.trim(),
  });
}

// ─────────────────────────────────────────────────────────
// 문튜브 — content 안에 { youtubeUrl, videoId, description } JSON
// ─────────────────────────────────────────────────────────

/** 문튜브 카테고리 */
export const YOUTUBE_CATEGORIES = [
  { value: "exam", label: "수능·입시", emoji: "📐" },
  { value: "record", label: "생기부·세특", emoji: "📝" },
  { value: "knowledge", label: "교양·지식", emoji: "🧠" },
  { value: "etc", label: "기타", emoji: "🎮" },
] as const;

export type YoutubeCategory = (typeof YOUTUBE_CATEGORIES)[number]["value"];

const YOUTUBE_CATEGORY_VALUES: ReadonlySet<string> = new Set(
  YOUTUBE_CATEGORIES.map((c) => c.value),
);

export function getYoutubeCategoryLabel(c: YoutubeCategory): string {
  return YOUTUBE_CATEGORIES.find((x) => x.value === c)?.label ?? "기타";
}

export const YOUTUBE_CATEGORY_STYLE: Record<YoutubeCategory, string> = {
  exam: "bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300",
  record: "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300",
  knowledge: "bg-cyan-500/15 text-cyan-600 ring-cyan-500/30 dark:text-cyan-300",
  etc: "bg-gray-500/15 text-gray-600 ring-gray-500/30 dark:text-gray-300",
};

export type YoutubeContent = {
  /** 카테고리 — 수능·입시 / 생기부·세특 / 교양·지식 / 기타 */
  category: YoutubeCategory;
  /** 사용자가 입력한 원본 URL (참조용) */
  youtubeUrl: string;
  /** 추출된 11자리 비디오 ID */
  videoId: string;
  /** 영상 설명 */
  description: string;
};

/** 유튜브 URL 또는 11자리 ID 에서 videoId 추출. 실패 시 null. */
export function extractYoutubeId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = v.match(re);
    if (m) return m[1];
  }
  return null;
}

export function youtubeThumbUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function parseYoutubeContent(content: string): YoutubeContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "videoId" in obj &&
      typeof (obj as { videoId: unknown }).videoId === "string"
    ) {
      const o = obj as {
        category?: unknown;
        youtubeUrl?: unknown;
        videoId: string;
        description?: unknown;
      };
      const category: YoutubeCategory =
        typeof o.category === "string" && YOUTUBE_CATEGORY_VALUES.has(o.category)
          ? (o.category as YoutubeCategory)
          : "etc";
      return {
        category,
        youtubeUrl: typeof o.youtubeUrl === "string" ? o.youtubeUrl : "",
        videoId: o.videoId,
        description: typeof o.description === "string" ? o.description : "",
      };
    }
  } catch {
    // 일반 텍스트 — videoId 추출 시도
  }
  const id = extractYoutubeId(content);
  return {
    category: "etc",
    youtubeUrl: id ? content : "",
    videoId: id ?? "",
    description: id ? "" : content,
  };
}

export function stringifyYoutubeContent(input: YoutubeContent): string {
  return JSON.stringify({
    category: input.category,
    youtubeUrl: input.youtubeUrl.trim(),
    videoId: input.videoId.trim(),
    description: input.description.trim(),
  });
}

// ─────────────────────────────────────────────────────────
// 자료실 — content 안에 { category, description } JSON
// ─────────────────────────────────────────────────────────

export const RESOURCE_CATEGORIES = [
  { value: "exam", label: "기출문제" },
  { value: "study", label: "학습자료" },
  { value: "form", label: "양식·서류" },
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]["value"];

const RESOURCE_CATEGORY_VALUES: ReadonlySet<string> = new Set(
  RESOURCE_CATEGORIES.map((c) => c.value),
);

export function getResourceCategoryLabel(c: ResourceCategory): string {
  return RESOURCE_CATEGORIES.find((x) => x.value === c)?.label ?? "학습자료";
}

export const RESOURCE_CATEGORY_STYLE: Record<ResourceCategory, string> = {
  exam: "bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300",
  study: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
  form: "bg-blue-500/15 text-blue-600 ring-blue-500/30 dark:text-blue-300",
};

export type ResourceContent = {
  category: ResourceCategory;
  description: string;
};

export function parseResourceContent(content: string): ResourceContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "description" in obj &&
      typeof (obj as { description: unknown }).description === "string"
    ) {
      const o = obj as { category?: unknown; description: string };
      const category: ResourceCategory =
        typeof o.category === "string" && RESOURCE_CATEGORY_VALUES.has(o.category)
          ? (o.category as ResourceCategory)
          : "study";
      return { category, description: o.description };
    }
  } catch {
    // 일반 텍스트
  }
  return { category: "study", description: content };
}

export function stringifyResourceContent(input: ResourceContent): string {
  return JSON.stringify({
    category: input.category,
    description: input.description.trim(),
  });
}

// ─────────────────────────────────────────────────────────
// 스터디 — content 안에 { subject, maxMembers, schedule, location, description } JSON
// ─────────────────────────────────────────────────────────

export const STUDY_SUBJECTS = [
  { value: "korean", label: "국어" },
  { value: "english", label: "영어" },
  { value: "math", label: "수학" },
  { value: "science", label: "과학" },
  { value: "social", label: "사회" },
  { value: "etc", label: "기타" },
] as const;

export type StudySubject = (typeof STUDY_SUBJECTS)[number]["value"];

const STUDY_SUBJECT_VALUES: ReadonlySet<string> = new Set(
  STUDY_SUBJECTS.map((s) => s.value),
);

export function getStudySubjectLabel(s: StudySubject): string {
  return STUDY_SUBJECTS.find((x) => x.value === s)?.label ?? "기타";
}

export const STUDY_SUBJECT_STYLE: Record<StudySubject, string> = {
  korean: "bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300",
  english: "bg-blue-500/15 text-blue-600 ring-blue-500/30 dark:text-blue-300",
  math: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
  science: "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300",
  social: "bg-orange-500/15 text-orange-600 ring-orange-500/30 dark:text-orange-300",
  etc: "bg-gray-500/15 text-gray-600 ring-gray-500/30 dark:text-gray-300",
};

export type StudyContent = {
  subject: StudySubject;
  /** 최대 모집 인원 */
  maxMembers: number;
  /** 시간대 ("매주 월/수 18-20시" 등 자유서술) */
  schedule: string;
  /** 장소 ("도서관 3층 그룹실" 등) */
  location: string;
  description: string;
};

export function parseStudyContent(content: string): StudyContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "description" in obj &&
      typeof (obj as { description: unknown }).description === "string"
    ) {
      const o = obj as {
        subject?: unknown;
        maxMembers?: unknown;
        schedule?: unknown;
        location?: unknown;
        description: string;
      };
      const subject: StudySubject =
        typeof o.subject === "string" && STUDY_SUBJECT_VALUES.has(o.subject)
          ? (o.subject as StudySubject)
          : "etc";
      const max =
        typeof o.maxMembers === "number" && Number.isFinite(o.maxMembers)
          ? Math.max(1, Math.min(99, Math.floor(o.maxMembers)))
          : 4;
      return {
        subject,
        maxMembers: max,
        schedule: typeof o.schedule === "string" ? o.schedule : "",
        location: typeof o.location === "string" ? o.location : "",
        description: o.description,
      };
    }
  } catch {
    // 일반 텍스트
  }
  return {
    subject: "etc",
    maxMembers: 4,
    schedule: "",
    location: "",
    description: content,
  };
}

export function stringifyStudyContent(input: StudyContent): string {
  return JSON.stringify({
    subject: input.subject,
    maxMembers: input.maxMembers,
    schedule: input.schedule.trim(),
    location: input.location.trim(),
    description: input.description.trim(),
  });
}

// ─────────────────────────────────────────────────────────
// 졸업생 — "선배에게 물어봐" content JSON:
//   { category, university, major, graduationYear, description }
// ─────────────────────────────────────────────────────────

/** 등록 가능한 졸업연도 후보 (최신 순) */
export const ALUMNI_YEARS: number[] = (() => {
  const now = new Date().getFullYear();
  // 2020 ~ 현재 연도까지 최신순으로
  const min = 2020;
  const arr: number[] = [];
  for (let y = now; y >= min; y--) arr.push(y);
  return arr;
})();

/** 선배에게 물어봐 카테고리 (1:1 멘토 매칭은 Coming Soon 이라 글쓰기에는 노출하지 않음) */
export type AlumniCategory =
  | "college-life" // 대학 생활 리얼 후기
  | "why-this-major" // 이 과를 선택한 이유
  | "admission-tips" // 입시 꿀팁 모음
  | "looking-back"; // 학교 밖에서 본 문태고

export const ALUMNI_CATEGORIES: { value: AlumniCategory; label: string; emoji: string }[] = [
  { value: "college-life", label: "대학 생활 리얼 후기", emoji: "🏫" },
  { value: "why-this-major", label: "이 과를 선택한 이유", emoji: "📚" },
  { value: "admission-tips", label: "입시 꿀팁 모음", emoji: "💡" },
  { value: "looking-back", label: "학교 밖에서 본 문태고", emoji: "🔙" },
];

export function getAlumniCategoryLabel(value: AlumniCategory | string): string {
  return ALUMNI_CATEGORIES.find((c) => c.value === value)?.label ?? "기타";
}

export type AlumniContent = {
  category: AlumniCategory;
  university: string;
  major: string;
  graduationYear: number;
  description: string;
};

function isAlumniCategory(v: unknown): v is AlumniCategory {
  return (
    v === "college-life" ||
    v === "why-this-major" ||
    v === "admission-tips" ||
    v === "looking-back"
  );
}

export function parseAlumniContent(content: string): AlumniContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "description" in obj &&
      typeof (obj as { description: unknown }).description === "string"
    ) {
      const o = obj as {
        category?: unknown;
        university?: unknown;
        major?: unknown;
        graduationYear?: unknown;
        description: string;
      };
      const y =
        typeof o.graduationYear === "number" && Number.isFinite(o.graduationYear)
          ? Math.floor(o.graduationYear)
          : ALUMNI_YEARS[0] ?? new Date().getFullYear();
      return {
        category: isAlumniCategory(o.category) ? o.category : "college-life",
        university: typeof o.university === "string" ? o.university : "",
        major: typeof o.major === "string" ? o.major : "",
        graduationYear: y,
        description: o.description,
      };
    }
  } catch {
    // 일반 텍스트
  }
  return {
    category: "college-life",
    university: "",
    major: "",
    graduationYear: ALUMNI_YEARS[0] ?? new Date().getFullYear(),
    description: content,
  };
}

export function stringifyAlumniContent(input: AlumniContent): string {
  return JSON.stringify({
    category: input.category,
    university: input.university.trim(),
    major: input.major.trim(),
    graduationYear: input.graduationYear,
    description: input.description.trim(),
  });
}

// ─────────────────────────────────────────────────────────
// 진로 탐색 로드맵 — content 안에
//   { track, university, major, graduationYear, summary, review } JSON
// ─────────────────────────────────────────────────────────

/** 5개 진로 계열 */
export type CareerTrack =
  | "science" // 이공계
  | "humanities" // 인문계
  | "social" // 사회계
  | "arts" // 예체능
  | "medical"; // 의약계

export const CAREER_TRACKS: { value: CareerTrack; label: string; emoji: string }[] = [
  { value: "science", label: "이공계", emoji: "🔬" },
  { value: "humanities", label: "인문계", emoji: "📖" },
  { value: "social", label: "사회계", emoji: "🏛" },
  { value: "arts", label: "예체능", emoji: "🎨" },
  { value: "medical", label: "의약계", emoji: "🏥" },
];

export function getCareerTrackLabel(value: CareerTrack | string): string {
  return CAREER_TRACKS.find((t) => t.value === value)?.label ?? "기타";
}

function isCareerTrack(v: unknown): v is CareerTrack {
  return (
    v === "science" ||
    v === "humanities" ||
    v === "social" ||
    v === "arts" ||
    v === "medical"
  );
}

export type SeniorContent = {
  track: CareerTrack;
  university: string;
  major: string;
  graduationYear: number;
  /** 한줄 요약 */
  summary: string;
  /** 본문 후기 */
  review: string;
};

export function parseSeniorContent(content: string): SeniorContent {
  try {
    const obj: unknown = JSON.parse(content);
    if (
      obj &&
      typeof obj === "object" &&
      "review" in obj &&
      typeof (obj as { review: unknown }).review === "string"
    ) {
      const o = obj as {
        track?: unknown;
        university?: unknown;
        major?: unknown;
        graduationYear?: unknown;
        summary?: unknown;
        review: string;
      };
      const y =
        typeof o.graduationYear === "number" && Number.isFinite(o.graduationYear)
          ? Math.floor(o.graduationYear)
          : ALUMNI_YEARS[0] ?? new Date().getFullYear();
      return {
        track: isCareerTrack(o.track) ? o.track : "science",
        university: typeof o.university === "string" ? o.university : "",
        major: typeof o.major === "string" ? o.major : "",
        graduationYear: y,
        summary: typeof o.summary === "string" ? o.summary : "",
        review: o.review,
      };
    }
  } catch {
    // 일반 텍스트
  }
  return {
    track: "science",
    university: "",
    major: "",
    graduationYear: ALUMNI_YEARS[0] ?? new Date().getFullYear(),
    summary: "",
    review: content,
  };
}

export function stringifySeniorContent(input: SeniorContent): string {
  return JSON.stringify({
    track: input.track,
    university: input.university.trim(),
    major: input.major.trim(),
    graduationYear: input.graduationYear,
    summary: input.summary.trim(),
    review: input.review.trim(),
  });
}

// ─────────────────────────────────────────────────────────
// 익명 게시판 전용 RPC 래퍼
// DB 에서 이미 sanitize 된 데이터만 반환 — author_id, profiles join 없음
// ─────────────────────────────────────────────────────────

// RPC 반환 타입 (내부 전용)
type AnonPostRpc = {
  id: string;
  board_type: string;
  title: string;
  content: string;
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
  view_count: number;
  like_count: number;
  is_pinned: boolean;
  status: string;
  vote_a: number;
  vote_b: number;
  created_at: string;
  updated_at: string;
  comment_count: number;
  is_mine: boolean;
  total_count?: number;
};

type AnonCommentRpc = {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  is_mine: boolean;
  is_post_author: boolean;
  anon_seed: string;
  like_count: number;
  my_reaction: "like" | "dislike" | null;
};

function anonPostToPostRow(r: AnonPostRpc): PostRow {
  return {
    id: r.id,
    author_id: "",
    board_type: r.board_type as BoardType,
    title: r.title,
    content: r.content,
    image_url: r.image_url,
    file_url: r.file_url,
    file_name: r.file_name,
    view_count: r.view_count,
    like_count: r.like_count,
    is_pinned: r.is_pinned,
    status: (r.status as PostStatus) ?? "active",
    vote_a: r.vote_a,
    vote_b: r.vote_b,
    created_at: r.created_at,
    updated_at: r.updated_at,
    author: null,
    comment_count: r.comment_count,
    is_mine: r.is_mine,
    // 익명 게시판은 학습게시판이 아니므로 학습 태그 컬럼은 항상 null.
    grade: null,
    subject_tag: null,
    post_category: null,
    // 익명 게시판은 챌린지가 아니므로 챌린지 상태도 null.
    challenge_status: null,
    challenge_rejected_reason: null,
  };
}

function anonCommentToCommentRow(r: AnonCommentRpc): CommentRow {
  return {
    id: r.id,
    post_id: r.post_id,
    parent_id: r.parent_id,
    author_id: "",
    content: r.content,
    created_at: r.created_at,
    author: null,
    is_mine: r.is_mine,
    is_post_author: r.is_post_author,
    anon_seed: r.anon_seed,
    mention_user_id: null,
    mention_user: null,
    like_count: r.like_count,
    my_reaction: r.my_reaction,
  };
}

/** 익명 게시판 글 단건 — DB RPC 로 author_id/profiles 노출 없이 반환 */
export async function getAnonymousPost(postId: string): Promise<PostRow | null> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .rpc("get_anon_post", { p_post_id: postId, p_user_id: uid ?? null })
    .maybeSingle();
  if (error) {
    console.error("[getAnonymousPost] 실패", error);
    return null;
  }
  if (!data) return null;
  return anonPostToPostRow(data as AnonPostRpc);
}

/** 익명 게시판 댓글 목록 — DB RPC 로 anon_seed/is_mine/is_post_author 만 반환 */
export async function listAnonymousComments(postId: string): Promise<CommentRow[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.rpc("list_anon_comments", {
    p_post_id: postId,
    p_user_id: uid ?? null,
  });
  if (error) {
    console.error("[listAnonymousComments] 실패", error);
    return [];
  }
  return ((data ?? []) as AnonCommentRpc[]).map(anonCommentToCommentRow);
}

/** 익명 게시판 글 목록 — DB RPC, total_count 는 윈도우 함수로 별도 쿼리 불필요 */
export async function listAnonymousPosts(
  page: number = 1,
  options?: {
    contentLike?: string | null;
    sortBy?: "created_at" | "like_count";
  },
): Promise<{ posts: PostRow[]; total: number }> {
  const uid = await getCurrentUserId();
  const from = (page - 1) * POSTS_PER_PAGE;
  const { data, error } = await supabase.rpc("list_anon_posts", {
    p_user_id: uid ?? null,
    p_limit: POSTS_PER_PAGE,
    p_offset: from,
    p_content_like: options?.contentLike ?? null,
    p_sort: options?.sortBy ?? "created_at",
  });
  if (error) {
    console.error("[listAnonymousPosts] 실패", error);
    return { posts: [], total: 0 };
  }
  const rows = (data ?? []) as AnonPostRpc[];
  const total = rows[0]?.total_count ?? 0;
  return { posts: rows.map(anonPostToPostRow), total: Number(total) };
}

// ─────────────────────────────────────────────────────────
// 좋아요 / 투표 mutator
// ─────────────────────────────────────────────────────────

/**
 * 좋아요 토글.
 *   - post_likes 에 (user_id, post_id) 행이 있으면 DELETE → 트리거가 like_count -1
 *   - 없으면 INSERT → 트리거가 like_count +1
 *
 *   서버 트리거가 카운트를 동기화하므로 클라이언트는 토글 결과만 확정.
 *   like_count 는 트리거 적용 후 최신 값을 다시 조회해서 돌려준다.
 */
export async function toggleLike(
  postId: string,
): Promise<{ error: string | null; liked: boolean; like_count: number | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) {
    return { error: "로그인이 필요해요.", liked: false, like_count: null };
  }

  const { data: existing, error: readErr } = await supabase
    .from("post_likes")
    .select("user_id")
    .eq("user_id", uid)
    .eq("post_id", postId)
    .maybeSingle();
  if (readErr) {
    return { error: readErr.message, liked: false, like_count: null };
  }

  if (existing) {
    const { error: delErr } = await supabase
      .from("post_likes")
      .delete()
      .eq("user_id", uid)
      .eq("post_id", postId);
    if (delErr) {
      return { error: delErr.message, liked: true, like_count: null };
    }
    const { data: row } = await supabase
      .from("posts")
      .select("like_count")
      .eq("id", postId)
      .maybeSingle();
    return { error: null, liked: false, like_count: row?.like_count ?? null };
  }

  const { error: insErr } = await supabase
    .from("post_likes")
    .insert({ user_id: uid, post_id: postId });
  if (insErr) {
    // 동일 PK 중복 INSERT (rapid double-click) — 이미 좋아요 상태로 간주.
    // 이 경우는 신규 좋아요가 아니므로 알림 생성 안 함.
    const { data: row } = await supabase
      .from("posts")
      .select("like_count")
      .eq("id", postId)
      .maybeSingle();
    return {
      error: insErr.code === "23505" ? null : insErr.message,
      liked: true,
      like_count: row?.like_count ?? null,
    };
  }

  // 신규 좋아요 INSERT 성공 — 글 작성자에게 알림. UX 가 막히지 않도록 await 하지 않음.
  // notify.ts 가 자기 자신 / 수신자 설정 / 익명 마스킹 모두 가드.
  notifyLike({ postId, actorId: uid });

  const { data: row } = await supabase
    .from("posts")
    .select("like_count")
    .eq("id", postId)
    .maybeSingle();
  return { error: null, liked: true, like_count: row?.like_count ?? null };
}

/**
 * 현재 로그인 유저가 이미 좋아요한 글 ID 집합.
 * 목록/상세 페이지의 초기 liked 상태 hydrate 용.
 */
export async function getLikedPostIds(
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return new Set();

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", uid)
    .in("post_id", postIds);
  if (error || !data) return new Set();
  return new Set((data as Array<{ post_id: string }>).map((r) => r.post_id));
}

/** 이슈 토론 투표 +1 (a or b) — read-then-update */
export async function votePost(
  postId: string,
  choice: "a" | "b",
): Promise<{ error: string | null; voteA: number; voteB: number }> {
  const col = choice === "a" ? "vote_a" : "vote_b";
  const { data, error: readErr } = await supabase
    .from("posts")
    .select("vote_a, vote_b")
    .eq("id", postId)
    .maybeSingle();
  if (readErr || !data) {
    return {
      error: readErr?.message ?? "글을 찾을 수 없어요.",
      voteA: 0,
      voteB: 0,
    };
  }
  const voteA = data.vote_a ?? 0;
  const voteB = data.vote_b ?? 0;
  const next = (col === "vote_a" ? voteA : voteB) + 1;
  const { error: writeErr } = await supabase
    .from("posts")
    .update({ [col]: next })
    .eq("id", postId);
  if (writeErr) {
    return { error: writeErr.message, voteA, voteB };
  }
  return {
    error: null,
    voteA: choice === "a" ? next : voteA,
    voteB: choice === "b" ? next : voteB,
  };
}

// ─────────────────────────────────────────────────────────
// 챌린지 — 연속 인증, 주간 랭킹
// ─────────────────────────────────────────────────────────

const STREAK_LOOKBACK_DAYS = 60; // 연속 계산 시 충분히 거슬러 올라가는 범위
const RANKING_LOOKBACK_DAYS = 7;

type ChallengePost = {
  author_id: string;
  created_at: string;
  post_category: ChallengeCategory | null;
  challenge_status: ChallengeStatus | null;
  author: { id: string; nickname: string; role: Role } | null;
};

function ymdInKst(iso: string): string {
  // 학교가 있는 한국 기준으로 날짜만 추출. timezone offset 처리.
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // yyyy-mm-dd
}

function todayKst(): string {
  return ymdInKst(new Date().toISOString());
}

function dateBefore(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** 주간 랭킹 한 줄 */
export type ChallengeRankRow = {
  author_id: string;
  nickname: string;
  role: Role;
  count: number;
};

/** 챌린지 글의 작성자별 연속 인증일수 + 주간 랭킹 캐시 (전체 + 카테고리별) */
export type ChallengeStats = {
  /** 전체 통합 — author_id → 현재 연속일수 */
  streakByAuthor: Record<string, number>;
  /** 카테고리별 — category → author_id → 연속일수 */
  streakByAuthorByCategory: Record<ChallengeCategory, Record<string, number>>;
  /** 최근 7일 전체 랭킹 (TOP 5) */
  weeklyRanking: ChallengeRankRow[];
  /** 카테고리별 최근 7일 랭킹 (각 TOP 5) */
  weeklyRankingByCategory: Record<ChallengeCategory, ChallengeRankRow[]>;
  /** 카테고리별 활성 참여자 수 */
  participantCounts: Record<ChallengeCategory, number>;
};

const CHALLENGE_CATEGORIES: ChallengeCategory[] = [
  "attendance",
  "study_cert",
  "exercise",
];

const emptyByCategory = <T>(make: () => T): Record<ChallengeCategory, T> => ({
  attendance: make(),
  study_cert: make(),
  exercise: make(),
});

/** 인증 날짜 집합으로부터 연속일수 산출 — 오늘/어제 grace 1회 */
function computeStreak(
  set: Set<string>,
  today: string,
  yesterday: string,
): number {
  let cursor: string;
  if (set.has(today)) cursor = today;
  else if (set.has(yesterday)) cursor = yesterday;
  else return 0;
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = dateBefore(cursor, 1);
  }
  return count;
}

export async function getChallengeStats(): Promise<ChallengeStats> {
  const since = dateBefore(todayKst(), STREAK_LOOKBACK_DAYS);
  const [postsRes, partRes] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "author_id, created_at, post_category, challenge_status, author:profiles!author_id ( id, nickname, role )",
      )
      .eq("board_type", "challenge")
      .gte("created_at", since + "T00:00:00+09:00")
      .order("created_at", { ascending: false }),
    supabase
      .from("challenge_participants")
      .select("category")
      .eq("is_active", true),
  ]);

  const participantCounts = emptyByCategory<number>(() => 0);
  if (!partRes.error && partRes.data) {
    for (const row of partRes.data as Array<{ category: ChallengeCategory }>) {
      if (CHALLENGE_CATEGORIES.includes(row.category)) {
        participantCounts[row.category]++;
      }
    }
  }

  const empty: ChallengeStats = {
    streakByAuthor: {},
    streakByAuthorByCategory: emptyByCategory(() => ({})),
    weeklyRanking: [],
    weeklyRankingByCategory: emptyByCategory(() => []),
    participantCounts,
  };

  if (postsRes.error || !postsRes.data) {
    if (postsRes.error) console.error("[getChallengeStats] 실패", postsRes.error);
    return empty;
  }

  // rejected 글은 통계에서 제외 — challenge_status 가 NULL/'approved' 면 정상.
  const rows = (postsRes.data as unknown as ChallengePost[]).filter(
    (r) => (r.challenge_status ?? "approved") !== "rejected",
  );

  // 전체 + 카테고리별 인증 날짜 집합
  const datesAll = new Map<string, Set<string>>();
  const datesByCat: Record<ChallengeCategory, Map<string, Set<string>>> =
    emptyByCategory(() => new Map<string, Set<string>>());
  // 작성자 메타
  const authorMeta = new Map<string, { nickname: string; role: Role }>();
  // 7일 카운트
  const weeklyAll = new Map<string, number>();
  const weeklyByCat: Record<ChallengeCategory, Map<string, number>> =
    emptyByCategory(() => new Map<string, number>());
  const weeklyCutoff = dateBefore(todayKst(), RANKING_LOOKBACK_DAYS - 1);

  for (const row of rows) {
    const day = ymdInKst(row.created_at);
    if (!datesAll.has(row.author_id)) datesAll.set(row.author_id, new Set());
    datesAll.get(row.author_id)!.add(day);

    if (row.author && !authorMeta.has(row.author_id)) {
      authorMeta.set(row.author_id, {
        nickname: row.author.nickname,
        role: row.author.role,
      });
    }

    if (day >= weeklyCutoff) {
      weeklyAll.set(row.author_id, (weeklyAll.get(row.author_id) ?? 0) + 1);
    }

    const cat = row.post_category;
    if (cat && CHALLENGE_CATEGORIES.includes(cat)) {
      const map = datesByCat[cat];
      if (!map.has(row.author_id)) map.set(row.author_id, new Set());
      map.get(row.author_id)!.add(day);

      if (day >= weeklyCutoff) {
        const wm = weeklyByCat[cat];
        wm.set(row.author_id, (wm.get(row.author_id) ?? 0) + 1);
      }
    }
  }

  // 연속일수 계산
  const today = todayKst();
  const yesterday = dateBefore(today, 1);
  const streakByAuthor: Record<string, number> = {};
  for (const [authorId, set] of datesAll.entries()) {
    streakByAuthor[authorId] = computeStreak(set, today, yesterday);
  }
  const streakByAuthorByCategory = emptyByCategory<Record<string, number>>(
    () => ({}),
  );
  for (const cat of CHALLENGE_CATEGORIES) {
    for (const [authorId, set] of datesByCat[cat].entries()) {
      streakByAuthorByCategory[cat][authorId] = computeStreak(
        set,
        today,
        yesterday,
      );
    }
  }

  // 주간 랭킹 정렬 헬퍼
  const sortRanking = (counts: Map<string, number>): ChallengeRankRow[] =>
    Array.from(counts.entries())
      .map(([author_id, count]) => {
        const meta = authorMeta.get(author_id);
        return {
          author_id,
          nickname: meta?.nickname ?? "(알수없음)",
          role: meta?.role ?? ("student" as Role),
          count,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.nickname.localeCompare(b.nickname, "ko");
      })
      .slice(0, 5);

  const weeklyRanking = sortRanking(weeklyAll);
  const weeklyRankingByCategory = emptyByCategory<ChallengeRankRow[]>(() => []);
  for (const cat of CHALLENGE_CATEGORIES) {
    weeklyRankingByCategory[cat] = sortRanking(weeklyByCat[cat]);
  }

  return {
    streakByAuthor,
    streakByAuthorByCategory,
    weeklyRanking,
    weeklyRankingByCategory,
    participantCounts,
  };
}

// ─────────────────────────────────────────────────────────
// 챌린지 — 참여자 관리 (challenge_participants)
// ─────────────────────────────────────────────────────────

/** 현재 사용자가 참여 중(is_active=true)인 카테고리 목록 */
export async function getMyChallengeSubs(): Promise<ChallengeCategory[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("challenge_participants")
    .select("category")
    .eq("user_id", uid)
    .eq("is_active", true);
  if (error || !data) {
    if (error) console.warn("[getMyChallengeSubs] 실패", error);
    return [];
  }
  return (data as Array<{ category: ChallengeCategory }>)
    .map((r) => r.category)
    .filter((c): c is ChallengeCategory => CHALLENGE_CATEGORIES.includes(c));
}

/** 카테고리 참여 — upsert (is_active=true) */
export async function joinChallenge(
  category: ChallengeCategory,
): Promise<{ error: string | null }> {
  const uid = await getCurrentUserId();
  if (!uid) return { error: "로그인이 필요합니다" };
  const { error } = await supabase
    .from("challenge_participants")
    .upsert(
      {
        user_id: uid,
        category,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category" },
    );
  if (error) {
    console.error("[joinChallenge] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

/** 카테고리 참여 해제 — is_active=false 로 update (행은 유지) */
export async function leaveChallenge(
  category: ChallengeCategory,
): Promise<{ error: string | null }> {
  const uid = await getCurrentUserId();
  if (!uid) return { error: "로그인이 필요합니다" };
  const { error } = await supabase
    .from("challenge_participants")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("category", category);
  if (error) {
    console.error("[leaveChallenge] 실패", error);
    return { error: error.message };
  }
  return { error: null };
}

/** 카테고리별 활성 참여자 수 — 챌린지 헤더 카드용 */
export async function getChallengeParticipantCount(): Promise<
  Record<ChallengeCategory, number>
> {
  const counts = emptyByCategory<number>(() => 0);
  const { data, error } = await supabase
    .from("challenge_participants")
    .select("category")
    .eq("is_active", true);
  if (error || !data) {
    if (error) console.warn("[getChallengeParticipantCount] 실패", error);
    return counts;
  }
  for (const row of data as Array<{ category: ChallengeCategory }>) {
    if (CHALLENGE_CATEGORIES.includes(row.category)) {
      counts[row.category]++;
    }
  }
  return counts;
}

// ─────────────────────────────────────────────────────────
// 챌린지 — 관리자 인증 취소
// ─────────────────────────────────────────────────────────

/**
 * 관리자/교사가 인증을 취소 — challenge_status='rejected' + 사유 저장 + 작성자 알림.
 * RLS 가 권한 검증 (admin/teacher 만 update 가능하도록 정책 필요).
 */
export async function rejectChallengePost(
  postId: string,
  reason: string,
): Promise<{ error: string | null }> {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { error: "사유를 입력해주세요" };
  }

  // 1) 작성자 / board_type 확인 — 알림 발송용
  const { data: post, error: fetchErr } = await supabase
    .from("posts")
    .select("author_id, board_type")
    .eq("id", postId)
    .maybeSingle();
  if (fetchErr || !post) {
    return { error: fetchErr?.message ?? "글을 찾을 수 없습니다" };
  }
  if (post.board_type !== "challenge") {
    return { error: "챌린지 게시글만 인증 취소할 수 있습니다" };
  }

  // 2) status 업데이트
  const { error } = await supabase
    .from("posts")
    .update({
      challenge_status: "rejected",
      challenge_rejected_reason: trimmed,
    })
    .eq("id", postId);
  if (error) {
    console.error("[rejectChallengePost] 실패", error);
    return { error: error.message };
  }

  // 3) 작성자에게 알림 발송 (fire-and-forget — 실패해도 인증 취소는 성공)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const actorId = session?.user?.id ?? null;
    if (token && post.author_id) {
      void fetch("/api/notifications/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rows: [
            {
              user_id: post.author_id as string,
              actor_id: actorId,
              type: "challenge_reject",
              message: `챌린지 인증이 취소되었습니다. 사유: ${trimmed}`,
              post_id: postId,
              comment_id: null,
            },
          ],
        }),
      });
    }
  } catch (e) {
    console.warn("[rejectChallengePost] 알림 발송 실패 (무시)", e);
  }

  return { error: null };
}

/** 본인이 작성한 글 — /profile 페이지용 */
export async function getUserPosts(
  userId: string,
  limit: number = 20,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getUserPosts] 실패", error);
    return [];
  }
  // 본인 페이지에서 호출되므로 userId 가 곧 currentUserId
  return ((data ?? []) as unknown as RawPost[]).map((r) =>
    normalizePost(r, userId),
  );
}

/** 본인이 작성한 댓글 (소속 글 정보 포함) — /profile 페이지용 */
export type UserCommentRow = CommentRow & {
  post: {
    id: string;
    title: string;
    board_type: BoardType;
  } | null;
};

export async function getUserComments(
  userId: string,
  limit: number = 20,
): Promise<UserCommentRow[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `id, post_id, parent_id, author_id, content, created_at,
       author:profiles!author_id ( id, nickname, role, avatar_url ),
       post:posts!post_id ( id, title, board_type, author_id )`,
    )
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getUserComments] 실패", error);
    return [];
  }

  type Raw = RawComment & {
    post:
      | { id: string; title: string; board_type: BoardType; author_id: string }
      | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => {
    const boardType = (row.post?.board_type ?? "free") as BoardType;
    const postAuthorId = row.post?.author_id ?? "";
    const norm = normalizeComment(row, userId, boardType, postAuthorId);
    return {
      ...norm,
      post: row.post
        ? {
            id: row.post.id,
            title: row.post.title,
            board_type: row.post.board_type,
          }
        : null,
    };
  });
}

/**
 * 모든 board_type 통합 검색 — 제목 + 내용 ILIKE.
 * 익명(anonymous) 게시판은 결과에서 제외 (별도 화면, 마스킹 규칙 다름).
 *
 * @param keyword 검색어 — normalize 후 2글자 이상이어야 호출 측에서 검사.
 * @param limit   최대 결과 개수 (기본 60).
 */
export async function searchAllPosts(
  keyword: string,
  limit: number = 60,
): Promise<PostRow[]> {
  const k = keyword.trim();
  if (!k) return [];
  const pattern = `%${k.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .neq("board_type", "anonymous")
    .or(`title.ilike.${pattern},content.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[searchAllPosts] 실패", { keyword, error: error.message });
    return [];
  }
  const uid = await getCurrentUserId();
  return ((data ?? []) as unknown as RawPost[]).map((r) => normalizePost(r, uid));
}

/** 특정 사용자가 작성한 글 목록 (익명 제외, 최신순). */
export async function listPostsByAuthor(
  userId: string,
  limit: number = 50,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", userId)
    .neq("board_type", "anonymous")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[listPostsByAuthor] 실패", { userId, error: error.message });
    return [];
  }
  const uid = await getCurrentUserId();
  return ((data ?? []) as unknown as RawPost[]).map((r) => normalizePost(r, uid));
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
