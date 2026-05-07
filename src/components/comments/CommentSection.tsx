"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 통합 댓글·대댓글 섹션
// 모든 게시판(자유, 공지, 분실물·나눔, 이슈토론, QnA, 졸업생, 후기, 뉴스)에서
// targetId 만 넘기면 동일한 UI로 동작한다.
//
// 기능 요약
//  - 댓글 목록(시간 순) + 등록 폼
//  - 각 댓글에 답글 버튼 → 인라인 대댓글 입력창
//  - 대댓글 1단계까지만 (대댓글의 대댓글 X)
//  - 좋아요(하트 바운스), 작성시간, 역할 배지, 본인/개발모드 삭제
//  - 댓글 사이 얇은 구분선, 대댓글은 좌측 보라색 세로줄 + 들여쓰기
//  - 다크/라이트 모드 모두 대응
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownRight, Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import {
  ME,
  addCommentToTarget,
  deleteComment,
  fetchCommentsByTarget,
  subscribe,
  toggleCommentLike,
  type Comment,
  type CommentTarget,
} from "@/lib/mock-data";
import { Avatar } from "@/components/feed/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PostContent } from "@/components/feed/PostContent";
import { relativeTime } from "@/lib/format";
import { IS_DEV_MODE } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Props = {
  /** 댓글이 달리는 대상 식별자 — 예) "feed:p-001", "notice:notice-001" */
  targetId: CommentTarget;
  /** 섹션 제목 (기본: "댓글") */
  title?: string;
  /** 댓글 0개일 때 안내 문구 */
  emptyHint?: string;
  /** 카드 안 영역에 박을 때는 false 로 두면 외곽 glass 박스를 생략 */
  bordered?: boolean;
  /** 헤더(아이콘 + N개) 노출 여부 */
  showHeader?: boolean;
  className?: string;
};

export function CommentSection({
  targetId,
  title = "댓글",
  emptyHint = "첫 댓글을 남겨보세요 ✨",
  bordered = true,
  showHeader = true,
  className,
}: Props) {
  const [all, setAll] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 초기 로드 + 데이터 변경 구독 → 항상 최신 상태 유지
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await fetchCommentsByTarget(targetId);
      if (cancelled) return;
      setAll(list);
      setLoaded(true);
    };
    load();
    const unsub = subscribe(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [targetId]);

  // 최상위 / 대댓글 분리
  const { roots, repliesByParent } = useMemo(() => {
    const r: Comment[] = [];
    const map = new Map<string, Comment[]>();
    for (const c of all) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      } else {
        r.push(c);
      }
    }
    return { roots: r, repliesByParent: map };
  }, [all]);

  return (
    <section
      aria-label="댓글"
      className={cn(
        bordered && "glass rounded-2xl px-4 py-4 md:px-5",
        className,
      )}
    >
      {showHeader && (
        <header className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground/75">
          <MessageCircle className="h-4 w-4" />
          {title} {all.length}개
        </header>
      )}

      {/* 새 댓글 입력 */}
      <RootComposer targetId={targetId} />

      {/* 목록 */}
      <ul className="mt-2 divide-y divide-foreground/10">
        {!loaded ? (
          <li className="py-6 text-center text-xs text-foreground/40">
            댓글을 불러오는 중...
          </li>
        ) : roots.length === 0 ? (
          <li className="py-6 text-center text-sm text-foreground/45">
            {emptyHint}
          </li>
        ) : (
          <AnimatePresence initial={false}>
            {roots.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                replies={repliesByParent.get(c.id) ?? []}
                targetId={targetId}
              />
            ))}
          </AnimatePresence>
        )}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 댓글 한 줄 + 답글 영역
// ─────────────────────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  replies,
  targetId,
}: {
  comment: Comment;
  replies: Comment[];
  targetId: CommentTarget;
}) {
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="py-3"
    >
      <CommentBody
        comment={comment}
        onToggleReply={() => setReplyOpen((v) => !v)}
        replyOpen={replyOpen}
      />

      {/* 대댓글 영역 — 좌측 보라 세로줄 + 들여쓰기 */}
      {(replies.length > 0 || replyOpen) && (
        <div className="mt-2 ml-4 border-l-2 border-violet-500/55 pl-3 md:ml-6 md:pl-4">
          <AnimatePresence initial={false}>
            {replies.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-b border-foreground/8 py-2 last:border-b-0"
              >
                <CommentBody comment={r} isReply />
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {replyOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pt-2"
              >
                <ReplyComposer
                  targetId={targetId}
                  parentId={comment.id}
                  onDone={() => setReplyOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 댓글 본문 한 줄 — 최상위/대댓글 공용
// ─────────────────────────────────────────────────────────────────────────────

function CommentBody({
  comment,
  onToggleReply,
  replyOpen,
  isReply = false,
}: {
  comment: Comment;
  onToggleReply?: () => void;
  replyOpen?: boolean;
  isReply?: boolean;
}) {
  // 개발 모드에서는 누구나 삭제 가능, 운영 시엔 본인 작성 댓글만
  const canDelete = IS_DEV_MODE || comment.author.id === ME.id;
  const isAnon = !!comment.anonymous;
  const displayName = isAnon
    ? `익명${comment.anonymousId ?? ""}`
    : comment.author.name;

  return (
    <div className="flex gap-2.5">
      <Avatar author={comment.author} size="sm" anonymous={isAnon} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "text-sm font-semibold",
              isAnon && "text-foreground/70",
            )}
          >
            {displayName}
          </span>
          {!isAnon && (
            <Badge
              role={comment.author.role}
              year={
                comment.author.role === "alumni"
                  ? comment.author.graduationYear
                  : undefined
              }
            />
          )}
          <span className="text-[11px] text-foreground/45">
            · {relativeTime(comment.createdAt)}
          </span>
        </div>

        <PostContent text={comment.content} className="mt-0.5 text-sm" />

        <div className="mt-1.5 flex items-center gap-1 -ml-1.5">
          <CommentLikeButton
            commentId={comment.id}
            liked={comment.liked}
            count={comment.likes}
          />

          {/* 대댓글은 답글 버튼 노출 안 함 (2단계 깊이 제한) */}
          {!isReply && onToggleReply && (
            <button
              type="button"
              onClick={onToggleReply}
              aria-pressed={replyOpen}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                replyOpen
                  ? "bg-violet-500/15 text-violet-500 dark:text-violet-300"
                  : "text-foreground/55 hover:bg-foreground/8 hover:text-foreground/80",
              )}
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              답글
            </button>
          )}

          {canDelete && (
            <DeleteCommentButton commentId={comment.id} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 등록 폼 (최상위) / 답글 폼 (대댓글)
// ─────────────────────────────────────────────────────────────────────────────

function RootComposer({ targetId }: { targetId: CommentTarget }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await addCommentToTarget(targetId, trimmed);
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-start gap-2.5 py-2">
      <Avatar author={ME} size="sm" />
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-foreground/5 px-3 py-1.5 ring-1 ring-inset ring-transparent transition focus-within:bg-foreground/8 focus-within:ring-violet-500/35">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="댓글을 남겨보세요…"
          maxLength={500}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-foreground/35"
        />
        <button
          type="submit"
          disabled={!value.trim() || busy}
          aria-label="댓글 등록"
          className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(124,58,237,0.4)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          등록
        </button>
      </div>
    </form>
  );
}

function ReplyComposer({
  targetId,
  parentId,
  onDone,
}: {
  targetId: CommentTarget;
  parentId: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await addCommentToTarget(targetId, trimmed, parentId);
      setValue("");
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-start gap-2 py-1.5">
      <Avatar author={ME} size="sm" />
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-foreground/5 px-3 py-1.5 ring-1 ring-inset ring-violet-500/25 focus-within:ring-violet-500/45">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="답글을 입력하세요…"
          maxLength={500}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-foreground/35"
        />
        <button
          type="button"
          onClick={onDone}
          className="rounded-full px-2 py-1 text-[11px] font-semibold text-foreground/55 hover:text-foreground/80"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!value.trim() || busy}
          className="inline-flex items-center gap-1 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          등록
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 댓글 좋아요 — 하트 바운스 애니메이션
// ─────────────────────────────────────────────────────────────────────────────

function CommentLikeButton({
  commentId,
  liked,
  count,
}: {
  commentId: string;
  liked: boolean;
  count: number;
}) {
  const [optimistic, setOptimistic] = useState({ liked, count });
  const [burstKey, setBurstKey] = useState(0);

  // 외부 변경(다른 화면에서 토글) 동기화 — 진행 중이 아닐 때만
  if (
    optimistic.liked !== liked &&
    burstKey === 0 &&
    optimistic.count !== count
  ) {
    setOptimistic({ liked, count });
  }

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !optimistic.liked;
    setOptimistic({
      liked: next,
      count: optimistic.count + (next ? 1 : -1),
    });
    if (next) setBurstKey((k) => k + 1);
    try {
      await toggleCommentLike(commentId);
    } catch {
      setOptimistic((s) => ({
        liked: !s.liked,
        count: s.count + (s.liked ? -1 : 1),
      }));
    }
  };

  return (
    <button
      type="button"
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "좋아요 취소" : "좋아요"}
      onClick={handle}
      className={cn(
        "group relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
        optimistic.liked
          ? "text-rose-500"
          : "text-foreground/55 hover:bg-rose-500/10 hover:text-rose-500/80",
      )}
    >
      <span className="relative grid place-items-center">
        <motion.span
          key={`heart-${optimistic.liked}`}
          initial={optimistic.liked ? { scale: 0.7 } : { scale: 1 }}
          animate={
            optimistic.liked
              ? { scale: [0.7, 1.45, 0.9, 1.1, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="inline-flex"
        >
          <Heart
            className="h-3.5 w-3.5"
            strokeWidth={2.2}
            fill={optimistic.liked ? "currentColor" : "none"}
          />
        </motion.span>

        <AnimatePresence>
          {burstKey > 0 && optimistic.liked && (
            <motion.span
              key={burstKey}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-rose-400"
            />
          )}
        </AnimatePresence>
      </span>
      <span className="tabular-nums">{optimistic.count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 삭제 버튼 — 확인 후 비동기 삭제
// ─────────────────────────────────────────────────────────────────────────────

function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (busy) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm("이 댓글을 삭제할까요?");
      if (!ok) return;
    }
    setBusy(true);
    try {
      await deleteComment(commentId);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      aria-label="댓글 삭제"
      className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-foreground/40 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
      삭제
    </button>
  );
}
