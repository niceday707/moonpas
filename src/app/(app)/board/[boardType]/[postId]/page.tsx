"use client";

// 글 상세 — /board/[boardType]/[postId]
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Heart,
  Loader2,
  MapPin,
  MessageSquareWarning,
  Package,
  Pencil,
  Pin,
  PinOff,
  Send,
  Trash2,
  Vote,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  BOARD_LABEL,
  MARKET_CONDITION_LABEL,
  createComment,
  deleteComment,
  deletePost,
  getPost,
  incrementLikeCount,
  incrementViewCount,
  listComments,
  parseIssueContent,
  parseLostContent,
  parseMarketContent,
  setPostStatus,
  togglePostPin,
  votePost,
  type BoardType,
  type CommentRow,
  type IssueContent,
  type MarketContent,
  type PostRow,
  type PostStatus,
} from "@/lib/board";
import {
  addLikedPost,
  getVote,
  isPostLiked,
  recordVote,
  type VoteChoice,
} from "@/lib/local-state";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export default function PostDetailPage() {
  const params = useParams<{ boardType: string; postId: string }>();
  const boardType = params.boardType as BoardType;

  if (!VALID_BOARDS.includes(boardType)) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center text-sm text-gray-500">
        존재하지 않는 게시판입니다.
      </div>
    );
  }

  return (
    <AuthGate
      title={`${BOARD_LABEL[boardType]}은 로그인이 필요합니다`}
      description="로그인 후 글과 댓글을 확인하실 수 있어요."
    >
      <DetailInner boardType={boardType} postId={params.postId} />
    </AuthGate>
  );
}

function DetailInner({ boardType, postId }: { boardType: BoardType; postId: string }) {
  const router = useRouter();
  const { user, profile } = useSupabaseProfile();
  const [post, setPost] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingPin, setTogglingPin] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [voting, setVoting] = useState(false);
  const [myVote, setMyVote] = useState<VoteChoice | null>(null);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const viewCounted = useRef(false);

  const refreshComments = useCallback(async () => {
    const list = await listComments(postId);
    setComments(list);
  }, [postId]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([getPost(postId), listComments(postId)]).then(
      ([p, c]) => {
        if (!active) return;
        setPost(p);
        setComments(c);
        setLoading(false);
      },
    );

    // 조회수 +1 (마운트 1회)
    if (!viewCounted.current) {
      viewCounted.current = true;
      incrementViewCount(postId);
    }

    // localStorage 기반 좋아요/투표 상태 복원
    setMyVote(getVote(postId));
    setLiked(isPostLiked(postId));

    return () => {
      active = false;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center">
        <p className="text-sm text-gray-500">존재하지 않거나 삭제된 글입니다.</p>
        <Link
          href={`/board/${boardType}`}
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
        >
          {BOARD_LABEL[boardType]}로 돌아가기
        </Link>
      </div>
    );
  }

  const isOwner = !!user && user.id === post.author_id;
  const role = (profile?.role ?? "") as string;
  const canPin =
    boardType === "notice" && (role === "admin" || role === "teacher");
  const isLost = boardType === "lost";
  const isMarket = boardType === "market";
  const isIssue = boardType === "issue";
  const isFree = boardType === "free";
  const lostInfo = isLost ? parseLostContent(post.content) : null;
  const marketInfo: MarketContent | null = isMarket
    ? parseMarketContent(post.content)
    : null;
  const issueInfo: IssueContent | null = isIssue
    ? parseIssueContent(post.content)
    : null;
  const totalVotes = post.vote_a + post.vote_b;
  const ratioA = totalVotes === 0 ? 50 : Math.round((post.vote_a / totalVotes) * 100);
  const ratioB = totalVotes === 0 ? 50 : 100 - ratioA;

  async function handleDelete() {
    if (!post) return;
    if (!window.confirm("정말 삭제하시겠어요? 되돌릴 수 없어요.")) return;
    const { error } = await deletePost(post.id);
    if (error) {
      window.alert("삭제에 실패했어요.");
      return;
    }
    router.push(`/board/${boardType}`);
  }

  async function handleTogglePin() {
    if (!post || togglingPin) return;
    setTogglingPin(true);
    const next = !post.is_pinned;
    const { error } = await togglePostPin(post.id, next);
    setTogglingPin(false);
    if (error) {
      window.alert("고정 상태를 바꾸지 못했어요.\n" + error);
      return;
    }
    setPost({ ...post, is_pinned: next });
  }

  async function handleToggleStatus() {
    if (!post || togglingStatus) return;
    setTogglingStatus(true);
    const next: PostStatus = post.status === "resolved" ? "active" : "resolved";
    const { error } = await setPostStatus(post.id, next);
    setTogglingStatus(false);
    if (error) {
      window.alert("상태를 바꾸지 못했어요.\n" + error);
      return;
    }
    setPost({ ...post, status: next });
  }

  async function handleVote(choice: VoteChoice) {
    if (!post || voting || myVote) return;
    setVoting(true);
    const { error, voteA, voteB } = await votePost(post.id, choice);
    setVoting(false);
    if (error) {
      window.alert("투표에 실패했어요.\n" + error);
      return;
    }
    recordVote(post.id, choice);
    setMyVote(choice);
    setPost({ ...post, vote_a: voteA, vote_b: voteB });
  }

  async function handleLike() {
    if (!post || liking || liked) return;
    setLiking(true);
    const { error, nextCount } = await incrementLikeCount(post.id);
    setLiking(false);
    if (error) {
      window.alert("좋아요에 실패했어요.\n" + error);
      return;
    }
    addLikedPost(post.id);
    setLiked(true);
    if (nextCount != null) {
      setPost({ ...post, like_count: nextCount });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-md px-4 py-6"
    >
      <Link
        href={`/board/${boardType}`}
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {BOARD_LABEL[boardType]}
      </Link>

      <article
        className={cn(
          "mt-3 rounded-xl border p-5",
          post.is_pinned
            ? "border-rose-300 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/[0.06]"
            : "border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {post.is_pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-500 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
              <Pin className="h-3 w-3" /> 중요
            </span>
          )}
          {isLost && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                post.status === "resolved"
                  ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-500 ring-rose-500/30 dark:text-rose-300",
              )}
            >
              {post.status === "resolved" ? "찾았어요 🟢" : "찾는 중 🔴"}
            </span>
          )}
          {isMarket && (
            <>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  post.status === "resolved"
                    ? "bg-gray-500/15 text-gray-500 ring-gray-500/30 dark:text-gray-300"
                    : "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
                )}
              >
                {post.status === "resolved" ? "나눔완료" : "나눔중"}
              </span>
              {marketInfo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
                  <Package className="h-3 w-3" />
                  {MARKET_CONDITION_LABEL[marketInfo.condition]}
                </span>
              )}
            </>
          )}
          {isIssue && totalVotes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-600 ring-1 ring-inset ring-orange-500/30 dark:text-orange-300">
              <Vote className="h-3 w-3" />
              {totalVotes.toLocaleString()}명 참여
            </span>
          )}
        </div>
        <h1 className="mt-1 text-xl font-extrabold leading-snug text-gray-900 dark:text-white">
          {post.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {post.author?.nickname ?? "(알수없음)"}
          </span>
          {post.author && <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />}
          <span className="text-gray-300">·</span>
          <span className="tabular-nums">{formatDateTime(post.created_at)}</span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1 text-gray-400">
            <Eye className="h-3 w-3" />
            {post.view_count}
          </span>

          <span className="ml-auto flex flex-wrap gap-1">
            {canPin && (
              <button
                type="button"
                onClick={handleTogglePin}
                disabled={togglingPin}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50",
                  post.is_pinned
                    ? "border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]",
                )}
              >
                {togglingPin ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : post.is_pinned ? (
                  <PinOff className="h-3 w-3" />
                ) : (
                  <Pin className="h-3 w-3" />
                )}
                {post.is_pinned ? "고정 해제" : "고정"}
              </button>
            )}
            {isOwner && isLost && (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50",
                  post.status === "resolved"
                    ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                    : "border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10",
                )}
              >
                {togglingStatus && <Loader2 className="h-3 w-3 animate-spin" />}
                {post.status === "resolved" ? "다시 찾는중으로" : "찾았어요로 변경"}
              </button>
            )}
            {isOwner && isMarket && (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50",
                  post.status === "resolved"
                    ? "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                    : "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
                )}
              >
                {togglingStatus ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {post.status === "resolved" ? "다시 나눔중으로" : "나눔완료로 변경"}
              </button>
            )}
            {isOwner && (
              <>
                <Link
                  href={`/board/${boardType}/write?id=${post.id}`}
                  className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                >
                  <Pencil className="h-3 w-3" />
                  수정
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-500 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </>
            )}
          </span>
        </div>

        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="mt-4 max-h-96 w-full rounded-lg object-contain"
          />
        )}

        {isLost && lostInfo && (lostInfo.location || lostInfo.lostDate) && (
          <div className="mt-4 grid gap-2 rounded-lg border border-gray-100 bg-gray-50/70 px-4 py-3 text-xs sm:grid-cols-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
            {lostInfo.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    분실 장소
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200">
                    {lostInfo.location}
                  </p>
                </div>
              </div>
            )}
            {lostInfo.lostDate && (
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-violet-500" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    분실 날짜
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200">
                    {lostInfo.lostDate}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {isMarket && marketInfo && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/70 px-4 py-3 text-xs dark:border-white/[0.06] dark:bg-white/[0.03]">
            <Package className="h-5 w-5 shrink-0 text-violet-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                물품 상태
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                {MARKET_CONDITION_LABEL[marketInfo.condition]}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
          {isLost && lostInfo
            ? lostInfo.description
            : isMarket && marketInfo
            ? marketInfo.description
            : isIssue && issueInfo
            ? issueInfo.description
            : post.content}
        </div>

        {/* 이슈 토론 — 투표 UI */}
        {isIssue && issueInfo && (
          <div className="mt-5 rounded-xl border border-gray-100 bg-gradient-to-br from-violet-50 to-cyan-50 p-4 dark:border-white/[0.06] dark:from-violet-500/[0.05] dark:to-cyan-500/[0.05]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">
              <Vote className="h-3.5 w-3.5" />
              어느 쪽에 동의하시나요?
            </div>

            {myVote == null ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleVote("a")}
                  disabled={voting}
                  className="rounded-xl border border-blue-300 bg-white px-4 py-4 text-sm font-bold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-white/[0.03] dark:text-blue-300 dark:hover:bg-blue-500/10"
                >
                  {voting && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                  {issueInfo.optionA}
                </button>
                <button
                  type="button"
                  onClick={() => handleVote("b")}
                  disabled={voting}
                  className="rounded-xl border border-rose-300 bg-white px-4 py-4 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:bg-white/[0.03] dark:text-rose-300 dark:hover:bg-rose-500/10"
                >
                  {voting && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                  {issueInfo.optionB}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <VoteBar
                  label={issueInfo.optionA}
                  count={post.vote_a}
                  ratio={ratioA}
                  voted={myVote === "a"}
                  side="a"
                />
                <VoteBar
                  label={issueInfo.optionB}
                  count={post.vote_b}
                  ratio={ratioB}
                  voted={myVote === "b"}
                  side="b"
                />
                <p className="pt-1 text-center text-[11px] text-gray-500 dark:text-gray-400">
                  총 {totalVotes.toLocaleString()}명이 참여 ·{" "}
                  {myVote === "a" ? issueInfo.optionA : issueInfo.optionB}에
                  투표하셨어요
                </p>
              </div>
            )}
          </div>
        )}

        {/* 자유게시판 — 좋아요 버튼 */}
        {isFree && (
          <div className="mt-5 flex items-center justify-center">
            <button
              type="button"
              onClick={handleLike}
              disabled={liking || liked}
              className={cn(
                "flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed",
                liked
                  ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                  : "border-gray-200 bg-white text-gray-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-300",
              )}
            >
              {liking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  className={cn("h-4 w-4", liked && "fill-current")}
                  strokeWidth={2.2}
                />
              )}
              <span className="tabular-nums">
                {liked ? "좋아요!" : "좋아요"} · {post.like_count.toLocaleString()}
              </span>
            </button>
          </div>
        )}

        {/* PDF 다운로드 */}
        {post.file_url && (
          <a
            href={post.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
          >
            <FileText className="h-6 w-6 shrink-0 text-violet-500" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {post.file_name ?? "첨부 파일"}
              </p>
              <p className="text-[10px] text-gray-500">
                새 탭에서 열기 / 다운로드
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
              <Download className="h-3.5 w-3.5" />
              다운로드
            </span>
          </a>
        )}
      </article>

      {/* 댓글 ─────────────────────── */}
      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          댓글 {comments.length}
        </h2>

        {comments.length === 0 ? (
          <p className="mt-3 text-xs text-gray-400">
            아직 댓글이 없어요. 첫 댓글을 남겨보세요.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.04]">
            {comments.map((c) => {
              const owner = !!user && user.id === c.author_id;
              return (
                <li key={c.id} className="py-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {c.author?.nickname ?? "(알수없음)"}
                    </span>
                    {c.author && (
                      <Badge role={c.author.role} className="text-[9px] py-0 px-1.5" />
                    )}
                    <span className="text-gray-300">·</span>
                    <span className="tabular-nums">{formatDateTime(c.created_at)}</span>
                    {owner && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("이 댓글을 삭제하시겠어요?")) return;
                          await deleteComment(c.id);
                          await refreshComments();
                        }}
                        className="ml-auto text-red-500 transition hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                    {c.content}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <CommentInput postId={post.id} onCreated={refreshComments} />
      </section>
    </motion.div>
  );
}

function CommentInput({
  postId,
  onCreated,
}: {
  postId: string;
  onCreated: () => Promise<void>;
}) {
  const { user } = useSupabaseProfile();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return (
      <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
        로그인 후 댓글을 작성할 수 있습니다.
      </p>
    );
  }

  async function handleSubmit() {
    const t = text.trim();
    if (!t) return;
    setSubmitting(true);
    if (!user) {
      setSubmitting(false);
      return;
    }
    const { error } = await createComment({
      authorId: user.id,
      postId,
      content: t,
    });
    setSubmitting(false);
    if (error) {
      window.alert("댓글 작성에 실패했어요.");
      return;
    }
    setText("");
    await onCreated();
  }

  return (
    <div className="mt-4 flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="댓글을 입력하세요"
        rows={2}
        disabled={submitting}
        className="min-h-[44px] flex-1 resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !text.trim()}
        className="flex h-11 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        등록
      </button>
    </div>
  );
}

// 이슈 토론 — 결과 가로 비율 바
function VoteBar({
  label,
  count,
  ratio,
  voted,
  side,
}: {
  label: string;
  count: number;
  ratio: number;
  voted: boolean;
  side: "a" | "b";
}) {
  const colorBg = side === "a" ? "bg-blue-500" : "bg-rose-500";
  const colorText =
    side === "a"
      ? "text-blue-700 dark:text-blue-300"
      : "text-rose-700 dark:text-rose-300";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span className={cn("flex items-center gap-1", colorText)}>
          {voted && <MessageSquareWarning className="h-3 w-3" />}
          {label}
        </span>
        <span className={colorText}>
          {ratio}% · {count.toLocaleString()}표
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/[0.05]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${ratio}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", colorBg)}
        />
      </div>
    </div>
  );
}
