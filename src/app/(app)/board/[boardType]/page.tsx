"use client";

// 게시판 목록 — /board/[boardType]
// boardType 별 분기:
//  - notice: 고정글 우선 + "중요" 뱃지
//  - lost: 카드 그리드 + 상태 필터
//  - market: 당근 스타일 카드 그리드 + 상태 필터 + 물품상태 뱃지
//  - issue: 토론 리스트 + 미니 투표 바 + 🔥HOT 뱃지
//  - challenge: 인스타 그리드 + 본인 연속 인증 배너 + 주간 랭킹
//  - free: 카드형 레이아웃 + 좋아요 버튼 + 인기글 뱃지
//  - 그 외: 기본 리스트
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Eye,
  MessageSquare,
  PenSquare,
  Loader2,
  Paperclip,
  Pin,
  MapPin,
  ImageOff,
  Heart,
  Vote,
  Flame,
  Trophy,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AuthGate } from "@/components/auth/AuthGate";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { addLikedPost, getLikedPosts } from "@/lib/local-state";
import { cn } from "@/lib/utils";
import {
  BOARD_LABEL,
  MARKET_CONDITION_LABEL,
  POSTS_PER_PAGE,
  getChallengeStats,
  incrementLikeCount,
  listPosts,
  parseIssueContent,
  parseLostContent,
  parseMarketContent,
  type BoardType,
  type ChallengeStats,
  type PostRow,
  type PostStatus,
} from "@/lib/board";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function isNewPost(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < ONE_DAY_MS;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

/** 상대 시간 — 자유게시판 카드용 ("방금 전", "3시간 전", "2일 전") */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60 * 1000;
  if (diff < 5 * min) return "방금 전";
  if (diff < 60 * min) return `${Math.floor(diff / min)}분 전`;
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))}시간 전`;
  if (diff < 7 * 24 * 60 * min) return `${Math.floor(diff / (24 * 60 * min))}일 전`;
  return formatDate(iso);
}

/** 자유게시판 카드 — 본문 미리보기에서 hashtag/url 같은 잡음 제거 없이 단순 truncate */
function previewText(content: string, max = 120): string {
  return content.replace(/\s+/g, " ").trim().slice(0, max);
}

export default function BoardListPage() {
  const params = useParams<{ boardType: string }>();
  const boardType = params.boardType as BoardType;

  if (!VALID_BOARDS.includes(boardType)) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center">
        <p className="text-sm text-gray-500">존재하지 않는 게시판입니다.</p>
      </div>
    );
  }

  return (
    <AuthGate
      title={`${BOARD_LABEL[boardType]}은 로그인이 필요합니다`}
      description="문태고 학생·교사·학부모·졸업생만 이용할 수 있어요."
    >
      <BoardListInner boardType={boardType} />
    </AuthGate>
  );
}

function BoardListInner({ boardType }: { boardType: BoardType }) {
  const isNotice = boardType === "notice";
  const isLost = boardType === "lost";
  const isMarket = boardType === "market";
  const isIssue = boardType === "issue";
  const isChallenge = boardType === "challenge";
  const isFree = boardType === "free";
  const supportsStatusFilter = isLost || isMarket;

  const { user, profile } = useSupabaseProfile();
  const role = (profile?.role ?? "") as string;
  const canWrite = isNotice ? role === "admin" || role === "teacher" : true;

  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | PostStatus>("");

  // 챌린지 — 연속 인증/주간 랭킹
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(null);

  // 자유게시판 — 좋아요 진행 중 상태
  const [likingId, setLikingId] = useState<string | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPage(1);
  }, [statusFilter, boardType]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPosts(boardType, page, {
      pinnedFirst: isNotice,
      status: supportsStatusFilter && statusFilter ? statusFilter : null,
    }).then((res) => {
      if (!active) return;
      setPosts(res.posts);
      setTotal(res.total);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [boardType, page, isNotice, supportsStatusFilter, statusFilter]);

  // 챌린지 보드 진입 시 통계 fetch
  useEffect(() => {
    if (!isChallenge) return;
    let active = true;
    getChallengeStats().then((s) => {
      if (active) setChallengeStats(s);
    });
    return () => {
      active = false;
    };
  }, [isChallenge]);

  // 자유게시판 — localStorage 의 좋아요 캐시 복원
  useEffect(() => {
    if (!isFree) return;
    setLikedSet(getLikedPosts());
  }, [isFree, page]);

  async function handleLikeFromCard(postId: string) {
    if (likingId || likedSet.has(postId)) return;
    setLikingId(postId);
    const { error, nextCount } = await incrementLikeCount(postId);
    setLikingId(null);
    if (error) return;
    addLikedPost(postId);
    setLikedSet((prev) => {
      const s = new Set(prev);
      s.add(postId);
      return s;
    });
    if (nextCount != null) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, like_count: nextCount } : p)),
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-lg px-4 py-6"
    >
      {/* 헤더 */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {BOARD_LABEL[boardType]}
          </h1>
          <p className="mt-1 text-xs text-gray-400">총 {total}개의 글</p>
        </div>
        {canWrite ? (
          <Link
            href={`/board/${boardType}/write`}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <PenSquare className="h-4 w-4" />
            글쓰기
          </Link>
        ) : (
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
            관리자만 작성
          </span>
        )}
      </div>

      {/* 챌린지 — 본인 연속 인증 배너 + 주간 랭킹 */}
      {isChallenge && (
        <ChallengeHeader
          stats={challengeStats}
          currentUserId={user?.id ?? null}
        />
      )}

      {/* 상태 필터 (lost / market) */}
      {supportsStatusFilter && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(
            [
              { value: "", label: "전체" },
              {
                value: "active",
                label: isLost ? "찾는 중 🔴" : "나눔중 🟢",
              },
              {
                value: "resolved",
                label: isLost ? "찾았어요 🟢" : "나눔완료",
              },
            ] as Array<{ value: "" | PostStatus; label: string }>
          ).map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 본문 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-violet-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-white/[0.07] dark:bg-[#16162a]">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {(supportsStatusFilter && statusFilter)
              ? "조건에 해당하는 글이 없습니다."
              : "아직 게시글이 없습니다."}
          </p>
          {canWrite && !statusFilter && (
            <p className="mt-1 text-xs text-gray-400">
              첫 번째 글을 작성해보세요!
            </p>
          )}
        </div>
      ) : isLost ? (
        <LostGrid posts={posts} />
      ) : isMarket ? (
        <MarketGrid posts={posts} />
      ) : isIssue ? (
        <IssueList posts={posts} />
      ) : isChallenge ? (
        <ChallengeGrid
          posts={posts}
          streakByAuthor={challengeStats?.streakByAuthor ?? {}}
        />
      ) : isFree ? (
        <FreeCards
          posts={posts}
          likedSet={likedSet}
          onLike={handleLikeFromCard}
          likingId={likingId}
        />
      ) : (
        <DefaultList
          posts={posts}
          boardType={boardType}
          highlightPinned={isNotice}
        />
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={
                "h-8 min-w-[32px] rounded-md text-xs font-semibold transition " +
                (p === page
                  ? "bg-violet-600 text-white"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.05]")
              }
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── 기본 리스트 (자유게시판/공지 등) ─────────────────────────
function DefaultList({
  posts,
  boardType,
  highlightPinned,
}: {
  posts: PostRow[];
  boardType: BoardType;
  highlightPinned: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]">
      <ul className="divide-y divide-gray-100 dark:divide-white/[0.04]">
        {posts.map((post) => {
          const pinned = highlightPinned && post.is_pinned;
          const fresh = isNewPost(post.created_at);
          return (
            <li key={post.id}>
              <Link
                href={`/board/${boardType}/${post.id}`}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors",
                  pinned
                    ? "bg-violet-50/70 hover:bg-violet-100/60 dark:bg-violet-500/[0.07] dark:hover:bg-violet-500/[0.12]"
                    : "hover:bg-gray-50 dark:hover:bg-white/[0.02]",
                )}
              >
                {post.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image_url}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {pinned && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
                        <Pin className="h-2.5 w-2.5" />
                        중요
                      </span>
                    )}
                    <span className="truncate">{post.title}</span>
                    {fresh && (
                      <span className="shrink-0 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
                        NEW
                      </span>
                    )}
                    {post.file_url && (
                      <Paperclip
                        aria-label="PDF 첨부"
                        className="h-3.5 w-3.5 shrink-0 text-violet-500"
                      />
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {post.author?.nickname ?? "(알수없음)"}
                    </span>
                    {post.author && (
                      <Badge
                        role={post.author.role}
                        className="text-[9px] py-0 px-1.5"
                      />
                    )}
                    <span className="text-gray-400">·</span>
                    <span className="tabular-nums">
                      {formatDate(post.created_at)}
                    </span>
                    <span className="ml-auto flex items-center gap-2 text-gray-400">
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        {post.view_count}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {post.comment_count}
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 분실물 카드 그리드 ─────────────────────────────────────
function LostGrid({ posts }: { posts: PostRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {posts.map((post) => (
        <LostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function LostCard({ post }: { post: PostRow }) {
  const info = useMemo(() => parseLostContent(post.content), [post.content]);
  const fresh = isNewPost(post.created_at);
  const resolved = post.status === "resolved";

  return (
    <Link
      href={`/board/lost/${post.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)] dark:border-white/[0.07] dark:bg-[#16162a]"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-white/[0.04]">
        {post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
              resolved && "opacity-70",
            )}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-300 dark:text-white/20">
            <ImageOff className="h-8 w-8" />
            <span className="text-[10px]">사진 없음</span>
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset backdrop-blur-sm",
              resolved
                ? "bg-emerald-500/80 text-white ring-white/20"
                : "bg-rose-500/85 text-white ring-white/20",
            )}
          >
            {resolved ? "찾았어요 🟢" : "찾는 중 🔴"}
          </span>
          {fresh && (
            <span className="inline-flex items-center rounded-full bg-violet-500/85 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              NEW
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white">
          {post.title}
        </p>
        {info.location && (
          <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <MapPin className="h-3 w-3 shrink-0 text-violet-500" />
            <span className="line-clamp-1">{info.location}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-gray-400">
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {post.author?.nickname ?? "(알수없음)"}
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {post.comment_count}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── 나눔장터 카드 그리드 (당근 스타일) ───────────────────────
function MarketGrid({ posts }: { posts: PostRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <MarketCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function MarketCard({ post }: { post: PostRow }) {
  const info = useMemo(() => parseMarketContent(post.content), [post.content]);
  const resolved = post.status === "resolved";
  const fresh = isNewPost(post.created_at);

  return (
    <Link
      href={`/board/market/${post.id}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)] dark:bg-[#16162a]",
        resolved
          ? "border-gray-200 dark:border-white/[0.05]"
          : "border-gray-200 dark:border-white/[0.07]",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
              resolved && "opacity-50",
            )}
            loading="lazy"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-violet-500 to-cyan-500 text-white",
              resolved && "opacity-60",
            )}
          >
            <Package className="h-10 w-10 opacity-90" />
            <span className="px-3 text-center text-[11px] font-semibold leading-tight opacity-90 line-clamp-2">
              {post.title}
            </span>
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset backdrop-blur-sm",
              resolved
                ? "bg-gray-700/80 text-white ring-white/20"
                : "bg-emerald-500/85 text-white ring-white/20",
            )}
          >
            {resolved ? "나눔완료" : "나눔중"}
          </span>
          {fresh && !resolved && (
            <span className="inline-flex items-center rounded-full bg-violet-500/85 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              NEW
            </span>
          )}
        </div>

        {/* 나눔완료 오버레이 */}
        {resolved && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[1px]">
            <span className="rounded-full bg-white/95 px-4 py-1.5 text-xs font-extrabold text-gray-700">
              나눔완료
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p
          className={cn(
            "line-clamp-2 text-sm font-bold",
            resolved
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-900 dark:text-white",
          )}
        >
          {post.title}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
              "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300",
            )}
          >
            {MARKET_CONDITION_LABEL[info.condition]}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-gray-400">
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {post.author?.nickname ?? "(알수없음)"}
          </span>
          <span className="tabular-nums">{relativeTime(post.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}

// ── 이슈 토론 리스트 + 미니 투표 바 ─────────────────────────
const HOT_THRESHOLD = 10;

function IssueList({ posts }: { posts: PostRow[] }) {
  return (
    <ul className="space-y-3">
      {posts.map((post) => (
        <IssueRow key={post.id} post={post} />
      ))}
    </ul>
  );
}

function IssueRow({ post }: { post: PostRow }) {
  const info = useMemo(() => parseIssueContent(post.content), [post.content]);
  const total = post.vote_a + post.vote_b;
  const ratioA = total === 0 ? 50 : Math.round((post.vote_a / total) * 100);
  const ratioB = total === 0 ? 50 : 100 - ratioA;
  const fresh = isNewPost(post.created_at);
  const hot = total >= HOT_THRESHOLD;

  return (
    <li>
      <Link
        href={`/board/issue/${post.id}`}
        className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {hot && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 ring-1 ring-inset ring-orange-500/30 dark:text-orange-300">
              🔥 HOT
            </span>
          )}
          {fresh && (
            <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
              NEW
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400">
            {formatDate(post.created_at)}
          </span>
        </div>

        <h2 className="mt-1.5 line-clamp-2 text-base font-extrabold leading-snug text-gray-900 dark:text-white">
          {post.title}
        </h2>

        {info.description && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {info.description}
          </p>
        )}

        {/* 미니 투표 바 */}
        <div className="mt-3">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/[0.05]">
            <div
              className="bg-blue-500"
              style={{ width: `${ratioA}%` }}
              aria-hidden
            />
            <div
              className="bg-rose-500"
              style={{ width: `${ratioB}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-blue-600 dark:text-blue-300">
              {info.optionA} {ratioA}%
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <Vote className="h-3 w-3" />
              {total.toLocaleString()}명 참여
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-300">
              {ratioB}% {info.optionB}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {post.author?.nickname ?? "(알수없음)"}
          </span>
          {post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
          <span className="ml-auto flex items-center gap-2 text-gray-400">
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {post.comment_count}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}

// ── 챌린지 — 본인 연속 인증 배너 + 주간 랭킹 ─────────────────
function ChallengeHeader({
  stats,
  currentUserId,
}: {
  stats: ChallengeStats | null;
  currentUserId: string | null;
}) {
  const myStreak =
    currentUserId && stats ? stats.streakByAuthor[currentUserId] ?? 0 : 0;

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* 본인 연속 인증 배너 */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1",
          myStreak >= 1
            ? "bg-gradient-to-br from-orange-500/15 to-rose-500/15 ring-orange-500/30"
            : "bg-gradient-to-br from-violet-500/10 to-cyan-500/10 ring-violet-500/20",
        )}
      >
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl",
            myStreak >= 1
              ? "bg-orange-500/20 text-orange-500"
              : "bg-violet-500/20 text-violet-500",
          )}
        >
          {myStreak >= 1 ? "🔥" : "📸"}
        </span>
        <div className="min-w-0 flex-1">
          {myStreak >= 1 ? (
            <>
              <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                {myStreak}일 연속 인증 중!
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                오늘도 인증샷 올리고 연속 기록 이어가세요.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                오늘 인증을 시작해보세요!
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                매일 인증샷을 올리면 연속 기록이 카운트됩니다.
              </p>
            </>
          )}
        </div>
      </div>

      {/* 주간 랭킹 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/[0.07] dark:bg-[#16162a]">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-500">
          <Trophy className="h-3.5 w-3.5" />
          이번 주 챌린지 TOP 5
        </div>
        {stats == null ? (
          <div className="flex items-center justify-center py-4 text-xs text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : stats.weeklyRanking.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-gray-400">
            아직 인증한 사람이 없어요. 1등을 차지해보세요!
          </p>
        ) : (
          <ol className="space-y-1.5">
            {stats.weeklyRanking.map((r, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
              return (
                <li
                  key={r.author_id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="grid w-6 shrink-0 place-items-center text-base">
                    {medal}
                  </span>
                  <span className="flex-1 truncate font-semibold text-gray-800 dark:text-gray-100">
                    {r.nickname}
                  </span>
                  <Badge role={r.role} className="text-[9px] py-0 px-1.5" />
                  <span className="shrink-0 tabular-nums text-gray-400">
                    {r.count}회
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── 챌린지 그리드 (인스타 스타일) ────────────────────────────
function ChallengeGrid({
  posts,
  streakByAuthor,
}: {
  posts: PostRow[];
  streakByAuthor: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {posts.map((post) => (
        <ChallengeCard
          key={post.id}
          post={post}
          streak={streakByAuthor[post.author_id] ?? 0}
        />
      ))}
    </div>
  );
}

function ChallengeCard({ post, streak }: { post: PostRow; streak: number }) {
  return (
    <Link
      href={`/board/challenge/${post.id}`}
      className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.04]"
    >
      {post.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-500 to-cyan-500 p-3 text-white">
          <Flame className="h-8 w-8 opacity-90" />
          <span className="line-clamp-3 text-center text-[11px] font-bold leading-tight">
            {post.title}
          </span>
        </div>
      )}

      {/* 연속일수 뱃지 (3일 이상) */}
      {streak >= 3 && (
        <span className="absolute left-2 top-2 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
          🔥 {streak}일
        </span>
      )}

      {/* 닉네임 + 날짜 오버레이 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 pb-2 pt-6">
        <p className="line-clamp-1 text-[11px] font-semibold text-white drop-shadow">
          {post.author?.nickname ?? "(알수없음)"}
        </p>
        <p className="text-[10px] text-white/80 drop-shadow">
          {relativeTime(post.created_at)}
        </p>
      </div>
    </Link>
  );
}

// ── 자유게시판 카드 + 좋아요 ────────────────────────────────
const POPULAR_LIKES_THRESHOLD = 5;

function FreeCards({
  posts,
  likedSet,
  onLike,
  likingId,
}: {
  posts: PostRow[];
  likedSet: Set<string>;
  onLike: (postId: string) => void;
  likingId: string | null;
}) {
  return (
    <ul className="grid gap-3">
      {posts.map((post) => (
        <FreeCard
          key={post.id}
          post={post}
          liked={likedSet.has(post.id)}
          onLike={onLike}
          loading={likingId === post.id}
        />
      ))}
    </ul>
  );
}

function FreeCard({
  post,
  liked,
  onLike,
  loading,
}: {
  post: PostRow;
  liked: boolean;
  onLike: (postId: string) => void;
  loading: boolean;
}) {
  const popular = post.like_count >= POPULAR_LIKES_THRESHOLD;
  const fresh = isNewPost(post.created_at);
  const preview = previewText(post.content, 140);

  return (
    <li>
      <div className="relative rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a]">
        <Link
          href={`/board/free/${post.id}`}
          className="flex items-start gap-3 p-4"
        >
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-lg object-cover sm:h-24 sm:w-24"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {popular && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
                  🔥 인기
                </span>
              )}
              {fresh && (
                <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
                  NEW
                </span>
              )}
            </div>

            <p className="mt-1 line-clamp-1 text-base font-extrabold text-gray-900 dark:text-white">
              {post.title}
            </p>
            {preview && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {preview}
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {post.author?.nickname ?? "(알수없음)"}
              </span>
              {post.author && (
                <Badge
                  role={post.author.role}
                  className="text-[9px] py-0 px-1.5"
                />
              )}
              <span className="text-gray-300">·</span>
              <span className="tabular-nums">
                {relativeTime(post.created_at)}
              </span>
              <span className="ml-auto flex items-center gap-2 text-gray-400">
                <span className="flex items-center gap-0.5">
                  <Eye className="h-3 w-3" />
                  {post.view_count}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="h-3 w-3" />
                  {post.comment_count}
                </span>
              </span>
            </div>
          </div>
        </Link>

        {/* 좋아요 버튼 — 카드 우하단 (Link 외부) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLike(post.id);
          }}
          disabled={loading || liked}
          aria-label={liked ? "이미 좋아요한 글" : "좋아요"}
          className={cn(
            "absolute bottom-3 right-3 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed",
            liked
              ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
              : "border-gray-200 bg-white text-gray-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300",
          )}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Heart
              className={cn("h-3.5 w-3.5", liked && "fill-current")}
              strokeWidth={2.2}
            />
          )}
          <span className="tabular-nums">{post.like_count.toLocaleString()}</span>
        </button>
      </div>
    </li>
  );
}
