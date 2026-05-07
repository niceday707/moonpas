"use client";

// 대시보드 — 실제 Supabase 데이터로 채워진 포탈 홈
//  · 모바일: 배너 → 문튜브 가로스크롤 → HOT 게시물 → 최신글 피드 (세로 1열)
//  · 데스크톱: 3컬럼 (왼쪽 HOT/공지/문튜브, 중앙 최신글, 오른쪽 프로필/검색/바로가기)

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Flame,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  MessageSquare,
  Heart,
  ExternalLink,
  GraduationCap,
  BookOpen,
  PlayCircle,
  ChevronRight,
  ArrowUp,
  Play,
  Pin,
} from "lucide-react";
import { BannerSlider } from "@/components/dashboard/BannerSlider";
import { NicknameSetupModal } from "@/components/dashboard/NicknameSetupModal";
import { Badge, type Role } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth, attemptGoogleLogin } from "@/lib/auth";
import {
  pickDisplayName,
  saveNickname,
  useSupabaseProfile,
} from "@/lib/supabase-profile";
import {
  BOARD_LABEL,
  getHotPosts,
  getLatestPosts,
  getUserStats,
  listPosts,
  parseYoutubeContent,
  youtubeThumbUrl,
  type BoardType,
  type PostRow,
  type UserStats,
} from "@/lib/board";

// ── 상수 ──────────────────────────────────────────────────

/** 게시판 뱃지 색상 — 최신 글 피드에서 board_type 표시용 */
const BOARD_BADGE_COLOR: Record<BoardType, string> = {
  free: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  notice: "text-red-600 bg-red-50 dark:bg-red-900/20",
  qa: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  debate: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  challenge: "text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20",
  market: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  lost: "text-rose-500 bg-rose-50 dark:bg-rose-900/20",
  study: "text-teal-500 bg-teal-50 dark:bg-teal-900/20",
  college: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  curriculum: "text-green-600 bg-green-50 dark:bg-green-900/20",
  council: "text-pink-500 bg-pink-50 dark:bg-pink-900/20",
  youtube: "text-red-500 bg-red-50 dark:bg-red-900/20",
  resources: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
  news: "text-amber-700 bg-amber-50 dark:bg-amber-900/20",
  alumni: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
  senior: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
};

/** 실시간 검색 — 정적 키워드 (실시간 분석은 추후 구현) */
const TRENDING = [
  { rank: 1, keyword: "중간고사", trend: "up" as const },
  { rank: 2, keyword: "체육대회", trend: "same" as const },
  { rank: 3, keyword: "급식 메뉴", trend: "up" as const },
  { rank: 4, keyword: "2028 대입", trend: "new" as const },
  { rank: 5, keyword: "수행평가", trend: "down" as const },
  { rank: 6, keyword: "야자 신청", trend: "up" as const },
  { rank: 7, keyword: "수학 30번", trend: "new" as const },
  { rank: 8, keyword: "물리학 공부법", trend: "down" as const },
  { rank: 9, keyword: "학부모 총회", trend: "same" as const },
  { rank: 10, keyword: "문튜브", trend: "up" as const },
];

const EXTERNAL_LINKS = [
  {
    label: "문태고등학교 홈페이지",
    desc: "공식 학교 홈페이지",
    href: "https://moontae.hs.jne.kr/moontae_hs/main.do",
    color: "bg-violet-600",
  },
  {
    label: "전라남도교육청",
    desc: "교육청 공식 사이트",
    href: "https://www.jne.go.kr",
    color: "bg-blue-600",
  },
  {
    label: "유튜브 · 문태고 학생자치회",
    desc: "공식 유튜브 채널",
    href: "https://www.youtube.com/@moontae_official",
    color: "bg-red-600",
  },
];

// ── 유틸 ──────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ── 공통 컴포넌트 ─────────────────────────────────────────

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  href,
  iconColor = "text-violet-600",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-white/[0.05]">
      <div
        className={`flex items-center gap-1.5 text-sm font-bold ${iconColor} dark:opacity-90`}
      >
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {href && (
        <Link
          href={href}
          className="text-[11px] text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
        >
          더보기 <ChevronRight className="inline h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

/** 빈 상태 — 섹션별 안내 + 게시판 이동 링크 */
function EmptyHint({
  message,
  href,
  ctaLabel,
}: {
  message: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="px-4 py-6 text-center">
      <p className="text-[11px] text-gray-400">{message}</p>
      <Link
        href={href}
        className="mt-2 inline-block text-[11px] font-semibold text-violet-500 transition-colors hover:text-violet-600 dark:text-violet-300"
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}

/** 스켈레톤 행 — 리스트 로딩용 */
function SkeletonRows({
  rows = 5,
  withMeta = false,
}: {
  rows?: number;
  withMeta?: boolean;
}) {
  return (
    <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-start gap-2.5 px-4 py-3">
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-white/[0.06]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-white/[0.06]" />
            {withMeta && (
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-white/[0.04]" />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── HOT 게시물 ────────────────────────────────────────────

function HotPostList({
  posts,
  loading,
  variant = "compact",
}: {
  posts: PostRow[];
  loading: boolean;
  variant?: "compact" | "full";
}) {
  if (loading) {
    return <SkeletonRows rows={5} withMeta={variant === "full"} />;
  }
  if (posts.length === 0) {
    return (
      <EmptyHint
        message="아직 인기 게시물이 없습니다"
        href="/board/free"
        ctaLabel="자유게시판으로 이동"
      />
    );
  }
  return (
    <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {posts.map((p, i) => (
        <li key={p.id}>
          <Link
            href={`/board/${p.board_type}/${p.id}`}
            className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
          >
            <span
              className={`mt-0.5 shrink-0 text-sm font-extrabold tabular-nums ${
                i === 0
                  ? "text-red-500"
                  : i === 1
                  ? "text-orange-400"
                  : i === 2
                  ? "text-amber-400"
                  : "text-gray-300 dark:text-gray-600"
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                {p.title}
              </p>
              {variant === "full" && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                  <span className="text-gray-500 dark:text-gray-300">
                    {p.author?.nickname ?? "(알수없음)"}
                  </span>
                  <span>·</span>
                  <span>{BOARD_LABEL[p.board_type]}</span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {formatShortDate(p.created_at)}
                  </span>
                </div>
              )}
            </div>
            <span className="mt-0.5 flex shrink-0 items-center gap-2 text-[10px]">
              <span className="flex items-center gap-0.5 text-red-400">
                <Heart className="h-2.5 w-2.5" />
                {p.like_count}
              </span>
              <span className="flex items-center gap-0.5 text-gray-400">
                <Eye className="h-2.5 w-2.5" />
                {p.view_count}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── 최신 공지 리스트 ──────────────────────────────────────

function NoticeList({
  posts,
  loading,
  max = 5,
}: {
  posts: PostRow[];
  loading: boolean;
  max?: number;
}) {
  if (loading) return <SkeletonRows rows={max} />;
  if (posts.length === 0) {
    return (
      <EmptyHint
        message="아직 공지가 없습니다"
        href="/board/notice"
        ctaLabel="공지사항으로 이동"
      />
    );
  }
  return (
    <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {posts.slice(0, max).map((n) => (
        <li key={n.id}>
          <Link
            href={`/board/notice/${n.id}`}
            className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
          >
            <span className="line-clamp-1 flex flex-1 items-center gap-1 text-xs text-gray-700 dark:text-gray-200">
              {n.is_pinned && (
                <Pin className="h-2.5 w-2.5 shrink-0 text-rose-500" />
              )}
              {n.title}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
              {formatShortDate(n.created_at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── 문튜브 ────────────────────────────────────────────────

type YoutubeItem = { postId: string; videoId: string; title: string };

/** 문튜브 카드 — 모바일/데스크톱 공용. width 는 부모에서 제어. */
function MoonTubeCard({ item }: { item: YoutubeItem }) {
  return (
    <Link
      href={`/board/youtube/${item.postId}`}
      className="group relative block overflow-hidden rounded-lg bg-black"
    >
      <div className="relative aspect-video w-full">
        {item.videoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={youtubeThumbUrl(item.videoId)}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
            <PlayCircle className="h-10 w-10 opacity-90" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-red-600/90 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </div>
        <p className="absolute inset-x-0 bottom-0 line-clamp-2 px-2.5 pb-2 text-[11px] font-semibold leading-snug text-white">
          {item.title}
        </p>
      </div>
    </Link>
  );
}

function MoonTubeSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-video w-full animate-pulse rounded-lg bg-gray-200 dark:bg-white/[0.06]"
        />
      ))}
    </div>
  );
}

/** 데스크톱 좌측 사이드 — 세로 1열 카드 3장 */
function MoonTubeAsideSection({
  videos,
  loading,
}: {
  videos: YoutubeItem[];
  loading: boolean;
}) {
  return (
    <Card>
      <SectionHead
        icon={PlayCircle}
        title="문튜브"
        href="/board/youtube"
        iconColor="text-red-500"
      />
      {loading ? (
        <MoonTubeSkeleton count={3} />
      ) : videos.length === 0 ? (
        <EmptyHint
          message="아직 등록된 영상이 없습니다"
          href="/board/youtube"
          ctaLabel="문튜브로 이동"
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-1">
          {videos.slice(0, 3).map((v) => (
            <MoonTubeCard key={v.postId} item={v} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** 모바일 전용 — 가로 스크롤 + snap (lg 이상에서는 숨김) */
function MoonTubeMobileScroll({
  videos,
  loading,
}: {
  videos: YoutubeItem[];
  loading: boolean;
}) {
  return (
    <div className="lg:hidden">
      <Card>
        <SectionHead
          icon={PlayCircle}
          title="문튜브"
          href="/board/youtube"
          iconColor="text-red-500"
        />
        {loading ? (
          <div className="flex gap-3 overflow-x-auto px-3 py-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="aspect-video w-[200px] shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-white/[0.06]"
              />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <EmptyHint
            message="아직 등록된 영상이 없습니다"
            href="/board/youtube"
            ctaLabel="문튜브로 이동"
          />
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {videos.map((v) => (
              <div
                key={v.postId}
                className="w-[200px] shrink-0 snap-start"
              >
                <MoonTubeCard item={v} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── 최신 글 피드 (전체 게시판 통합) ────────────────────────

function LatestFeedList({
  posts,
  loading,
}: {
  posts: PostRow[];
  loading: boolean;
}) {
  if (loading) return <SkeletonRows rows={8} withMeta />;
  if (posts.length === 0) {
    return (
      <EmptyHint
        message="아직 등록된 게시글이 없습니다"
        href="/board/free"
        ctaLabel="자유게시판으로 이동"
      />
    );
  }
  return (
    <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {posts.map((p) => (
        <li key={p.id}>
          <Link
            href={`/board/${p.board_type}/${p.id}`}
            className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] sm:gap-3"
          >
            {/* 게시판 뱃지 */}
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${BOARD_BADGE_COLOR[p.board_type]}`}
            >
              {BOARD_LABEL[p.board_type]}
            </span>

            {/* 제목 */}
            <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-gray-800 dark:text-gray-100">
              <span className="line-clamp-1 flex items-center gap-1">
                {p.is_pinned && (
                  <Pin className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                )}
                {p.title}
              </span>
            </span>

            {/* 댓글 */}
            {p.comment_count > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-violet-500">
                <MessageSquare className="h-3 w-3" />
                {p.comment_count}
              </span>
            )}

            {/* 작성자 */}
            <span className="hidden shrink-0 items-center gap-1 text-[11px] sm:flex">
              <span className="text-gray-600 dark:text-gray-300">
                {p.author?.nickname ?? "(알수없음)"}
              </span>
              {p.author && (
                <Badge role={p.author.role} className="text-[9px] py-0 px-1" />
              )}
            </span>

            {/* 날짜 */}
            <span className="hidden shrink-0 text-[11px] tabular-nums text-gray-400 md:block">
              {formatShortDate(p.created_at)}
            </span>

            {/* 조회수 */}
            <span className="hidden shrink-0 items-center gap-0.5 text-[11px] text-gray-400 lg:flex">
              <Eye className="h-3 w-3" />
              {p.view_count.toLocaleString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── 트렌드 / 로그인 / 프로필 ───────────────────────────────

function TrendIcon({ trend }: { trend: "up" | "down" | "same" | "new" }) {
  if (trend === "new")
    return <span className="text-[10px] font-bold text-red-500">NEW</span>;
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-red-500" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-blue-500" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

function GoogleLoginCard() {
  return (
    <Card>
      <SectionHead icon={ArrowUp} title="로그인" iconColor="text-violet-600" />
      <div className="flex flex-col gap-3 px-4 py-4">
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          학교 계정으로 로그인하면 글쓰기·댓글 등 모든 기능을 사용할 수 있어요.
        </p>
        <button
          type="button"
          onClick={attemptGoogleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-gray-100 dark:hover:bg-white/[0.07]"
        >
          <GoogleLogo className="h-4 w-4" />
          Google로 로그인
        </button>
      </div>
    </Card>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.5 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.4 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function ProfileCard({
  nickname,
  role,
  avatarUrl,
  stats,
  onSetupClick,
}: {
  nickname: string | null;
  role: Role | null;
  avatarUrl: string | null;
  stats: UserStats;
  onSetupClick?: () => void;
}) {
  const items: { v: number; l: string }[] = [
    { v: stats.posts, l: "쓴 글" },
    { v: stats.receivedLikes, l: "받은 좋아요" },
    { v: stats.comments, l: "쓴 댓글" },
  ];
  return (
    <Card>
      <SectionHead
        icon={ArrowUp}
        title="내 프로필"
        href="/profile"
        iconColor="text-cyan-500"
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <UserAvatar
            nickname={nickname}
            role={role}
            avatarUrl={avatarUrl}
            size="md"
          />
          <div className="flex flex-col items-start gap-1">
            {nickname ? (
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {nickname}
              </p>
            ) : (
              <button
                type="button"
                onClick={onSetupClick}
                className="rounded-md bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-violet-700"
              >
                닉네임 설정
              </button>
            )}
            {role && <Badge role={role} className="text-[10px]" />}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {items.map((s) => (
            <div
              key={s.l}
              className="rounded-lg bg-gray-50 py-1.5 dark:bg-white/[0.04]"
            >
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {s.v}
              </p>
              <p className="text-[10px] text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────

export default function DashboardPage() {
  const { isLoggedIn } = useAuth();
  const { user, profile, loading: profileLoading, refetch } =
    useSupabaseProfile();
  const [setupOpen, setSetupOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role | null>(null);
  const [stats, setStats] = useState<UserStats>({
    posts: 0,
    comments: 0,
    receivedLikes: 0,
  });

  // ── 실제 데이터 상태 ────────────────────────────────────
  const [hotPosts, setHotPosts] = useState<PostRow[]>([]);
  const [hotLoading, setHotLoading] = useState(true);

  const [noticePosts, setNoticePosts] = useState<PostRow[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(true);

  const [latestPosts, setLatestPosts] = useState<PostRow[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);

  const [youtubeItems, setYoutubeItems] = useState<YoutubeItem[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(true);

  // HOT
  useEffect(() => {
    let active = true;
    setHotLoading(true);
    getHotPosts(7, 5).then((rows) => {
      if (!active) return;
      setHotPosts(rows);
      setHotLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // 최신 공지 — board_type='notice', is_pinned 우선
  useEffect(() => {
    let active = true;
    setNoticeLoading(true);
    listPosts("notice", 1, { pinnedFirst: true }).then((res) => {
      if (!active) return;
      setNoticePosts(res.posts.slice(0, 5));
      setNoticeLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // 최신 글 피드 — 전체 게시판 통합 15개
  useEffect(() => {
    let active = true;
    setLatestLoading(true);
    getLatestPosts(15).then((rows) => {
      if (!active) return;
      setLatestPosts(rows);
      setLatestLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // 문튜브 — board_type='youtube' 최신 6개, content JSON 에서 videoId 추출
  useEffect(() => {
    let active = true;
    setYoutubeLoading(true);
    listPosts("youtube", 1).then((res) => {
      if (!active) return;
      const items: YoutubeItem[] = res.posts.slice(0, 6).map((p) => {
        const info = parseYoutubeContent(p.content);
        return { postId: p.id, videoId: info.videoId, title: p.title };
      });
      setYoutubeItems(items);
      setYoutubeLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // 사용자 통계
  useEffect(() => {
    if (!user || !profile) return;
    let active = true;
    getUserStats(user.id).then((s) => {
      if (active) setStats(s);
    });
    return () => {
      active = false;
    };
  }, [user, profile]);

  // 최초 로그인 — profiles row 없으면 닉네임 모달 자동 오픈
  useEffect(() => {
    if (!profileLoading && user && !profile) {
      if (typeof window !== "undefined") {
        const r = sessionStorage.getItem("inviteRole");
        if (r === "parent" || r === "alumni" || r === "student" || r === "teacher") {
          setInviteRole(r as Role);
        }
      }
      setSetupOpen(true);
    } else if (profile) {
      setSetupOpen(false);
    }
  }, [user, profile, profileLoading]);

  async function handleSubmitNickname(nickname: string, role: Role) {
    if (!user) {
      return { ok: false as const, message: "로그인이 필요합니다." };
    }
    const finalRole: Role = inviteRole ?? role;
    const { error } = await saveNickname(user.id, nickname, finalRole);
    if (error) {
      return {
        ok: false as const,
        message: "저장에 실패했어요. 잠시 후 다시 시도해주세요.",
      };
    }
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("inviteRole");
    }
    setInviteRole(null);
    await refetch();
    setSetupOpen(false);
    return { ok: true as const };
  }

  const displayNickname: string | null = profile?.nickname ?? null;
  const displayRole: Role | null = profile?.role ?? null;
  const displayAvatar: string | null = profile?.avatar_url ?? null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-xl px-4 py-4 md:px-6"
    >
      {/* 배너 슬라이더 */}
      <BannerSlider />

      {/* 모바일 전용 — 문튜브 가로 스크롤 (lg 이상에서는 좌측 사이드바에서 표시) */}
      <div className="mt-4">
        <MoonTubeMobileScroll videos={youtubeItems} loading={youtubeLoading} />
      </div>

      {/* ── 포탈 레이아웃: 모바일 1컬럼 → 태블릿 2컬럼 → 데스크톱 3컬럼 ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px] lg:grid-cols-[220px_1fr_200px]">
        {/* ── 왼쪽: HOT + 공지 + 문튜브 (lg 이상에서만 표시) ── */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <Card>
            <SectionHead
              icon={Flame}
              title="HOT 게시물"
              href="/board/free"
              iconColor="text-orange-500"
            />
            <HotPostList posts={hotPosts} loading={hotLoading} variant="full" />
          </Card>

          <Card>
            <SectionHead
              icon={Bell}
              title="최신 공지"
              href="/board/notice"
              iconColor="text-red-500"
            />
            <NoticeList posts={noticePosts} loading={noticeLoading} max={5} />
          </Card>

          <MoonTubeAsideSection videos={youtubeItems} loading={youtubeLoading} />
        </aside>

        {/* ── 중앙: HOT (태블릿 전용) + 최신글 피드 ── */}
        <section className="min-w-0 space-y-4">
          {/* 태블릿 전용 HOT 게시물 */}
          <div className="hidden md:block lg:hidden">
            <Card>
              <SectionHead
                icon={Flame}
                title="HOT 게시물"
                href="/board/free"
                iconColor="text-orange-500"
              />
              <HotPostList
                posts={hotPosts}
                loading={hotLoading}
                variant="full"
              />
            </Card>
          </div>

          {/* 모바일 전용 HOT 게시물 — 가로스크롤 다음 위치 */}
          <div className="md:hidden">
            <Card>
              <SectionHead
                icon={Flame}
                title="HOT 게시물"
                href="/board/free"
                iconColor="text-orange-500"
              />
              <HotPostList
                posts={hotPosts}
                loading={hotLoading}
                variant="compact"
              />
            </Card>
          </div>

          {/* 최신 글 피드 — 전체 게시판 통합 */}
          <Card>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-sm font-bold text-violet-600 dark:text-violet-400">
                <MessageSquare className="h-4 w-4" />
                최신 글
              </div>
              <Link
                href="/board/free"
                className="text-xs text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
              >
                전체보기 →
              </Link>
            </div>

            <LatestFeedList posts={latestPosts} loading={latestLoading} />

            {/* 하단 글쓰기 버튼 */}
            <div className="flex items-center justify-end border-t border-gray-100 px-4 py-3 dark:border-white/[0.05]">
              <Link
                href="/board/free/write"
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
              >
                글쓰기
              </Link>
            </div>
          </Card>
        </section>

        {/* ── 오른쪽: 프로필 + 검색순위 + 바로가기 ── */}
        <aside className="flex flex-col gap-4">
          {isLoggedIn ? (
            <ProfileCard
              nickname={displayNickname}
              role={displayRole}
              avatarUrl={displayAvatar}
              stats={stats}
              onSetupClick={() => setSetupOpen(true)}
            />
          ) : (
            <GoogleLoginCard />
          )}

          {/* 실시간 검색 순위 */}
          <Card>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-sm font-bold text-orange-500">
                <Flame className="h-4 w-4" />
                실시간 검색
              </div>
              <span className="text-[10px] text-gray-400">실시간 인기</span>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-white/[0.03]">
              {TRENDING.map((t) => (
                <li key={t.rank}>
                  <Link
                    href="/board/free"
                    className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                  >
                    <span
                      className={`w-4 shrink-0 text-center text-xs font-bold tabular-nums ${
                        t.rank <= 3 ? "text-red-500" : "text-gray-400"
                      }`}
                    >
                      {t.rank}
                    </span>
                    <span className="flex-1 text-xs text-gray-800 dark:text-gray-100">
                      {t.keyword}
                    </span>
                    <TrendIcon trend={t.trend} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {/* 태블릿 전용 최신 공지 */}
          <div className="hidden md:block lg:hidden">
            <Card>
              <SectionHead
                icon={Bell}
                title="최신 공지"
                href="/board/notice"
                iconColor="text-red-500"
              />
              <NoticeList posts={noticePosts} loading={noticeLoading} max={4} />
            </Card>
          </div>

          {/* 바로가기 */}
          <Card>
            <SectionHead
              icon={ChevronRight}
              title="바로가기"
              iconColor="text-gray-500"
            />
            <div className="grid grid-cols-2 gap-1.5 p-3">
              {[
                {
                  href: "/board/college",
                  label: "2028 대입",
                  icon: GraduationCap,
                  color:
                    "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
                },
                {
                  href: "/board/curriculum",
                  label: "과목 가이드",
                  icon: BookOpen,
                  color:
                    "text-green-600 bg-green-50 dark:bg-green-900/20",
                },
                {
                  href: "/board/youtube",
                  label: "문튜브",
                  icon: PlayCircle,
                  color: "text-red-500 bg-red-50 dark:bg-red-900/20",
                },
                {
                  href: "/board/notice",
                  label: "공지사항",
                  icon: Bell,
                  color:
                    "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg ${item.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </aside>
      </div>

      {/* 모바일 전용 — 최신 공지 (lg 이상은 좌측 사이드바, md는 오른쪽) */}
      <div className="mt-4 md:hidden">
        <Card>
          <SectionHead
            icon={Bell}
            title="최신 공지"
            href="/board/notice"
            iconColor="text-red-500"
          />
          <NoticeList posts={noticePosts} loading={noticeLoading} max={5} />
        </Card>
      </div>

      {/* ── 외부 링크 배너 ── */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {EXTERNAL_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[56px] items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition-shadow hover:shadow-md dark:border-white/[0.07] dark:bg-[#16162a]"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {link.label}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">{link.desc}</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
          </a>
        ))}
      </div>

      {/* ── 하단 피처 카드 3개 ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/board/college">
          <div className="group rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 transition-shadow hover:shadow-md dark:border-violet-900/30 dark:from-violet-900/10 dark:to-indigo-900/10">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <GraduationCap className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                2028 대입 정보
              </span>
            </div>
            <h3 className="mt-3 text-base font-extrabold leading-snug text-gray-900 dark:text-white">
              통합형 수능, 어떻게 달라지나요?
            </h3>
            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
              2028학년도 대입 개편안의 핵심 변경 사항과 학년별 대응 전략
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["통합사회·과학", "고교학점제", "심화수학"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </Link>

        <Link href="/board/curriculum">
          <div className="group rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-5 transition-shadow hover:shadow-md dark:border-green-900/30 dark:from-green-900/10 dark:to-emerald-900/10">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <BookOpen className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                교육과정 가이드
              </span>
            </div>
            <h3 className="mt-3 text-base font-extrabold leading-snug text-gray-900 dark:text-white">
              선택과목, 어떻게 고를까요?
            </h3>
            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
              진로별 추천 과목 조합과 선배들의 생생한 선택 후기
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["과목 추천", "선배 후기", "진로 연계"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </Link>

        <Link href="/board/youtube">
          <div className="group rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-5 transition-shadow hover:shadow-md dark:border-red-900/30 dark:from-red-900/10 dark:to-rose-900/10">
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
              <PlayCircle className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                문튜브
              </span>
            </div>
            <h3 className="mt-3 text-base font-extrabold leading-snug text-gray-900 dark:text-white">
              진로·입시 유튜브 큐레이션
            </h3>
            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
              문태고 학생에게 꼭 필요한 영상만 골라 모았어요
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["진로진학", "동기부여", "학습법"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </Link>
      </div>

      {/* 푸터 */}
      <div className="mt-8 border-t border-gray-100 pb-4 pt-4 text-center text-[11px] text-gray-400 dark:border-white/[0.05]">
        문파스 MoonPas · 문태고등학교 커뮤니티 · 함께 나누고, 함께 성장하는 공간
      </div>

      {/* 닉네임 최초 설정 모달 */}
      <NicknameSetupModal
        open={setupOpen}
        defaultNickname={pickDisplayName(user)}
        defaultRole={inviteRole ?? "student"}
        roleLocked={!!inviteRole}
        onSubmit={handleSubmitNickname}
      />
    </motion.div>
  );
}
