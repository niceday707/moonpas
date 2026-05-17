"use client";

// ============================================================================
// 문태 미디어 — 댓글 한 행 (좋아요 + 답글 + 본인 삭제 + 멘션 하이라이트)
// ----------------------------------------------------------------------------
// · root 댓글 + 그 아래 답글 리스트를 들여쓰기로 함께 렌더 (유튜브 스타일).
// · 답글이 있으면 "답글 N개 보기" 토글로 펼침.
// · 본문의 @닉네임 은 보라색 강조.
// · 좋아요 카운트와 liked 상태는 부모가 합성해 내려준다.
// ============================================================================

import { useMemo, useState } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getDisplayRole, type Role } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { CommentActions, MoontubeUIComment } from "./types";

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

/** "@닉네임" 패턴을 보라 강조 span 으로 분할 */
function renderWithMentions(text: string) {
  const re = /(@[가-힣a-zA-Z0-9]{2,30})/g;
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <span key={i} className="font-semibold text-violet-300">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function RoleTag({ role }: { role: Role | null }) {
  if (!role) return null;
  return (
    <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/55">
      {getDisplayRole(role)}
    </span>
  );
}

type Props = {
  comment: MoontubeUIComment;
  replies: MoontubeUIComment[];
  /** 답글 작성 버튼 가능 여부 (로그인) */
  canComment: boolean;
  /** 답글 작성 모드 진입 — 부모가 입력창 prefix 를 세팅 */
  onStartReply: (target: {
    parentId: string;
    nickname: string;
    mentionUserId?: string | null;
  }) => void;
  actions: CommentActions;
};

export function CommentItem({
  comment,
  replies,
  canComment,
  onStartReply,
  actions,
}: Props) {
  const [repliesOpen, setRepliesOpen] = useState(false);
  const sortedReplies = useMemo(
    () =>
      [...replies].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [replies],
  );

  const handleConfirmDelete = (id: string, isReply = false) => {
    const label = isReply ? "답글" : "댓글";
    if (window.confirm(`이 ${label}을(를) 삭제할까요?`)) {
      void actions.onDelete(id);
    }
  };

  return (
    <li className="flex gap-3">
      <UserAvatar
        nickname={comment.authorName}
        role={comment.authorRole ?? "student"}
        avatarUrl={comment.authorAvatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/85">
          {comment.authorName}
          <RoleTag role={comment.authorRole} />
          <span className="ml-2 font-normal text-white/40">
            {timeAgo(comment.createdAt)}
          </span>
        </p>
        <p className="mt-0.5 break-words text-sm leading-relaxed text-white/95">
          {renderWithMentions(comment.content)}
        </p>

        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-white/55">
          <button
            type="button"
            onClick={() => void actions.onToggleLike(comment.id)}
            aria-pressed={comment.liked}
            aria-label={comment.liked ? "좋아요 취소" : "좋아요"}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-white/[0.06] hover:text-white",
              comment.liked && "text-rose-300",
            )}
          >
            <Heart
              className="h-3.5 w-3.5"
              strokeWidth={2.2}
              style={
                comment.liked ? { color: "#ec4899", fill: "#ec4899" } : undefined
              }
            />
            {comment.likeCount > 0 && comment.likeCount}
          </button>
          {canComment && (
            <button
              type="button"
              onClick={() =>
                onStartReply({
                  parentId: comment.id,
                  nickname: comment.authorName,
                  // 답글 대상이 가진 작성자 id (RawCommentAuthor.id). 없으면 null.
                  mentionUserId: comment.authorRole ? null : null,
                })
              }
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.2} />
              답글
            </button>
          )}
          {comment.canDelete && (
            <button
              type="button"
              onClick={() => handleConfirmDelete(comment.id)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-rose-300/80 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          )}
        </div>

        {sortedReplies.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setRepliesOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-violet-300 transition-colors hover:bg-violet-500/10"
            >
              <span aria-hidden>{repliesOpen ? "▾" : "▸"}</span>
              답글 {sortedReplies.length}개{repliesOpen ? " 숨기기" : " 보기"}
            </button>

            {repliesOpen && (
              <ul className="mt-2 flex flex-col gap-3 border-l border-white/10 pl-3">
                {sortedReplies.map((r) => (
                  <li key={r.id} className="flex gap-2">
                    <UserAvatar
                      nickname={r.authorName}
                      role={r.authorRole ?? "student"}
                      avatarUrl={r.authorAvatarUrl}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white/80">
                        {r.authorName}
                        <RoleTag role={r.authorRole} />
                        <span className="ml-2 font-normal text-white/40">
                          {timeAgo(r.createdAt)}
                        </span>
                      </p>
                      <p className="mt-0.5 break-words text-[13px] leading-relaxed text-white/90">
                        {renderWithMentions(r.content)}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-white/50">
                        <button
                          type="button"
                          onClick={() => void actions.onToggleLike(r.id)}
                          aria-pressed={r.liked}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-white/[0.06] hover:text-white",
                            r.liked && "text-rose-300",
                          )}
                        >
                          <Heart
                            className="h-3 w-3"
                            strokeWidth={2.2}
                            style={
                              r.liked
                                ? { color: "#ec4899", fill: "#ec4899" }
                                : undefined
                            }
                          />
                          {r.likeCount > 0 && r.likeCount}
                        </button>
                        {canComment && (
                          <button
                            type="button"
                            onClick={() =>
                              onStartReply({
                                // 답글의 답글은 항상 root 댓글에 평탄화 (parent_id)
                                parentId: comment.id,
                                nickname: r.authorName,
                                mentionUserId: null,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-white/[0.06] hover:text-white"
                          >
                            답글
                          </button>
                        )}
                        {r.canDelete && (
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(r.id, true)}
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-rose-300/80 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
