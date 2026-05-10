"use client";

// 대시보드 — 실제 Supabase 데이터로 채워진 포탈 홈
//
// 반응형 3-tier 레이아웃:
//  · 모바일 (md 미만): 1컬럼 세로 스택
//      급식 → 배너 → 문튜브 → 최신글 → 프로필/로그인 → 실시간검색 → HOT → 공지
//  · 태블릿 (md ~ lg 미만): 배너(전체 너비) → 그 아래 2단 (가운데 flex-1 | 우측 280px)
//      가운데: 급식 → 학사일정 → 다음시험 → 문튜브 → 최신글
//      우측 : 프로필/로그인 → 실시간 검색어 → 최신 공지 → 인기글
//  · 데스크톱 (lg 이상): 배너(전체 너비) → 그 아래 3단 (좌측 280px | 가운데 flex-1 | 우측 300px)
//      좌측 : 급식 → 학사일정 → 다음시험
//      가운데: 문튜브 → 최신글
//      우측 : 프로필/로그인 → 실시간 검색어 → 최신 공지 → 인기글
//
// 배너는 모바일에선 1컬럼 안에 인라인으로, md+ 에선 max-w-screen-xl 컨테이너 폭을 그대로 차지하는
// 전체 너비 슬라이더로 노출된다. 중복 렌더 방지를 위해 모바일은 `md:hidden`, md+ 는 `hidden md:flex`
// 래퍼로 분리되어 두 영역 중 한쪽에서만 BannerSlider 가 마운트된다.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Flame,
  Bell,
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
import { BirthdayCelebration } from "@/components/dashboard/BirthdayCelebration";
import { BirthdayWidget } from "@/components/dashboard/BirthdayWidget";
import { ExamWidget } from "@/components/dashboard/ExamWidget";
import { NicknameSetupModal } from "@/components/dashboard/NicknameSetupModal";
import { PushNotificationBanner } from "@/components/dashboard/PushNotificationBanner";
import { NicknameButton } from "@/components/profile/NicknameButton";
// DdayCard 는 일시 비활성화 — 추후 관리자 기능과 연동 후 다시 노출 예정.
// 컴포넌트 파일(@/components/DdayCard) 자체는 그대로 유지한다.
import { MealCard } from "@/components/MealCard";
import { SchoolCalendar } from "@/components/SchoolCalendar";
import { Badge, type Role } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth, attemptGoogleLogin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  createInitialProfile,
  pickDisplayName,
  useSupabaseProfile,
} from "@/lib/supabase-profile";
import {
  BOARD_LABEL,
  getHotPosts,
  getLatestPosts,
  getUserStats,
  listPosts,
  parseYoutubeContent,
  postDetailHref,
  youtubeThumbUrl,
  type BoardType,
  type PostRow,
  type UserStats,
} from "@/lib/board";
import {
  displayAuthorNameFor,
  shouldShowAuthorBadgeFor,
} from "@/lib/author-display";
import {
  SCHOOL_NOTICE_SOURCE_META,
  type SchoolNoticeSource,
} from "@/lib/schoolNotices";
import {
  ALLOWED_DOMAIN,
  ALLOWED_STUDENT_PREFIXES,
} from "@/lib/auth-const";
import { cn } from "@/lib/utils";

// ── 역할 자동 결정 ─────────────────────────────────────────
// 사용자가 직접 역할을 고를 수 없도록 — 이메일 기반으로 자동 부여한다.
//   · mt24/mt25/mt26 + @moontae.hs.jne.kr → student (재학생)
//   · mt 로 시작하지 않는 + @moontae.hs.jne.kr → teacher (교사)
//   · 그 외 → student (안전 기본값. 실제로 도달하면 callback 단에서 이미 차단됨)
//   · 초대 코드 가입은 이 함수를 거치지 않고 consume_invite_code RPC 가 서버에서 강제한다.
function deriveRoleFromEmail(email: string | null | undefined): Role {
  if (!email) return "student";
  const at = email.indexOf("@");
  if (at < 0) return "student";
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  if (domain !== ALLOWED_DOMAIN) return "student";
  if (ALLOWED_STUDENT_PREFIXES.some((p) => local.startsWith(p))) return "student";
  if (!local.startsWith("mt")) return "teacher";
  return "student";
}

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
  alumni_news: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  senior: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  event_member: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  event_find: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  event_praise: "text-pink-500 bg-pink-50 dark:bg-pink-900/20",
  event_study: "text-teal-500 bg-teal-50 dark:bg-teal-900/20",
  event_quiz: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  guess_who: "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/20",
  anonymous: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
};

/** 실시간 검색 — 첫 페인트용 시드 데이터.
 *  /api/trending 응답이 도착하기 전 깜빡임을 막고, 호출 실패 시 폴백으로도 사용.
 *  shape 는 /api/trending 응답과 동일. */
type TrendChange = "up" | "down" | "same" | "new";
type TrendingItem = {
  rank: number;
  keyword: string;
  count: number;
  isNew: boolean;
  change: TrendChange;
};

// 사용자 지정 — 서버 fallback 과 동일한 10개. 서버가 곧 같은 응답을 돌려주므로 깜빡임 없음.
const TRENDING_SEED: TrendingItem[] = [
  { rank: 1, keyword: "체육한마당", count: 0, isNew: false, change: "same" },
  { rank: 2, keyword: "문튜브", count: 0, isNew: false, change: "same" },
  { rank: 3, keyword: "생기부 세특", count: 0, isNew: false, change: "same" },
  { rank: 4, keyword: "급식 꿀조합", count: 0, isNew: false, change: "same" },
  { rank: 5, keyword: "야자 빠지는 법", count: 0, isNew: false, change: "same" },
  { rank: 6, keyword: "수행평가 일정", count: 0, isNew: false, change: "same" },
  { rank: 7, keyword: "문태 축제", count: 0, isNew: false, change: "same" },
  { rank: 8, keyword: "점심시간 맛집", count: 0, isNew: false, change: "same" },
  { rank: 9, keyword: "대입 수시 전략", count: 0, isNew: false, change: "same" },
  { rank: 10, keyword: "쉬는시간 노래추천", count: 0, isNew: false, change: "same" },
];

const TRENDING_REFRESH_MS = 60 * 1000; // 60초 — 네이버 실검 톤

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
            href={postDetailHref(p.board_type, p.id)}
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
                    {displayAuthorNameFor({
                      boardType: p.board_type,
                      author: p.author,
                    })}
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

// ── 최신 공지 리스트 (학교 크롤링 + 문파스공지 합산) ─────

/**
 * 대시보드 좌측 카드용 통합 공지 항목.
 *   - kind="moonpas" : board_type='notice' 의 PostRow → /board/notice/{id} 내부 링크
 *   - kind="school"  : school_notices 행 → 문태고 홈페이지 새 탭
 */
type UnifiedNotice =
  | {
      kind: "moonpas";
      id: string;
      title: string;
      sortKey: string; // ISO timestamp
      pinned: boolean;
      href: string;
    }
  | {
      kind: "school";
      id: string;
      source: SchoolNoticeSource;
      title: string;
      sortKey: string;
      href: string; // 외부 원문 URL
    };

const SOURCE_BADGE: Record<
  "moonpas" | SchoolNoticeSource,
  { emoji: string; label: string; cls: string }
> = {
  moonpas: {
    emoji: "📢",
    label: "문파스공지",
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  school: {
    emoji: SCHOOL_NOTICE_SOURCE_META.school.emoji,
    label: SCHOOL_NOTICE_SOURCE_META.school.label,
    cls: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  news: {
    emoji: SCHOOL_NOTICE_SOURCE_META.news.emoji,
    label: SCHOOL_NOTICE_SOURCE_META.news.label,
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  letter: {
    emoji: SCHOOL_NOTICE_SOURCE_META.letter.emoji,
    label: SCHOOL_NOTICE_SOURCE_META.letter.label,
    cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  gallery: {
    emoji: SCHOOL_NOTICE_SOURCE_META.gallery.emoji,
    label: SCHOOL_NOTICE_SOURCE_META.gallery.label,
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
};

function NoticeList({
  notices,
  loading,
  max = 5,
}: {
  notices: UnifiedNotice[];
  loading: boolean;
  max?: number;
}) {
  if (loading) return <SkeletonRows rows={max} />;
  if (notices.length === 0) {
    return (
      <EmptyHint
        message="아직 공지가 없습니다"
        href="/notices/school"
        ctaLabel="학교공지로 이동"
      />
    );
  }
  return (
    <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {notices.slice(0, max).map((n) => {
        const badge =
          n.kind === "moonpas" ? SOURCE_BADGE.moonpas : SOURCE_BADGE[n.source];
        const isExternal = n.kind === "school";

        const inner = (
          <>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                  badge.cls,
                )}
              >
                <span aria-hidden>{badge.emoji}</span>
                <span>{badge.label}</span>
              </span>
              {n.kind === "moonpas" && n.pinned && (
                <Pin className="h-2.5 w-2.5 shrink-0 text-rose-500" />
              )}
              <span className="line-clamp-1">{n.title}</span>
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
              {formatShortDate(n.sortKey)}
            </span>
          </>
        );

        return (
          <li key={`${n.kind}:${n.id}`}>
            {isExternal ? (
              <a
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                {inner}
              </a>
            ) : (
              <Link
                href={n.href}
                className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── 문튜브 ────────────────────────────────────────────────

type YoutubeItem = { postId: string; videoId: string; title: string };

/** 문튜브 카드 — 썸네일(aspect-video) + 아래에 제목 2줄 line-clamp. 가로 스크롤 strip 전용. */
function MoonTubeCard({ item }: { item: YoutubeItem }) {
  return (
    <Link href={`/board/youtube/${item.postId}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
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
        {/* 재생 버튼 오버레이 */}
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-red-600/90 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </div>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-gray-800 dark:text-gray-100">
        {item.title}
      </p>
    </Link>
  );
}

/**
 * 문튜브 가로 스크롤 strip — PC/모바일 공용, 전체 폭.
 * - 카드 너비: 모바일 200px, sm 220px, lg 240px (사용자 spec 200~240px 범위)
 * - scroll-snap-type: x mandatory + scrollbar 숨김
 * - 더보기 링크는 SectionHead 우측에 노출
 */
function MoonTubeStrip({
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
        <div className="flex gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-[200px] shrink-0 sm:w-[220px] lg:w-[240px]"
            >
              <div className="aspect-video animate-pulse rounded-lg bg-gray-200 dark:bg-white/[0.06]" />
              <div className="mt-1.5 h-3 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-white/[0.06]" />
            </div>
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
              className="w-[200px] shrink-0 snap-start sm:w-[220px] lg:w-[240px]"
            >
              <MoonTubeCard item={v} />
            </div>
          ))}
        </div>
      )}
    </Card>
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
            href={postDetailHref(p.board_type, p.id)}
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

            {/* 조회수 — 모바일 포함 항상 표시 (PC 의 별도 슬롯은 아래 lg 영역) */}
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-gray-400 lg:hidden">
              <Eye className="h-3 w-3" />
              {p.view_count.toLocaleString()}
            </span>

            {/* 작성자 — 익명 게시판은 무조건 "익명", 배지/아이덴티티 노출 금지 */}
            <span className="hidden shrink-0 items-center gap-1 text-[11px] sm:flex">
              <NicknameButton
                userId={p.author?.id ?? null}
                className="text-gray-600 dark:text-gray-300"
              >
                {displayAuthorNameFor({
                  boardType: p.board_type,
                  author: p.author,
                })}
              </NicknameButton>
              {shouldShowAuthorBadgeFor(p.board_type) && p.author && (
                <Badge role={p.author.role} className="text-[9px] py-0 px-1" />
              )}
            </span>

            {/* 날짜 */}
            <span className="hidden shrink-0 text-[11px] tabular-nums text-gray-400 md:block">
              {formatShortDate(p.created_at)}
            </span>

            {/* 조회수 — PC 슬롯 */}
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

/** 순위 변동 표시 — 네이버 실검 스타일. NEW 는 보라 뱃지, 그 외는 ▲ ▼ - 텍스트 마커. */
function ChangeIndicator({ item }: { item: TrendingItem }) {
  if (item.isNew || item.change === "new") {
    return (
      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
        NEW
      </span>
    );
  }
  if (item.change === "up") {
    return (
      <span className="text-[10px] font-bold leading-none text-red-500">
        ▲
      </span>
    );
  }
  if (item.change === "down") {
    return (
      <span className="text-[10px] font-bold leading-none text-blue-500">
        ▼
      </span>
    );
  }
  return <span className="text-[10px] leading-none text-gray-400">-</span>;
}

// ── 모바일·PC 공용으로 재사용되는 작은 카드들 ──────────────

function TrendingSearchCard() {
  // /api/trending 으로부터 라이브 데이터를 받아 60초마다 갱신.
  // 첫 페인트는 SEED 로 보여주고, fetch 결과가 오면 부드럽게 교체 (스켈레톤 깜빡임 방지).
  const [items, setItems] = useState<TrendingItem[]>(TRENDING_SEED);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/trending", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { items?: TrendingItem[] };
        if (!active || !Array.isArray(json.items) || json.items.length === 0) return;
        setItems(json.items);
        setUpdatedAt(new Date());
      } catch {
        // 네트워크 에러 — SEED 그대로 유지
      }
    };
    void load();
    const id = setInterval(load, TRENDING_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-white/[0.05]">
        <div className="flex items-center gap-1.5 text-sm font-bold text-orange-500">
          <Flame className="h-4 w-4" />
          실시간 검색
        </div>
        <span className="text-[10px] text-gray-400">
          {updatedAt
            ? `${String(updatedAt.getHours()).padStart(2, "0")}:${String(
                updatedAt.getMinutes(),
              ).padStart(2, "0")} 기준`
            : "실시간 인기"}
        </span>
      </div>
      <ul className="divide-y divide-gray-50 dark:divide-white/[0.03]">
        {items.map((t) => {
          const isTop3 = t.rank <= 3;
          return (
            <li key={`${t.rank}-${t.keyword}`}>
              <Link
                href={`/search?q=${encodeURIComponent(t.keyword)}`}
                className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <span
                  className={`w-4 shrink-0 text-center text-xs font-extrabold tabular-nums ${
                    t.rank === 1
                      ? "text-red-500"
                      : t.rank === 2
                        ? "text-orange-500"
                        : t.rank === 3
                          ? "text-amber-500"
                          : "text-gray-400"
                  }`}
                >
                  {t.rank}
                </span>
                <span
                  className={`flex-1 truncate text-xs text-gray-800 dark:text-gray-100 ${
                    isTop3 ? "font-bold" : "font-medium"
                  }`}
                >
                  {t.keyword}
                </span>
                {t.count > 0 && (
                  <span className="shrink-0 text-[9.5px] tabular-nums text-gray-400">
                    {t.count.toLocaleString()}
                  </span>
                )}
                <ChangeIndicator item={t} />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
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
  const items: { v: number; l: string; href: string }[] = [
    { v: stats.posts, l: "쓴 글", href: "/profile?tab=posts" },
    { v: stats.receivedLikes, l: "좋아요", href: "/profile" },
    { v: stats.comments, l: "쓴 댓글", href: "/profile?tab=comments" },
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
              <Link
                href="/profile"
                className="text-sm font-bold text-gray-900 hover:underline dark:text-white"
              >
                {nickname}
              </Link>
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
            <Link
              key={s.l}
              href={s.href}
              className="rounded-lg bg-gray-50 py-1.5 transition-colors hover:bg-gray-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {s.v}
              </p>
              <p className="text-[10px] text-gray-500">{s.l}</p>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── 카드 래퍼 — 3단 레이아웃 곳곳에서 재사용 ────────────────

/** 최신 글 카드 — 헤더 + 리스트 + 글쓰기 버튼 푸터를 묶은 단일 카드 */
function LatestFeedCard({
  posts,
  loading,
}: {
  posts: PostRow[];
  loading: boolean;
}) {
  return (
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
      <LatestFeedList posts={posts} loading={loading} />
      <div className="flex items-center justify-end border-t border-gray-100 px-4 py-3 dark:border-white/[0.05]">
        <Link
          href="/board/free/write"
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
        >
          글쓰기
        </Link>
      </div>
    </Card>
  );
}

/** HOT 게시물 카드 */
function HotPostsCard({
  posts,
  loading,
}: {
  posts: PostRow[];
  loading: boolean;
}) {
  return (
    <Card>
      <SectionHead
        icon={Flame}
        title="HOT 게시물"
        href="/board/free"
        iconColor="text-orange-500"
      />
      <HotPostList posts={posts} loading={loading} variant="compact" />
    </Card>
  );
}

/** 최신 공지 카드 — 학교 크롤링 3종 + 문파스공지(board_type=notice) 합산 */
function NoticesCard({
  notices,
  loading,
}: {
  notices: UnifiedNotice[];
  loading: boolean;
}) {
  return (
    <Card>
      <SectionHead
        icon={Bell}
        title="최신 공지"
        href="/notices/school"
        iconColor="text-red-500"
      />
      <NoticeList notices={notices} loading={loading} max={5} />
    </Card>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────

export default function DashboardPage() {
  const { isLoggedIn } = useAuth();
  const {
    user,
    profile,
    error: profileError,
    loading: profileLoading,
    refetch,
  } = useSupabaseProfile();
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

  const [unifiedNotices, setUnifiedNotices] = useState<UnifiedNotice[]>([]);
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

  // 최신 공지 — 학교 홈페이지 크롤링 3종 + 문파스공지(board_type=notice) 합산.
  // 둘 중 한쪽이 실패해도 다른 쪽은 정상 노출.
  useEffect(() => {
    let active = true;
    setNoticeLoading(true);

    type SchoolRow = {
      id: string;
      source: SchoolNoticeSource;
      title: string;
      date: string;
      original_url: string;
    };

    const fetchSchool = fetch("/api/school-notices?limit=10")
      .then((r) => r.json())
      .then((j: { ok?: boolean; items?: SchoolRow[] }) =>
        j.ok && j.items ? j.items : [],
      )
      .catch(() => [] as SchoolRow[]);

    const fetchMoonpas = listPosts("notice", 1, { pinnedFirst: true }).then(
      (res) => res.posts.slice(0, 10),
    );

    Promise.all([fetchSchool, fetchMoonpas]).then(([schoolRows, moonpasRows]) => {
      if (!active) return;

      const merged: UnifiedNotice[] = [
        ...schoolRows.map<UnifiedNotice>((r) => ({
          kind: "school",
          id: r.id,
          source: r.source,
          title: r.title,
          // 학교공지는 date(YYYY-MM-DD) — 시간 정보 없으니 자정 기준
          sortKey: `${r.date}T00:00:00+09:00`,
          href: r.original_url,
        })),
        ...moonpasRows.map<UnifiedNotice>((p) => ({
          kind: "moonpas",
          id: p.id,
          title: p.title,
          sortKey: p.created_at,
          pinned: p.is_pinned,
          href: `/board/notice/${p.id}`,
        })),
      ];

      // 고정글 우선 → 그 다음 날짜 내림차순. 학교공지엔 pinned 개념이 없어 false 로 간주.
      merged.sort((a, b) => {
        const ap = a.kind === "moonpas" && a.pinned ? 1 : 0;
        const bp = b.kind === "moonpas" && b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return b.sortKey.localeCompare(a.sortKey);
      });

      setUnifiedNotices(merged.slice(0, 5));
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

  // 최초 로그인 — profiles row 없으면 닉네임 모달 자동 오픈.
  // ⚠️ profileError 가 있으면(네트워크/RLS 에러) 절대 모달을 열지 않는다.
  // fetch 실패를 "신규 가입" 으로 오인하면 createInitialProfile 이 호출되며
  // 기존 row 가 있어도 23505 로 막히긴 하지만, 사용자에게 잘못된 모달을 보여주는 자체가 혼란.
  useEffect(() => {
    if (!profileLoading && user && !profile && !profileError) {
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
  }, [user, profile, profileError, profileLoading]);

  async function handleSubmitNickname(nickname: string) {
    if (!user) {
      return { ok: false as const, message: "로그인이 필요합니다." };
    }

    // 초대 코드 흐름 — sessionStorage 에 코드가 있으면 consume_invite_code RPC 로
    // 코드 소비 + 프로필 생성을 한 번에 처리. 역할은 서버가 코드의 role 로 강제한다
    // (클라이언트가 sessionStorage 의 inviteRole 을 변조해도 무력화됨).
    const inviteCode =
      typeof window !== "undefined"
        ? sessionStorage.getItem("inviteCode")?.toLowerCase() ?? null
        : null;

    if (inviteCode) {
      const { data, error } = await supabase.rpc("consume_invite_code", {
        p_code: inviteCode,
        p_nickname: nickname,
      });
      if (error) {
        console.error("[dashboard] consume_invite_code 실패", error);
        return {
          ok: false as const,
          message: "저장에 실패했어요. 잠시 후 다시 시도해주세요.",
        };
      }
      const result = data as
        | { ok: true; role: string }
        | {
            ok: false;
            reason:
              | "unauthorized"
              | "invalid_nickname"
              | "profile_exists"
              | "nickname_taken"
              | "invalid_or_used"
              | "conflict";
          };
      if (!result?.ok) {
        if (result?.reason === "nickname_taken") {
          return {
            ok: false as const,
            message: "이미 사용 중인 닉네임이에요.",
          };
        }
        if (result?.reason === "invalid_or_used") {
          // 사용 불가/만료된 코드 — sessionStorage 정리하고 로그인으로 되돌림
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("inviteCode");
            sessionStorage.removeItem("inviteRole");
          }
          return {
            ok: false as const,
            message:
              "초대 코드가 더 이상 유효하지 않습니다. 다시 로그인해주세요.",
          };
        }
        if (result?.reason === "profile_exists") {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("inviteCode");
            sessionStorage.removeItem("inviteRole");
          }
          await refetch();
          setSetupOpen(false);
          return {
            ok: false as const,
            message:
              "이미 등록된 프로필이 있어요. 잠시 후 새로고침하면 정상으로 보여요.",
          };
        }
        return {
          ok: false as const,
          message: "저장에 실패했어요. 잠시 후 다시 시도해주세요.",
        };
      }

      // 성공 — sessionStorage 정리
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("inviteCode");
        sessionStorage.removeItem("inviteRole");
      }
      setInviteRole(null);
      await refetch();
      setSetupOpen(false);
      return { ok: true as const };
    }

    // 일반 가입 (학교 도메인 Google 계정) — 역할은 이메일 기반으로 자동 결정.
    // 사용자가 모달에서 역할을 고를 수 없으므로 클라이언트가 변조할 수 없다.
    const finalRole: Role = inviteRole ?? deriveRoleFromEmail(user.email);
    // INSERT-only — 이미 row 가 있으면 23505 로 거부되어 nickname/role 덮어쓰기를 차단한다.
    const { error, alreadyExists } = await createInitialProfile(
      user.id,
      nickname,
      finalRole,
    );
    if (alreadyExists) {
      // 이전 fetch 가 실패했거나 race condition 으로 모달이 열린 경우.
      // 기존 프로필을 다시 불러와서 모달을 닫고 정상 화면으로 복귀시킨다.
      await refetch();
      setSetupOpen(false);
      return {
        ok: false as const,
        message:
          "이미 등록된 프로필이 있어요. 잠시 후 새로고침하면 정상으로 보여요.",
      };
    }
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

  // 학번+이름 형태("2621주윤")가 닉네임으로 들어 있어도 프로필 카드에는 노출하지 않음
  const rawNick = profile?.nickname?.trim() ?? null;
  const safeNick =
    rawNick && !/^\d{3,6}[가-힣]{2,4}$/.test(rawNick) ? rawNick : null;
  const displayNickname: string | null = safeNick;
  const displayRole: Role | null = profile?.role ?? null;
  const displayAvatar: string | null = profile?.avatar_url ?? null;

  // 우측 사이드바(혹은 모바일 1컬럼 후반부)에 들어갈 항목들 — 3단/2단/1단 모두 동일 순서.
  // 프로필/로그인 카드는 mount 상태에 따라 분기되므로 인라인으로 처리.
  const profileOrLogin = isLoggedIn ? (
    <ProfileCard
      nickname={displayNickname}
      role={displayRole}
      avatarUrl={displayAvatar}
      stats={stats}
      onSetupClick={() => setSetupOpen(true)}
    />
  ) : (
    <GoogleLoginCard />
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-xl px-4 py-4 md:px-6"
    >
      {/* 푸시 알림 권한 배너 — 로그인 사용자에게만 표시 */}
      {isLoggedIn && user && <PushNotificationBanner userId={user.id} />}

      {/* 본인 생일 당일 1회 — confetti + 오버레이 */}
      {profile && (
        <BirthdayCelebration
          birthMonth={profile.birth_month}
          birthDay={profile.birth_day}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          모바일 (md 미만): 1단 세로 스택
          순서: 급식 → 배너 → 문튜브 → 최신 글 → 프로필/로그인 →
                실시간검색 → HOT → 공지
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:hidden">
        <MealCard />
        <BirthdayWidget />
        <SchoolCalendar />
        <ExamWidget />
        <BannerSlider />
        <MoonTubeStrip videos={youtubeItems} loading={youtubeLoading} />
        <LatestFeedCard posts={latestPosts} loading={latestLoading} />
        {profileOrLogin}
        <TrendingSearchCard />
        <HotPostsCard posts={hotPosts} loading={hotLoading} />
        <NoticesCard notices={unifiedNotices} loading={noticeLoading} />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          md+ 전용 래퍼 — 배너(전체 너비, max-w-screen-xl) + 그 아래 2단 또는 3단 레이아웃.
          flex-col + gap-4 가 배너와 하위 컬럼 블록 사이의 세로 간격을 자동 처리한다.
          (디스플레이가 none 인 형제는 flex 자식이 아니므로 gap 도 적용되지 않음.)
          ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:flex-col md:gap-4">
        {/* 배너 — md+ 에서 3단/2단 컬럼 위로 빠진 전체 너비 슬라이더 */}
        <BannerSlider />

        {/* 태블릿 (md ~ lg 미만): 2단 — 가운데(flex-1) | 우측(280px)
            급식은 가운데 컬럼 상단에 배치. */}
        <div className="flex gap-5 lg:hidden">
          {/* 가운데 메인 — 최신 공지는 우측 사이드바에서 단독 노출 */}
          <main className="flex min-w-0 flex-1 flex-col gap-4">
            <MealCard />
            <BirthdayWidget />
            <SchoolCalendar />
            <ExamWidget />
            <MoonTubeStrip videos={youtubeItems} loading={youtubeLoading} />
            <LatestFeedCard posts={latestPosts} loading={latestLoading} />
          </main>

          {/* 우측 사이드바 — 280px 고정. 최종 순서: 프로필/로그인 → 실시간 검색어 → 최신 공지 → 인기글 */}
          <aside className="flex w-[280px] shrink-0 flex-col gap-4">
            {profileOrLogin}
            <TrendingSearchCard />
            <NoticesCard notices={unifiedNotices} loading={noticeLoading} />
            <HotPostsCard posts={hotPosts} loading={hotLoading} />
          </aside>
        </div>

        {/* 데스크톱 (lg+): 3단 — 좌측(280px, 급식·학사일정·다음시험) | 가운데(flex-1, 문튜브·최신글) | 우측(300px) */}
        <div className="hidden lg:flex lg:gap-5">
          {/* 좌측 사이드바 — 280px 고정, lg 부터 노출. 순서: 급식 → 학사일정 → 다음 시험 */}
          <aside className="flex w-[280px] shrink-0 flex-col gap-4">
            <MealCard />
            <BirthdayWidget />
            <SchoolCalendar />
            <ExamWidget />
          </aside>

          {/* 가운데 메인 — 배너는 위로 빠졌으므로 문튜브 → 최신글 순서 */}
          <main className="flex min-w-0 flex-1 flex-col gap-4">
            <MoonTubeStrip videos={youtubeItems} loading={youtubeLoading} />
            <LatestFeedCard posts={latestPosts} loading={latestLoading} />
          </main>

          {/* 우측 사이드바 — 300px 고정. 최종 순서: 프로필/로그인 → 실시간 검색어 → 최신 공지 → 인기글 */}
          <aside className="flex w-[300px] shrink-0 flex-col gap-4">
            {profileOrLogin}
            <TrendingSearchCard />
            <NoticesCard notices={unifiedNotices} loading={noticeLoading} />
            <HotPostsCard posts={hotPosts} loading={hotLoading} />
          </aside>
        </div>
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

      {/* 닉네임 최초 설정 모달 — 역할은 이메일/초대코드 기반으로 자동 부여 */}
      <NicknameSetupModal
        open={setupOpen}
        defaultNickname={pickDisplayName(user)}
        onSubmit={handleSubmitNickname}
      />
    </motion.div>
  );
}
