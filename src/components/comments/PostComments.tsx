"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PostComments — 게시글 댓글 섹션 (목록 + 입력바)
// /board/[boardType]/[postId] 와 /board/challenge/post/[postId] 등에서 공용 사용.
//
// 책임:
//   · listComments / deleteComment (Supabase, board.ts) 직접 호출
//   · 댓글 트리(루트 + 답글) 평탄화 + 시간순 정렬
//   · 답글 대상(ReplyTarget) 상태 관리 + CommentComposer 연결
//   · 작성/삭제 후 자동 새로고침 + 마지막 댓글로 부드럽게 스크롤
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { CornerDownRight } from "lucide-react";
import {
  CommentComposer,
  type ReplyTarget,
} from "@/components/comments/CommentComposer";
import { HighlightedContent } from "@/components/comments/HighlightedContent";
import { Badge, type Role } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { NicknameButton } from "@/components/profile/NicknameButton";
import {
  deleteComment,
  listComments,
  toggleCommentReaction,
  type BoardType,
  type CommentRow,
} from "@/lib/board";
import {
  displayAuthorNameFor,
  shouldShowAuthorBadgeFor,
} from "@/lib/author-display";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  boardType: BoardType;
  /** 로그인 사용자 id — null 이면 입력바 비활성 */
  currentUserId: string | null;
  /** 입력바 좌측 아바타 표시용 프로필 정보 */
  composerProfile: {
    nickname: string | null;
    role: Role | null;
    avatarUrl: string | null;
  };
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export function PostComments({
  postId,
  boardType,
  currentUserId,
  composerProfile,
}: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const list = await listComments(postId);
    setComments(list);
    setLoaded(true);
  }, [postId]);

  useEffect(() => {
    let active = true;
    listComments(postId).then((list) => {
      if (!active) return;
      setComments(list);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [postId]);

  const scrollToLatest = useCallback(() => {
    window.setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 60);
  }, []);

  const { roots, repliesByRoot } = buildCommentTree(comments);

  return (
    <>
      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          댓글 {comments.length}
        </h2>

        {!loaded ? (
          <p className="mt-3 text-xs text-gray-400">댓글을 불러오는 중…</p>
        ) : roots.length === 0 ? (
          <p className="mt-3 text-xs text-gray-400">아직 댓글이 없습니다</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.04]">
            {roots.map((root) => {
              const replies = repliesByRoot.get(root.id) ?? [];
              const rootLabel = displayAuthorNameFor({
                boardType,
                author: root.author,
              });
              return (
                <li key={root.id} className="py-3">
                  <CommentItem
                    comment={root}
                    boardType={boardType}
                    currentUserId={currentUserId}
                    onDeleted={refresh}
                    replyButton={{
                      count: replies.length,
                      active: replyTo?.id === root.id,
                      onClick: () =>
                        setReplyTo({
                          id: root.id,
                          label: rootLabel,
                          mentionUserId: root.author?.id ?? null,
                        }),
                    }}
                  />

                  {replies.length > 0 && (
                    <RepliesList
                      replies={replies}
                      rootId={root.id}
                      boardType={boardType}
                      currentUserId={currentUserId}
                      onChanged={refresh}
                      onReply={(t) => setReplyTo(t)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div ref={endRef} aria-hidden style={{ scrollMarginBottom: "9rem" }} />
      </section>

      <CommentComposer
        postId={postId}
        userId={currentUserId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        avatar={
          <UserAvatar
            nickname={composerProfile.nickname}
            role={composerProfile.role}
            avatarUrl={composerProfile.avatarUrl}
            size="sm"
          />
        }
        theme="light"
        placeholder="댓글을 입력하세요..."
        enableMentions
        actorNickname={composerProfile.nickname}
        onFocus={scrollToLatest}
        onSubmitted={async () => {
          await refresh();
          scrollToLatest();
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 트리 평탄화 — root + 모든 후손을 시간순 한 배열로 모아 1단계 들여쓰기로 표시
// ─────────────────────────────────────────────────────────────────────────────

function buildCommentTree(comments: CommentRow[]) {
  const byId = new Map<string, CommentRow>();
  for (const c of comments) byId.set(c.id, c);

  const findRoot = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (true) {
      if (seen.has(cur)) return cur;
      seen.add(cur);
      const c = byId.get(cur);
      if (!c || !c.parent_id) return cur;
      cur = c.parent_id;
    }
  };

  const roots: CommentRow[] = [];
  const repliesByRoot = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (!c.parent_id) {
      roots.push(c);
      continue;
    }
    const rootId = findRoot(c.parent_id);
    const arr = repliesByRoot.get(rootId) ?? [];
    arr.push(c);
    repliesByRoot.set(rootId, arr);
  }
  for (const arr of repliesByRoot.values()) {
    arr.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }
  return { roots, repliesByRoot };
}

// ─────────────────────────────────────────────────────────────────────────────
// 답글 리스트 — 3개 초과 시 접기
// ─────────────────────────────────────────────────────────────────────────────

function RepliesList({
  replies,
  rootId,
  boardType,
  currentUserId,
  onChanged,
  onReply,
}: {
  replies: CommentRow[];
  rootId: string;
  boardType: BoardType;
  currentUserId: string | null;
  onChanged: () => Promise<void>;
  onReply: (target: ReplyTarget) => void;
}) {
  const COLLAPSE_THRESHOLD = 3;
  const COLLAPSED_VISIBLE = 2;
  const [expanded, setExpanded] = useState(false);
  const overflow = replies.length > COLLAPSE_THRESHOLD;
  const visible =
    overflow && !expanded ? replies.slice(-COLLAPSED_VISIBLE) : replies;
  const hiddenCount = replies.length - visible.length;

  return (
    <div className="mt-2 ml-4 border-l-2 border-violet-500/40 pl-3 md:ml-6 md:pl-4">
      {overflow && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-300"
        >
          <CornerDownRight className="h-3 w-3" />
          답글 {hiddenCount}개 더 보기
        </button>
      )}
      {visible.map((r) => {
        const replyLabel = displayAuthorNameFor({ boardType, author: r.author });
        return (
          <CommentItem
            key={r.id}
            comment={r}
            boardType={boardType}
            currentUserId={currentUserId}
            onDeleted={onChanged}
            isReply
            replyButton={{
              count: 0,
              active: false,
              onClick: () =>
                onReply({
                  id: rootId,
                  label: replyLabel,
                  mentionUserId: r.author?.id ?? null,
                }),
            }}
          />
        );
      })}
      {overflow && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]"
        >
          답글 접기
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 한 댓글 한 줄 — 본인/관리자 삭제 + 좋아요/싫어요 토글 + 답글 버튼
// ─────────────────────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  boardType,
  currentUserId,
  onDeleted,
  isReply = false,
  replyButton,
}: {
  comment: CommentRow;
  boardType: BoardType;
  currentUserId: string | null;
  onDeleted: () => Promise<void>;
  isReply?: boolean;
  replyButton?: { count: number; active: boolean; onClick: () => void };
}) {
  const owner =
    !!currentUserId && (comment.is_mine || currentUserId === comment.author_id);

  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(
    comment.my_reaction,
  );
  const [likeCount, setLikeCount] = useState(comment.like_count);
  const [reacting, setReacting] = useState(false);

  const handleReaction = async (r: "like" | "dislike") => {
    if (!currentUserId || reacting) return;
    const prev = { myReaction, likeCount };
    if (myReaction === r) {
      setMyReaction(null);
      if (r === "like") setLikeCount((c) => Math.max(0, c - 1));
    } else {
      if (myReaction === "like") setLikeCount((c) => Math.max(0, c - 1));
      if (r === "like") setLikeCount((c) => c + 1);
      setMyReaction(r);
    }
    setReacting(true);
    const result = await toggleCommentReaction(comment.id, r);
    setReacting(false);
    if (result.error) {
      setMyReaction(prev.myReaction);
      setLikeCount(prev.likeCount);
    } else {
      setMyReaction(result.my_reaction);
      setLikeCount(result.like_count);
    }
  };

  return (
    <div className={cn(isReply && "py-2")}>
      <div className="flex items-center gap-2 text-[11px] text-gray-500">
        <UserAvatar
          nickname={comment.author?.nickname}
          role={comment.author?.role}
          avatarUrl={comment.author?.avatar_url ?? null}
          size="xs"
        />
        <NicknameButton
          userId={comment.author?.id ?? null}
          className="font-semibold text-gray-700 dark:text-gray-200"
        >
          {displayAuthorNameFor({ boardType, author: comment.author })}
        </NicknameButton>
        {shouldShowAuthorBadgeFor(boardType) && comment.author && (
          <Badge role={comment.author.role} className="text-[9px] py-0 px-1.5" />
        )}
        <span className="text-gray-300">·</span>
        <span className="tabular-nums">{formatDateTime(comment.created_at)}</span>
        {owner && (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("이 댓글을 삭제하시겠어요?")) return;
              await deleteComment(comment.id);
              await onDeleted();
            }}
            className="ml-auto text-red-500 transition hover:underline"
          >
            삭제
          </button>
        )}
      </div>
      <HighlightedContent
        text={comment.content}
        className="mt-1.5 text-sm text-gray-800 dark:text-gray-200"
      />

      <div className="mt-1.5 flex items-center gap-2">
        {replyButton && (
          <button
            type="button"
            onClick={replyButton.onClick}
            aria-pressed={replyButton.active}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
              replyButton.active
                ? "bg-violet-500/15 text-violet-600 dark:text-violet-300"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100",
            )}
          >
            <CornerDownRight className="h-3 w-3" />
            답글 {replyButton.count > 0 ? replyButton.count : ""}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleReaction("like")}
          disabled={!currentUserId || reacting}
          aria-pressed={myReaction === "like"}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
            myReaction === "like"
              ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/[0.06] dark:hover:text-gray-300",
          )}
        >
          👍{likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => handleReaction("dislike")}
          disabled={!currentUserId || reacting}
          aria-pressed={myReaction === "dislike"}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
            myReaction === "dislike"
              ? "text-gray-700 dark:text-gray-200"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/[0.06] dark:hover:text-gray-300",
          )}
        >
          👎
        </button>
      </div>
    </div>
  );
}
