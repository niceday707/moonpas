"use client";

// 문태 에타 글 상세 — /board/anonymous/[postId]
// 작성자 완전 익명. 댓글은 글 내에서 익명1/2... 할당, 글쓴이 댓글은 "익명(글쓴이)".
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CornerDownRight,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import {
  createComment,
  deleteComment,
  getPost,
  incrementLikeCount,
  incrementViewCount,
  listComments,
  type CommentRow,
  type PostRow,
} from "@/lib/board";
import { useSupabaseUser } from "@/lib/supabase-profile";
import { addLikedPost, getLikedPosts } from "@/lib/local-state";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseAnonContent, getTagInfo } from "../anon-utils";

// ── 익명 번호 할당 헬퍼 ──────────────────────────────────────
// 댓글을 시간순으로 보면서 author_id 가 처음 나타날 때 순서대로 번호 부여.
// post.author_id 는 번호 체계 밖 — "익명(글쓴이)"로 별도 표시.
function buildAnonMap(comments: CommentRow[], postAuthorId: string): Map<string, number> {
  const map = new Map<string, number>();
  let counter = 1;
  for (const c of comments) {
    if (c.author_id === postAuthorId) continue; // 글쓴이 제외
    if (!map.has(c.author_id)) {
      map.set(c.author_id, counter++);
    }
  }
  return map;
}

function getAnonLabel(authorId: string, postAuthorId: string, anonMap: Map<string, number>): string {
  if (authorId === postAuthorId) return "익명(글쓴이)";
  const n = anonMap.get(authorId);
  return n !== undefined ? `익명${n}` : "익명";
}

// ── 별 레이어 (가벼운 버전) ────────────────────────────────
type Star = { id: number; top: string; left: string; size: number; duration: number; delay: number };
function Stars() {
  const [stars, setStars] = useState<Star[]>([]);
  useEffect(() => {
    setStars(
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        top: `${Math.random() * 80}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1.5,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 4,
      })),
    );
  }, []);
  return (
    <>
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size }}
          animate={{ opacity: [0.1, 0.9, 0.1] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

// ── 하트 팡 애니메이션 ─────────────────────────────────────
function HeartBurst({ trigger }: { trigger: boolean }) {
  return (
    <AnimatePresence>
      {trigger && (
        <>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-pink-400 text-xs pointer-events-none select-none"
              initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
              animate={{
                x: (Math.cos((i * Math.PI * 2) / 6) * 30),
                y: (Math.sin((i * Math.PI * 2) / 6) * 30) - 10,
                opacity: 0,
                scale: 1.2,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}
            >
              ♥
            </motion.div>
          ))}
        </>
      )}
    </AnimatePresence>
  );
}

// ── 댓글 카드 ─────────────────────────────────────────────
function CommentCard({
  comment,
  postAuthorId,
  anonMap,
  currentUserId,
  isReply,
  onReply,
  onDelete,
}: {
  comment: CommentRow;
  postAuthorId: string;
  anonMap: Map<string, number>;
  currentUserId: string | null;
  isReply?: boolean;
  onReply?: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const label = getAnonLabel(comment.author_id, postAuthorId, anonMap);
  const isPostAuthor = comment.author_id === postAuthorId;
  const isOwn = currentUserId === comment.author_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "py-3",
        isReply && "ml-6 border-l-2 border-violet-500/30 pl-4",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* 달 아바타 */}
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm">
          🌙
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-xs font-semibold", isPostAuthor ? "text-violet-300" : "text-white/65")}>
              {label}
            </span>
            {isPostAuthor && (
              <span className="rounded-full bg-violet-500/20 border border-violet-400/40 px-1.5 py-px text-[10px] font-semibold text-violet-300">
                글쓴이
              </span>
            )}
            <span className="text-[11px] text-white/30 ml-auto">{relativeTime(comment.created_at)}</span>
          </div>
          <p className="text-sm leading-relaxed text-white/75 whitespace-pre-line">{comment.content}</p>
          <div className="mt-1.5 flex items-center gap-3">
            {onReply && (
              <button
                type="button"
                onClick={() => onReply(comment.id, label)}
                className="flex items-center gap-1 text-[11px] text-white/30 hover:text-violet-400 transition-colors"
              >
                <CornerDownRight className="h-3 w-3" />
                답글
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-[11px] text-white/25 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                삭제
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function AnonPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useSupabaseUser();

  const [post, setPost] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [heartBurst, setHeartBurst] = useState(false);

  // 댓글 입력
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // 로드
  useEffect(() => {
    if (!postId) return;
    let active = true;
    (async () => {
      const [p, c] = await Promise.all([getPost(postId), listComments(postId)]);
      if (!active) return;
      if (p) {
        setPost(p);
        setLikeCount(p.like_count);
        setLiked(getLikedPosts().has(p.id));
        await incrementViewCount(p.id);
      }
      setComments(c);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [postId]);

  const anonMap = post ? buildAnonMap(comments, post.author_id) : new Map<string, number>();

  // 좋아요
  const handleLike = async () => {
    if (!user || !post || liked) return;
    setLiked(true);
    setHeartBurst(true);
    addLikedPost(post.id);
    setTimeout(() => setHeartBurst(false), 600);
    const { nextCount } = await incrementLikeCount(post.id);
    if (nextCount !== null) setLikeCount(nextCount);
  };

  // 댓글 등록
  const handleComment = async () => {
    if (!user || !post || !commentText.trim()) return;
    setSubmitting(true);
    const { error } = await createComment({
      authorId: user.id,
      postId: post.id,
      content: commentText.trim(),
      parentId: replyTo?.id ?? null,
    });
    if (!error) {
      setCommentText("");
      setReplyTo(null);
      const fresh = await listComments(post.id);
      setComments(fresh);
    }
    setSubmitting(false);
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    await deleteComment(commentId);
    const fresh = await listComments(postId);
    setComments(fresh);
  };

  // 답글 클릭
  const handleReply = useCallback((id: string, label: string) => {
    setReplyTo({ id, label });
    commentInputRef.current?.focus();
    commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // 댓글을 부모/자식으로 분리
  const topComments = comments.filter((c) => !c.parent_id);
  const repliesMap = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const arr = repliesMap.get(c.parent_id) ?? [];
      arr.push(c);
      repliesMap.set(c.parent_id, arr);
    }
  }

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4"
        style={{ background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
      >
        <p className="text-lg text-white/60">글을 찾을 수 없어요 🌙</p>
        <Link href="/board/anonymous" className="text-sm text-violet-400 underline">
          문태 에타로 돌아가기
        </Link>
      </div>
    );
  }

  const { tag, body } = parseAnonContent(post.content);
  const tagInfo = getTagInfo(tag);

  return (
    <div
      className="relative min-h-screen"
      style={{ background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
    >
      {/* 배경 별 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Stars />
        <div className="absolute right-6 top-6 text-4xl opacity-[0.10] select-none">🌙</div>
      </div>

      {/* 상단 고정 헤더 */}
      <div
        className="sticky top-0 z-20 border-b border-white/[0.06] backdrop-blur-xl"
        style={{ background: "rgba(15,12,41,0.85)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/board/anonymous"
            className="flex items-center gap-1.5 text-sm text-white/55 hover:text-white/85 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            문태 에타
          </Link>
          <span className="ml-auto text-xs text-white/30">🌙 익명 게시판</span>
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="relative mx-auto max-w-2xl px-4 pt-6 pb-40">
        {/* 글 카드 */}
        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6 rounded-2xl border border-white/[0.09] bg-white/[0.06] backdrop-blur-xl p-5"
        >
          {/* 태그 + 시간 */}
          <div className="flex items-center gap-2 mb-3">
            {tagInfo ? (
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tagInfo.color)}>
                {tagInfo.emoji} {tagInfo.label}
              </span>
            ) : null}
            <span className="text-[11px] text-white/30 ml-auto">{relativeTime(post.created_at)}</span>
          </div>

          {/* 작성자 */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.09] text-sm">
              🌙
            </div>
            <span className="text-sm font-semibold text-white/60">익명</span>
          </div>

          {/* 제목 */}
          {post.title && (
            <h1 className="mb-3 text-xl font-extrabold leading-snug text-white">{post.title}</h1>
          )}

          {/* 본문 */}
          <p className="text-sm leading-relaxed text-white/80 whitespace-pre-line">{body}</p>

          {/* 이미지 */}
          {post.image_url && (
            <div className="mt-4 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.image_url} alt="" className="w-full object-cover" />
            </div>
          )}

          {/* 액션 바 */}
          <div className="mt-5 flex items-center gap-4 border-t border-white/[0.07] pt-4">
            {/* 공감 하트 */}
            <div className="relative">
              <button
                type="button"
                onClick={handleLike}
                disabled={!user || liked}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  liked
                    ? "bg-pink-500/20 text-pink-400"
                    : "text-white/45 hover:bg-pink-500/10 hover:text-pink-400",
                  "disabled:cursor-not-allowed",
                )}
              >
                <Heart className={cn("h-4 w-4 transition-all", liked && "fill-current scale-110")} />
                공감 {likeCount}
              </button>
              <HeartBurst trigger={heartBurst} />
            </div>

            {/* 조회수 */}
            <span className="flex items-center gap-1.5 text-xs text-white/30">
              <Eye className="h-3.5 w-3.5" />
              {post.view_count}
            </span>

            {/* 댓글 수 */}
            <span className="flex items-center gap-1.5 text-xs text-white/30">
              <MessageCircle className="h-3.5 w-3.5" />
              {comments.length}
            </span>
          </div>
        </motion.article>

        {/* ── 댓글 목록 ── */}
        <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3">
            <MessageCircle className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white/70">댓글 {comments.length}개</span>
          </div>

          <div className="divide-y divide-white/[0.06] px-5">
            {comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">첫 댓글을 남겨보세요 🌙</p>
            ) : (
              topComments.map((c) => (
                <div key={c.id}>
                  <CommentCard
                    comment={c}
                    postAuthorId={post.author_id}
                    anonMap={anonMap}
                    currentUserId={user?.id ?? null}
                    onReply={handleReply}
                    onDelete={handleDeleteComment}
                  />
                  {/* 대댓글 */}
                  {(repliesMap.get(c.id) ?? []).map((reply) => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      postAuthorId={post.author_id}
                      anonMap={anonMap}
                      currentUserId={user?.id ?? null}
                      isReply
                      onDelete={handleDeleteComment}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 하단 고정 댓글 입력바 ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.07] backdrop-blur-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ background: "rgba(15,12,41,0.92)" }}
      >
        {/* 답글 대상 표시 */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2">
                <CornerDownRight className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="text-xs text-white/50">
                  <span className="text-violet-300 font-semibold">{replyTo.label}</span>에 답글 달기
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="ml-auto text-white/30 hover:text-white/60"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm">
            🌙
          </div>
          <textarea
            ref={commentInputRef}
            placeholder={user ? "익명으로 댓글 달기..." : "로그인 후 댓글을 달 수 있어요"}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={!user}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleComment();
              }
            }}
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-2xl border px-3 py-2 text-sm outline-none",
              "bg-white/[0.07] border-white/[0.09] text-white/85 placeholder-white/30",
              "focus:border-violet-400/40 focus:bg-white/[0.09]",
              "transition-all leading-relaxed max-h-32",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
            style={{ scrollbarWidth: "none" }}
          />
          <button
            type="button"
            onClick={handleComment}
            disabled={!user || !commentText.trim() || submitting}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
              commentText.trim() && user
                ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]"
                : "bg-white/[0.07] text-white/30",
              "disabled:cursor-not-allowed",
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
