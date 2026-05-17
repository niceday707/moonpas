// ============================================================================
// 문태 미디어 댓글 공용 UI 모델
// ----------------------------------------------------------------------------
// DB(MoontubeComment) 와 fallback(시드/로컬) 양쪽을 통합 표현.
// page.tsx 는 DB 댓글을 toUIComment() 로 옮겨 담아 CommentSection 에 넘긴다.
// ============================================================================

import type { Role } from "@/components/ui/Badge";

export type MoontubeUIComment = {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  /** 작성자 닉네임(없으면 "사용자"로 폴백) */
  authorName: string;
  authorRole: Role | null;
  authorAvatarUrl: string | null;
  /** 댓글 좋아요 수 (DB 캐시 또는 로컬) */
  likeCount: number;
  /** 내가 좋아요를 눌렀는지 (로컬 상태에서 합성됨) */
  liked: boolean;
  /** 내가 작성한 댓글인지 */
  isMine: boolean;
  /** 삭제 노출 여부 — 본인 또는 admin */
  canDelete: boolean;
  /** fallback(샘플) 댓글이라 DB 연동이 안 되는 경우 (좋아요는 로컬 토글) */
  isFallback?: boolean;
};

/** CommentSection 이 부모에게 요청하는 액션 핸들러 묶음 */
export type CommentActions = {
  /** 새 댓글/답글 작성. parentId 있으면 답글. mentionUserId 가 있으면 호명한 사용자 id. */
  onSubmit: (
    text: string,
    options?: { parentId?: string | null; mentionUserId?: string | null },
  ) => Promise<{ ok: boolean; message?: string }>;
  /** 댓글 삭제 */
  onDelete: (commentId: string) => void | Promise<void>;
  /** 댓글 좋아요 토글 — 부모가 낙관적 갱신 + 서버 호출 */
  onToggleLike: (commentId: string) => void | Promise<void>;
};

/** 댓글 정렬 옵션 — 유튜브: 인기순/최신순 */
export type CommentSort = "popular" | "latest";
