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
  Clock,
  CornerDownRight,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Heart,
  Loader2,
  MapPin,
  MessageSquareWarning,
  Package,
  Pencil,
  Pin,
  PinOff,
  PlayCircle,
  Quote,
  School,
  Share2,
  Trash2,
  Users,
  Vote,
} from "lucide-react";
import {
  CommentComposer,
  type ReplyTarget,
} from "@/components/comments/CommentComposer";
import { HighlightedContent } from "@/components/comments/HighlightedContent";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  BOARD_LABEL,
  MARKET_CONDITION_LABEL,
  QA_SUBJECT_STYLE,
  RESOURCE_CATEGORY_STYLE,
  STUDY_SUBJECT_STYLE,
  deleteComment,
  deletePost,
  getPost,
  getQaSubjectLabel,
  getResourceCategoryLabel,
  getLikedPostIds,
  getStudySubjectLabel,
  incrementViewCount,
  listComments,
  parseAlumniContent,
  parseIssueContent,
  parseLostContent,
  parseMarketContent,
  parseQaContent,
  parseResourceContent,
  parseSeniorContent,
  parseStudyContent,
  parseYoutubeContent,
  setPostStatus,
  toggleLike,
  toggleCommentReaction,
  togglePostPin,
  votePost,
  youtubeEmbedUrl,
  type AlumniContent,
  type BoardType,
  type CommentRow,
  type IssueContent,
  type MarketContent,
  type PostRow,
  type PostStatus,
  type QaContent,
  type ResourceContent,
  type SeniorContent,
  type StudyContent,
  type YoutubeContent,
} from "@/lib/board";
import {
  displayAuthorNameFor,
  shouldShowAuthorBadgeFor,
} from "@/lib/author-display";
import { extractPostBody } from "@/lib/parsePostContent";
import {
  getVote,
  recordVote,
  type VoteChoice,
} from "@/lib/local-state";
import { buildPostShareUrl, sharePost } from "@/lib/share";
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
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const viewCounted = useRef(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const scrollToLatestComment = useCallback(() => {
    // 다음 프레임에 스크롤 — 새 댓글이 DOM 에 반영된 뒤
    window.setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 60);
  }, []);

  const refreshComments = useCallback(async () => {
    const list = await listComments(postId);
    setComments(list);
  }, [postId]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      getPost(postId),
      listComments(postId),
      getLikedPostIds([postId]),
    ]).then(([p, c, likedIds]) => {
      if (!active) return;
      setPost(p);
      setComments(c);
      setLiked(likedIds.has(postId));
      setLoading(false);
    });

    // 조회수 +1 (마운트 1회)
    if (!viewCounted.current) {
      viewCounted.current = true;
      incrementViewCount(postId);
    }

    // 투표 상태는 localStorage 유지 (별도 마이그레이션 전)
    setMyVote(getVote(postId));

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

  // 익명 게시판은 author_id 가 마스킹되므로 is_mine 으로 본인 판별
  const isOwner = !!user && (post.is_mine || user.id === post.author_id);
  const role = (profile?.role ?? "") as string;
  const canPin =
    boardType === "notice" && (role === "admin" || role === "teacher");
  const isLost = boardType === "lost";
  const isMarket = boardType === "market";
  const isIssue = boardType === "debate";
  const isQa = boardType === "qa";
  const isYoutube = boardType === "youtube";
  const isResources = boardType === "resources";
  const isStudy = boardType === "study";
  const isAlumni = boardType === "alumni";
  const isSenior = boardType === "senior";
  const lostInfo = isLost ? parseLostContent(post.content) : null;
  const marketInfo: MarketContent | null = isMarket
    ? parseMarketContent(post.content)
    : null;
  const issueInfo: IssueContent | null = isIssue
    ? parseIssueContent(post.content)
    : null;
  const qaInfo: QaContent | null = isQa ? parseQaContent(post.content) : null;
  const youtubeInfo: YoutubeContent | null = isYoutube
    ? parseYoutubeContent(post.content)
    : null;
  const resourceInfo: ResourceContent | null = isResources
    ? parseResourceContent(post.content)
    : null;
  const studyInfo: StudyContent | null = isStudy
    ? parseStudyContent(post.content)
    : null;
  const alumniInfo: AlumniContent | null = isAlumni
    ? parseAlumniContent(post.content)
    : null;
  const seniorInfo: SeniorContent | null = isSenior
    ? parseSeniorContent(post.content)
    : null;
  const answered = isQa && comments.length > 0;
  const studyJoined = studyInfo
    ? Math.min(studyInfo.maxMembers, comments.length + 1)
    : 0;
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
    if (!post || liking) return;
    const wasLiked = liked;
    // optimistic
    setLiked(!wasLiked);
    setPost({
      ...post,
      like_count: Math.max(0, post.like_count + (wasLiked ? -1 : 1)),
    });
    setLiking(true);
    const { error, liked: nextLiked, like_count } = await toggleLike(post.id);
    setLiking(false);
    if (error) {
      // 롤백
      setLiked(wasLiked);
      setPost((p) =>
        p
          ? {
              ...p,
              like_count: Math.max(0, p.like_count + (wasLiked ? 1 : -1)),
            }
          : p,
      );
      window.alert("좋아요에 실패했어요.\n" + error);
      return;
    }
    setLiked(nextLiked);
    if (like_count != null) {
      setPost((p) => (p ? { ...p, like_count } : p));
    }
  }

  async function handleShare() {
    if (!post) return;
    const url = buildPostShareUrl(post.board_type, post.id);
    const result = await sharePost({ title: post.title, url });
    if (result.kind === "copied") {
      setShareToast("링크가 복사되었습니다");
    } else if (result.kind === "error") {
      setShareToast(result.message);
    }
    if (result.kind === "copied" || result.kind === "error") {
      window.setTimeout(() => setShareToast(null), 2200);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-md px-4 pt-6"
      // 하단 고정 댓글 입력바(약 60px) + 답글 배너 여유 + safe-area
      style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
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
          {isQa && qaInfo && (
            <>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  QA_SUBJECT_STYLE[qaInfo.subject],
                )}
              >
                {getQaSubjectLabel(qaInfo.subject)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  answered
                    ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300",
                )}
              >
                {answered ? "답변완료 ✅" : "답변대기 ⏳"}
              </span>
            </>
          )}
          {isResources && resourceInfo && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                RESOURCE_CATEGORY_STYLE[resourceInfo.category],
              )}
            >
              {getResourceCategoryLabel(resourceInfo.category)}
            </span>
          )}
          {isStudy && studyInfo && (
            <>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  STUDY_SUBJECT_STYLE[studyInfo.subject],
                )}
              >
                {getStudySubjectLabel(studyInfo.subject)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  post.status === "resolved"
                    ? "bg-gray-500/15 text-gray-500 ring-gray-500/30 dark:text-gray-300"
                    : "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
                )}
              >
                {post.status === "resolved" ? "마감" : "모집중"}
              </span>
            </>
          )}
          {isAlumni && alumniInfo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
              <GraduationCap className="h-3 w-3" />
              {alumniInfo.graduationYear} 졸업
            </span>
          )}
          {isSenior && seniorInfo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
              <GraduationCap className="h-3 w-3" />
              {seniorInfo.graduationYear} 졸업
            </span>
          )}
          {isYoutube && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-inset ring-red-500/30 dark:text-red-300">
              <PlayCircle className="h-3 w-3" />
              문튜브
            </span>
          )}
        </div>
        <h1 className="mt-1 text-xl font-extrabold leading-snug text-gray-900 dark:text-white">
          {post.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <UserAvatar
            nickname={post.author?.nickname}
            role={post.author?.role}
            avatarUrl={post.author?.avatar_url ?? null}
            size="sm"
          />
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          {shouldShowAuthorBadgeFor(post.board_type) && post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
          <span className="text-gray-300">·</span>
          <span className="tabular-nums">{formatDateTime(post.created_at)}</span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1 text-gray-400">
            <Eye className="h-3 w-3" />
            {post.view_count}
          </span>

          <span className="ml-auto flex flex-wrap gap-1">
            <button
              type="button"
              onClick={handleShare}
              aria-label="공유"
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
            >
              <Share2 className="h-3 w-3" />
              공유
            </button>
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
            {isOwner && isStudy && (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50",
                  post.status === "resolved"
                    ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]",
                )}
              >
                {togglingStatus ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {post.status === "resolved" ? "다시 모집중으로" : "마감하기"}
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

        {/* 문튜브 — YouTube iframe 임베드 (이미지 자리 대신) */}
        {isYoutube && youtubeInfo?.videoId ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-white/[0.07]">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={youtubeEmbedUrl(youtubeInfo.videoId)}
                title={post.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        ) : post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="mt-4 max-h-96 w-full rounded-lg object-contain"
          />
        ) : null}

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

        {/* 스터디 — 모집 정보 패널 */}
        {isStudy && studyInfo && (
          <div className="mt-4 grid gap-2 rounded-lg border border-gray-100 bg-gray-50/70 px-4 py-3 text-xs sm:grid-cols-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-violet-500" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  모집 인원
                </p>
                <p className="mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200 tabular-nums">
                  {studyJoined}/{studyInfo.maxMembers}명
                </p>
              </div>
            </div>
            {studyInfo.schedule && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-violet-500" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    시간대
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200">
                    {studyInfo.schedule}
                  </p>
                </div>
              </div>
            )}
            {studyInfo.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    장소
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200">
                    {studyInfo.location}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 선배의 한마디 — 대학/학과/요약 패널 */}
        {isSenior && seniorInfo && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gradient-to-br from-violet-50 to-cyan-50 p-4 dark:border-white/[0.06] dark:from-violet-500/[0.05] dark:to-cyan-500/[0.05]">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-md">
                <School className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold text-gray-900 dark:text-white">
                  {seniorInfo.university || "(대학명 미입력)"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {seniorInfo.major || "(학과 미입력)"} · {seniorInfo.graduationYear}년
                  졸업
                </p>
              </div>
            </div>
            {seniorInfo.summary && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2.5 text-sm font-semibold text-violet-700 ring-1 ring-inset ring-violet-500/20 dark:bg-white/[0.04] dark:text-violet-200">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                {seniorInfo.summary}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
          {isLost && lostInfo
            ? lostInfo.description
            : isMarket && marketInfo
            ? marketInfo.description
            : isIssue && issueInfo
            ? issueInfo.description
            : isQa && qaInfo
            ? qaInfo.question
            : isYoutube && youtubeInfo
            ? youtubeInfo.description
            : isResources && resourceInfo
            ? resourceInfo.description
            : isStudy && studyInfo
            ? studyInfo.description
            : isAlumni && alumniInfo
            ? alumniInfo.description
            : isSenior && seniorInfo
            ? seniorInfo.review
            : /* 그 외 보드(자유/공지/뉴스/챌린지 등)는 plain text 가 정상 — 혹시
                 과거에 JSON 으로 저장된 행이 있더라도 raw JSON 노출되지 않게 추출 */
              extractPostBody(post.content, post.board_type)}
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

        {/* 좋아요 토글 버튼 — 모든 게시판 */}
        <div className="mt-5 flex items-center justify-center">
          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            aria-pressed={liked}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
            className={cn(
              "flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
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
              {liked ? "좋아요 취소" : "좋아요"} · {post.like_count.toLocaleString()}
            </span>
          </button>
        </div>

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

      {/* 댓글/답변 ─────────────────────── */}
      <CommentsSection
        comments={comments}
        currentUserId={user?.id ?? null}
        boardType={boardType}
        isQa={isQa}
        onChanged={refreshComments}
        replyTargetId={replyTo?.id ?? null}
        onReply={(target) => setReplyTo(target)}
        endRef={commentsEndRef}
      />

      {/* 공유 결과 토스트 — 입력바 위에 띄움 */}
      <AnimatePresenceToast message={shareToast} />

      {/* 인스타그램 스타일 하단 고정 댓글 입력바 — 멘션 자동완성 활성 */}
      <CommentComposer
        postId={post.id}
        userId={user?.id ?? null}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        avatar={
          <UserAvatar
            nickname={profile?.nickname}
            role={profile?.role ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            size="sm"
          />
        }
        theme="light"
        placeholder={isQa ? "답변을 입력하세요..." : "댓글을 입력하세요..."}
        enableMentions
        actorNickname={profile?.nickname ?? null}
        onFocus={scrollToLatestComment}
        onSubmitted={async () => {
          await refreshComments();
          scrollToLatestComment();
        }}
      />
    </motion.div>
  );
}

/**
 * 댓글 트리 평탄화.
 *   - parent_id 가 NULL → 루트 댓글
 *   - parent_id 가 다른 댓글 → 답글. 답글의 답글(레거시 데이터)도 root 까지 거슬러 올라감.
 *   - 결과: rootId(루트 댓글) → 모든 후손 답글의 평탄 배열 (시간순)
 */
function buildCommentTree(comments: CommentRow[]) {
  const byId = new Map<string, CommentRow>();
  for (const c of comments) byId.set(c.id, c);

  const findRoot = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (true) {
      if (seen.has(cur)) return cur; // 사이클 방지
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
  // 동일 root 내 답글은 created_at 순 (listComments 가 ASC 로 가져오지만 안전하게 재정렬)
  for (const arr of repliesByRoot.values()) {
    arr.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }
  return { roots, repliesByRoot };
}

/**
 * 인스타그램 스타일 댓글 트리.
 *   - 답글은 들여쓰기 1단계로 평탄하게 시간순 정렬
 *   - 모든 댓글(루트 + 답글)에 "답글" 버튼 노출
 *   - 답글의 답글 등록 시 parent_id 는 항상 root 의 id
 *   - 답글이 3개 초과면 기본 2개만 보이고 "답글 N개 더 보기" 토글
 */
function CommentsSection({
  comments,
  currentUserId,
  boardType,
  isQa,
  onChanged,
  replyTargetId,
  onReply,
  endRef,
}: {
  comments: CommentRow[];
  currentUserId: string | null;
  boardType: BoardType;
  isQa: boolean;
  onChanged: () => Promise<void>;
  replyTargetId: string | null;
  onReply: (target: ReplyTarget) => void;
  endRef: React.RefObject<HTMLDivElement>;
}) {
  const { roots, repliesByRoot } = buildCommentTree(comments);

  return (
    <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white">
        {isQa ? `답변 ${comments.length}` : `댓글 ${comments.length}`}
      </h2>

      {roots.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">
          {isQa
            ? "아직 답변이 없어요. 아는 분이 첫 답변을 남겨보세요!"
            : "아직 댓글이 없어요. 첫 댓글을 남겨보세요."}
        </p>
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
                  onDeleted={onChanged}
                  replyButton={{
                    count: replies.length,
                    active: replyTargetId === root.id,
                    onClick: () =>
                      onReply({
                        id: root.id, // 루트의 id 가 곧 parent_id 로 저장됨
                        label: rootLabel,
                        mentionUserId: root.author?.id ?? null,
                      }),
                  }}
                />

                {/* 답글 영역 — 들여쓰기 1단계로 평탄. 시간순. 3개 초과면 접기 */}
                {replies.length > 0 && (
                  <RepliesList
                    replies={replies}
                    rootId={root.id}
                    boardType={boardType}
                    currentUserId={currentUserId}
                    onChanged={onChanged}
                    onReply={onReply}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 자동 스크롤용 sentinel — 새 댓글 등록 시 이 지점으로 스크롤 */}
      <div ref={endRef} aria-hidden style={{ scrollMarginBottom: "9rem" }} />
    </section>
  );
}

/** 한 루트 댓글의 답글 리스트 — 3개 초과 시 기본 2개만 보이고 토글로 펼침. */
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
  const COLLAPSE_THRESHOLD = 3; // 이 개수 초과면 접기 사용
  const COLLAPSED_VISIBLE = 2; // 접혔을 때 보이는 개수
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
        const replyLabel = displayAuthorNameFor({
          boardType,
          author: r.author,
        });
        return (
          <CommentItem
            key={r.id}
            comment={r}
            boardType={boardType}
            currentUserId={currentUserId}
            onDeleted={onChanged}
            isReply
            replyButton={{
              count: 0, // 답글의 답글 수는 노출하지 않음 (모두 같은 root 아래에 평탄화)
              active: false,
              onClick: () =>
                onReply({
                  id: rootId, // 핵심 — root 의 id 가 parent_id 로 저장
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

  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(comment.my_reaction);
  const [likeCount, setLikeCount] = useState(comment.like_count);
  const [reacting, setReacting] = useState(false);

  const handleReaction = async (r: "like" | "dislike") => {
    if (!currentUserId || reacting) return;
    const prev = { myReaction, likeCount };
    // optimistic update
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
        <span className="font-semibold text-gray-700 dark:text-gray-200">
          {displayAuthorNameFor({ boardType, author: comment.author })}
        </span>
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

        {/* 좋아요 / 싫어요 */}
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

// 공유 토스트 — 입력바 위에 잠깐 노출
function AnimatePresenceToast({ message }: { message: string | null }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: message ? 1 : 0, y: message ? 0 : 12 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4"
    >
      {message && (
        <div className="pointer-events-auto rounded-full border border-white/15 bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
          {message}
        </div>
      )}
    </motion.div>
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
