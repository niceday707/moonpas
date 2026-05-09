"use client";

// 문태 에타 글 상세 — /board/anonymous/[postId]
// 작성자 완전 익명. 댓글은 글 내에서 익명1/2... 할당, 글쓴이 댓글은 "익명(글쓴이)".
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CornerDownRight,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
  X as XIcon,
} from "lucide-react";
import {
  deleteComment,
  deletePost,
  getAnonymousPost,
  getLikedPostIds,
  incrementViewCount,
  listAnonymousComments,
  toggleLike,
  toggleCommentReaction,
  updatePost,
  type CommentRow,
  type PostRow,
} from "@/lib/board";
import {
  CommentComposer,
  type ReplyTarget,
} from "@/components/comments/CommentComposer";
import { useSupabaseUser } from "@/lib/supabase-profile";
import { relativeTime } from "@/lib/format";
import { buildPostShareUrl, sharePost } from "@/lib/share";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ANON_TAGS, parseAnonContent, getTagInfo, type AnonTagKey } from "../anon-utils";

// ── 익명 번호 할당 헬퍼 ──────────────────────────────────────
// 댓글을 시간순으로 보면서 anon_seed 가 처음 나타날 때 순서대로 번호 부여.
// is_post_author 인 댓글은 번호 체계 밖 — "익명(글쓴이)"로 별도 표시.
// (server 단에서 author_id 는 마스킹돼서 오므로, anon_seed 로만 동일 작성자 그룹화)
function buildAnonMap(comments: CommentRow[]): Map<string, number> {
  const map = new Map<string, number>();
  let counter = 1;
  for (const c of comments) {
    if (c.is_post_author) continue;
    const seed = c.anon_seed;
    if (!seed) continue;
    if (!map.has(seed)) {
      map.set(seed, counter++);
    }
  }
  return map;
}

function getAnonLabel(comment: CommentRow, anonMap: Map<string, number>): string {
  if (comment.is_post_author) return "익명(글쓴이)";
  const seed = comment.anon_seed;
  if (!seed) return "익명";
  const n = anonMap.get(seed);
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
  anonMap,
  isReply,
  rootId,
  currentUserId,
  onReply,
  onDelete,
}: {
  comment: CommentRow;
  anonMap: Map<string, number>;
  isReply?: boolean;
  /**
   * 이 댓글이 속한 root 댓글의 id.
   * 답글의 답글을 등록할 때도 parent_id 는 root 의 id 를 사용해야 하므로 별도 전달.
   */
  rootId: string;
  currentUserId: string | null;
  onReply?: (rootId: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const label = getAnonLabel(comment, anonMap);
  const isPostAuthor = comment.is_post_author;
  const isOwn = comment.is_mine;

  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(comment.my_reaction);
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

  // 본문 앞쪽의 "@익명N " 멘션 토큰을 violet 으로 강조 (인스타 스타일)
  const mentionMatch = comment.content.match(/^(@\S+)\s+([\s\S]*)$/);

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
          <p className="text-sm leading-relaxed text-white/75 whitespace-pre-line">
            {mentionMatch ? (
              <>
                <span className="font-bold text-violet-300">{mentionMatch[1]}</span>{" "}
                {mentionMatch[2]}
              </>
            ) : (
              comment.content
            )}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            {onReply && (
              <button
                type="button"
                onClick={() => onReply(rootId, label)}
                className="flex items-center gap-1 text-[11px] text-white/30 hover:text-violet-400 transition-colors"
              >
                <CornerDownRight className="h-3 w-3" />
                답글
              </button>
            )}

            {/* 좋아요 / 싫어요 */}
            <button
              type="button"
              onClick={() => handleReaction("like")}
              disabled={!currentUserId || reacting}
              aria-pressed={myReaction === "like"}
              className={cn(
                "flex items-center gap-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
                myReaction === "like"
                  ? "text-blue-300"
                  : "text-white/25 hover:text-white/55",
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
                "flex items-center gap-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
                myReaction === "dislike"
                  ? "text-white/70"
                  : "text-white/25 hover:text-white/55",
              )}
            >
              👎
            </button>

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

// ── 답글 리스트(평탄화) — 3개 초과 시 접기 토글 ──────────
function AnonRepliesList({
  replies,
  rootId,
  anonMap,
  currentUserId,
  onReply,
  onDelete,
}: {
  replies: CommentRow[];
  rootId: string;
  anonMap: Map<string, number>;
  currentUserId: string | null;
  onReply: (rootId: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const COLLAPSE_THRESHOLD = 3;
  const COLLAPSED_VISIBLE = 2;
  const [expanded, setExpanded] = useState(false);
  if (replies.length === 0) return null;
  const overflow = replies.length > COLLAPSE_THRESHOLD;
  const visible =
    overflow && !expanded ? replies.slice(-COLLAPSED_VISIBLE) : replies;
  const hiddenCount = replies.length - visible.length;

  return (
    <div>
      {overflow && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ml-6 mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-violet-300 transition-colors hover:bg-violet-500/10"
        >
          <CornerDownRight className="h-3 w-3" />
          답글 {hiddenCount}개 더 보기
        </button>
      )}
      {visible.map((reply) => (
        <CommentCard
          key={reply.id}
          comment={reply}
          anonMap={anonMap}
          rootId={rootId}
          currentUserId={currentUserId}
          isReply
          onReply={onReply}
          onDelete={onDelete}
        />
      ))}
      {overflow && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="ml-6 mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white/40 transition-colors hover:bg-white/[0.06]"
        >
          답글 접기
        </button>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function AnonPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useSupabaseUser();

  const [post, setPost] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [heartBurst, setHeartBurst] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // 댓글 입력 — 답글 타겟만 페이지 레벨에서 관리, 본문 입력은 CommentComposer 내부 상태
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  // 편집 상태
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTag, setEditTag] = useState<AnonTagKey | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const scrollToLatestComment = useCallback(() => {
    window.setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 60);
  }, []);

  // 로드
  useEffect(() => {
    if (!postId) return;
    let active = true;
    (async () => {
      const [p, c, likedIds] = await Promise.all([
        getAnonymousPost(postId),
        listAnonymousComments(postId),
        getLikedPostIds([postId]),
      ]);
      if (!active) return;
      if (p) {
        setPost(p);
        setLikeCount(p.like_count);
        setLiked(likedIds.has(p.id));
        await incrementViewCount(p.id);
      }
      setComments(c);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [postId]);

  // ?edit=1 자동 편집 모드 진입 (본인 글일 때만)
  useEffect(() => {
    if (!post || !user) return;
    if (searchParams.get("edit") === "1" && post.is_mine) {
      const parsed = parseAnonContent(post.content);
      setEditTitle(post.title ?? "");
      setEditBody(parsed.body);
      setEditTag(parsed.tag);
      setEditMode(true);
    }
  }, [post, user, searchParams]);

  // 익명 게시판은 author_id 가 마스킹됨 — is_mine 으로만 본인 판별
  const isOwner = !!user && !!post && post.is_mine;

  // 편집 시작
  const startEdit = useCallback(() => {
    if (!post) return;
    const parsed = parseAnonContent(post.content);
    setEditTitle(post.title ?? "");
    setEditBody(parsed.body);
    setEditTag(parsed.tag);
    setEditMode(true);
  }, [post]);

  // 편집 취소
  const cancelEdit = useCallback(() => {
    setEditMode(false);
    // ?edit=1 쿼리 정리
    if (searchParams.get("edit") === "1" && postId) {
      router.replace(`/board/anonymous/${postId}`);
    }
  }, [searchParams, postId, router]);

  // 편집 저장
  const saveEdit = useCallback(async () => {
    if (!post || !editBody.trim()) return;
    setSavingEdit(true);
    const newTitle =
      editTitle.trim() ||
      editBody.trim().split(/\r?\n/)[0]?.slice(0, 100).trim() ||
      "(제목 없음)";
    const newContent = JSON.stringify({ tag: editTag, body: editBody.trim() });
    const { error } = await updatePost(post.id, {
      title: newTitle,
      content: newContent,
    });
    setSavingEdit(false);
    if (error) {
      alert(`수정 실패: ${error}`);
      return;
    }
    // 갱신 후 다시 로드
    const fresh = await getAnonymousPost(post.id);
    if (fresh) setPost(fresh);
    setEditMode(false);
    if (searchParams.get("edit") === "1" && postId) {
      router.replace(`/board/anonymous/${postId}`);
    }
  }, [post, editTitle, editBody, editTag, searchParams, postId, router]);

  // 글 삭제
  const handleDeletePost = useCallback(async () => {
    if (!post) return;
    if (!confirm("이 글을 삭제할까요? 댓글도 함께 사라져요.")) return;
    const { error } = await deletePost(post.id);
    if (error) {
      alert(`삭제 실패: ${error}`);
      return;
    }
    router.push("/board/anonymous");
  }, [post, router]);

  const anonMap = buildAnonMap(comments);

  // 공유
  const handleShare = async () => {
    if (!post) return;
    const url = buildPostShareUrl("anonymous", post.id);
    const result = await sharePost({ title: post.title || "익명 글", url });
    if (result.kind === "copied") {
      setShareToast("링크가 복사되었습니다");
    } else if (result.kind === "error") {
      setShareToast(result.message);
    }
    if (result.kind === "copied" || result.kind === "error") {
      window.setTimeout(() => setShareToast(null), 2200);
    }
  };

  // 좋아요 토글 — INSERT/DELETE
  const handleLike = async () => {
    if (!user || !post) return;
    const wasLiked = liked;
    // optimistic
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    if (!wasLiked) {
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 600);
    }
    const { error, liked: nextLiked, like_count } = await toggleLike(post.id);
    if (error) {
      // 롤백
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
      return;
    }
    setLiked(nextLiked);
    if (like_count !== null) setLikeCount(like_count);
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    await deleteComment(commentId);
    const fresh = await listAnonymousComments(postId);
    setComments(fresh);
  };

  // 답글 클릭 — 답글의 답글이라도 parent_id 는 항상 root 댓글의 id 를 가리키도록 평탄화.
  // 익명 게시판은 mention_user_id 미사용 (작성자 식별 정보 노출 금지).
  const handleReply = useCallback(
    (rootId: string, label: string) => {
      setReplyTo({ id: rootId, label, mentionUserId: null });
    },
    [],
  );

  // 댓글 트리 평탄화 — 답글의 답글(레거시 데이터)도 root 까지 거슬러 올라가 묶음.
  const commentById = new Map<string, CommentRow>();
  for (const c of comments) commentById.set(c.id, c);
  const findRoot = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (true) {
      if (seen.has(cur)) return cur;
      seen.add(cur);
      const cc = commentById.get(cur);
      if (!cc || !cc.parent_id) return cur;
      cur = cc.parent_id;
    }
  };

  const topComments = comments.filter((c) => !c.parent_id);
  const repliesMap = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (!c.parent_id) continue;
    const rootId = findRoot(c.parent_id);
    const arr = repliesMap.get(rootId) ?? [];
    arr.push(c);
    repliesMap.set(rootId, arr);
  }
  for (const arr of repliesMap.values()) {
    arr.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
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
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로 가기"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white/85"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Link
            href="/board/anonymous"
            className="text-sm font-medium text-white/55 hover:text-white/85 transition-colors"
          >
            문태 에타
          </Link>
          <span className="ml-auto text-xs text-white/30">🌙 익명 게시판</span>
        </div>
      </div>

      {/* 본문 영역 — 하단 고정 입력바(약 60px) + 답글 배너 + safe-area 여유 */}
      <div
        className="relative mx-auto max-w-2xl px-4 pt-6"
        style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
      >
        {/* 글 카드 */}
        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6 rounded-2xl border border-white/[0.09] bg-white/[0.06] backdrop-blur-xl p-5"
        >
          {/* 태그 + 시간 + (본인) ⋮ 메뉴 */}
          <div className="flex items-center gap-2 mb-3">
            {tagInfo ? (
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tagInfo.color)}>
                {tagInfo.emoji} {tagInfo.label}
              </span>
            ) : null}
            <span className="text-[11px] text-white/30 ml-auto">{relativeTime(post.created_at)}</span>
            {isOwner && !editMode && (
              <PostKebabMenu onEdit={startEdit} onDelete={handleDeletePost} />
            )}
          </div>

          {/* 작성자 */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.09] text-sm">
              🌙
            </div>
            <span className="text-sm font-semibold text-white/60">익명</span>
            {isOwner && (
              <span className="rounded-full bg-violet-500/15 border border-violet-400/30 px-1.5 py-px text-[10px] font-semibold text-violet-300">
                내 글
              </span>
            )}
          </div>

          {editMode ? (
            <PostEditor
              title={editTitle}
              body={editBody}
              tag={editTag}
              saving={savingEdit}
              onTitleChange={setEditTitle}
              onBodyChange={setEditBody}
              onTagChange={setEditTag}
              onSave={saveEdit}
              onCancel={cancelEdit}
            />
          ) : (
            <>
              {/* 제목 */}
              {post.title && (
                <h1 className="mb-3 text-xl font-extrabold leading-snug text-white">{post.title}</h1>
              )}

              {/* 본문 */}
              <p className="text-sm leading-relaxed text-white/80 whitespace-pre-line">{body}</p>

              {/* 이미지 */}
              {post.image_url && (
                <div className="mt-4 overflow-hidden rounded-xl">
                  <ImageLightbox src={post.image_url} className="w-full object-cover" />
                </div>
              )}
            </>
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

            {/* 공유 */}
            <button
              type="button"
              onClick={handleShare}
              aria-label="공유"
              className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/85"
            >
              <Share2 className="h-3.5 w-3.5" />
              공유
            </button>
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
                    anonMap={anonMap}
                    rootId={c.id}
                    currentUserId={user?.id ?? null}
                    onReply={handleReply}
                    onDelete={handleDeleteComment}
                  />
                  {/* 답글(평탄화) — 모든 답글에 답글 버튼 노출, 3개 초과 시 접기 토글 */}
                  <AnonRepliesList
                    replies={repliesMap.get(c.id) ?? []}
                    rootId={c.id}
                    anonMap={anonMap}
                    currentUserId={user?.id ?? null}
                    onReply={handleReply}
                    onDelete={handleDeleteComment}
                  />
                </div>
              ))
            )}
          </div>
          {/* 자동 스크롤용 sentinel — 새 댓글 등록 시 이 지점으로 스크롤 */}
          <div
            ref={commentsEndRef}
            aria-hidden
            style={{ scrollMarginBottom: "9rem" }}
          />
        </div>
      </div>

      {/* 공유 토스트 — 입력바 위에 짧게 노출 */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4"
          >
            <div className="rounded-full border border-white/15 bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
              {shareToast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 인스타그램 스타일 하단 고정 댓글 입력바 — 익명 게시판은 멘션 비활성 */}
      <CommentComposer
        postId={post.id}
        userId={user?.id ?? null}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        avatar={
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-sm">
            🌙
          </div>
        }
        theme="dark"
        placeholder="익명으로 댓글 달기..."
        enableMentions={false}
        onFocus={scrollToLatestComment}
        onSubmitted={async () => {
          const fresh = await listAnonymousComments(post.id);
          setComments(fresh);
          scrollToLatestComment();
        }}
      />
    </div>
  );
}

// ── 글 ⋮ 메뉴 (본인 한정) ──────────────────────────────────
function PostKebabMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="글 메뉴"
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 hover:bg-white/[0.08] hover:text-white/85 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-30 min-w-[120px] overflow-hidden rounded-xl border border-white/10 bg-[#13132a]/95 shadow-xl backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => {
                onEdit();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.06]"
            >
              <Pencil className="h-3.5 w-3.5" />
              수정
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDelete();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 인라인 편집 폼 ─────────────────────────────────────────
function PostEditor({
  title,
  body,
  tag,
  saving,
  onTitleChange,
  onBodyChange,
  onTagChange,
  onSave,
  onCancel,
}: {
  title: string;
  body: string;
  tag: AnonTagKey | null;
  saving: boolean;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onTagChange: (t: AnonTagKey | null) => void;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="제목 (선택 — 비우면 본문 첫 줄)"
        maxLength={100}
        className={cn(
          "w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none",
          "bg-white/[0.05] border-white/[0.1] text-white placeholder-white/30",
          "focus:border-violet-400/40 focus:bg-white/[0.07]",
        )}
      />
      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="내용을 입력하세요"
        rows={6}
        className={cn(
          "w-full resize-none rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none",
          "bg-white/[0.05] border-white/[0.1] text-white/90 placeholder-white/30",
          "focus:border-violet-400/40 focus:bg-white/[0.07]",
        )}
      />
      <div className="flex flex-wrap gap-1.5">
        {ANON_TAGS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTagChange(tag === t.key ? null : t.key)}
            className={cn(
              "rounded-full border px-2 py-1 text-[11px] font-semibold transition",
              tag === t.key ? t.color : "border-white/10 text-white/40 hover:text-white/70",
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white/90 disabled:opacity-50"
        >
          <XIcon className="h-3.5 w-3.5" />
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !body.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 px-4 py-1.5 text-xs font-bold text-white shadow-[0_0_16px_rgba(124,58,237,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          저장
        </button>
      </div>
    </div>
  );
}
