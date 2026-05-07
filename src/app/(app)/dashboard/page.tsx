"use client";

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
} from "lucide-react";
import { BannerSlider } from "@/components/dashboard/BannerSlider";
import { NicknameSetupModal } from "@/components/dashboard/NicknameSetupModal";
import { Badge, type Role } from "@/components/ui/Badge";
import { useAuth, attemptGoogleLogin } from "@/lib/auth";
import {
  pickDisplayName,
  saveNickname,
  useSupabaseProfile,
} from "@/lib/supabase-profile";
import {
  BOARD_LABEL,
  getHotPosts,
  getUserStats,
  type PostRow,
  type UserStats,
} from "@/lib/board";

// ── 대시보드 문튜브 미리보기 영상 ─────────────────────────────────
// 영상 ID 는 더미 — 실제 영상으로 교체하세요.
const DASHBOARD_YOUTUBE = [
  { id: "dQw4w9WgXcQ", title: "2028 대입 완벽 정리 - 달라지는 수능과 내신" },
  { id: "dQw4w9WgXcQ", title: "서울대 합격생이 말하는 고등학교 공부법" },
  { id: "dQw4w9WgXcQ", title: "내신 5등급제 완벽 분석" },
];

// ── 목 데이터 (TODO: 점진적으로 실제 데이터로 교체) ──────────────────
// HOT 게시물은 dashboard 컴포넌트에서 useEffect 로 Supabase 에서 직접 조회한다.

const NOTICES = [
  { id: 1, title: "2학기 중간고사 일정 안내", date: "05.07" },
  { id: 2, title: "학부모 총회 개최 안내", date: "05.06" },
  { id: 3, title: "2025학년도 수련회 일정 공고", date: "05.05" },
  { id: 4, title: "교복 착용 기준 안내문", date: "05.04" },
  { id: 5, title: "급식 만족도 조사 실시", date: "05.03" },
];

type PostCategory = "자유" | "질문" | "정보" | "유머" | "고민" | "공지";
type BoardTab = "전체" | "인기" | "공지" | "질문";

const CATEGORY_COLOR: Record<PostCategory, string> = {
  자유: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  질문: "text-green-600 bg-green-50 dark:bg-green-900/20",
  정보: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  유머: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  고민: "text-pink-500 bg-pink-50 dark:bg-pink-900/20",
  공지: "text-red-600 bg-red-50 dark:bg-red-900/20",
};

const ROLE_COLOR: Record<Role, string> = {
  student: "text-blue-500",
  teacher: "text-violet-500",
  parent: "text-green-500",
  alumni: "text-amber-500",
  admin: "text-rose-500",
};


interface Post {
  id: number;
  no: number | "공지" | "NEW";
  category: PostCategory;
  title: string;
  comments: number;
  author: string;
  role: Role;
  date: string;
  views: number;
  isNew?: boolean;
}

const ALL_POSTS: Post[] = [
  { id: 1, no: "공지", category: "공지", title: "2학기 중간고사 일정 안내", comments: 5, author: "교무부", role: "teacher", date: "05.07", views: 1240 },
  { id: 2, no: "NEW", category: "정보", title: "2028 수능 개편안 요약 정리 (개인 공부 자료 공유)", comments: 28, author: "익명", role: "student", date: "05.07", views: 892, isNew: true },
  { id: 3, no: 1534, category: "자유", title: "이번 모의고사 수학 30번 풀이 같이 봐요", comments: 32, author: "익명", role: "student", date: "05.07", views: 543 },
  { id: 4, no: 1533, category: "유머", title: "수학 선생님 오늘 너무 웃기심 ㅋㅋㅋ", comments: 14, author: "익명", role: "student", date: "05.07", views: 421 },
  { id: 5, no: 1532, category: "질문", title: "고2 물리학 선택한 분들 공부법 어떻게 해요?", comments: 9, author: "익명", role: "student", date: "05.07", views: 312 },
  { id: 6, no: 1531, category: "정보", title: "서울대 수시 학생부 종합 합격 후기 (졸업생)", comments: 41, author: "24졸업", role: "alumni", date: "05.06", views: 2104 },
  { id: 7, no: 1530, category: "자유", title: "체육대회 응원 티셔츠 디자인 투표 올라왔어요", comments: 21, author: "학생회", role: "student", date: "05.06", views: 718 },
  { id: 8, no: 1529, category: "고민", title: "문과 선택인데 수학 포기해도 될까요", comments: 17, author: "익명", role: "student", date: "05.06", views: 289 },
  { id: 9, no: 1528, category: "정보", title: "학원 추천) 광주 국어 학원 다녀봤던 분 후기", comments: 8, author: "익명", role: "student", date: "05.06", views: 201 },
  { id: 10, no: 1527, category: "자유", title: "야자 끝나고 같이 분식 먹을 사람 구해요", comments: 18, author: "익명", role: "student", date: "05.05", views: 175 },
  { id: 11, no: 1526, category: "질문", title: "3학년 영어 선생님 누구세요? 수업 스타일 궁금해요", comments: 6, author: "익명", role: "student", date: "05.05", views: 163 },
  { id: 12, no: 1525, category: "유머", title: "급식 오늘 역대급이었음 ㄹㅇ 인생 짬뽕", comments: 9, author: "익명", role: "student", date: "05.05", views: 144 },
  { id: 13, no: 1524, category: "자유", title: "학부모 입장에서 본 학교 생활 이야기", comments: 3, author: "학부모A", role: "parent", date: "05.04", views: 98 },
  { id: 14, no: 1523, category: "정보", title: "수능 D-200 스터디 같이 할 사람!", comments: 12, author: "익명", role: "student", date: "05.04", views: 376 },
  { id: 15, no: 1522, category: "고민", title: "진로를 아직도 못 정한 고2 학생인데 너무 불안해요", comments: 23, author: "익명", role: "student", date: "05.03", views: 487 },
];

const HOT_POSTS_BOARD: Post[] = ALL_POSTS.filter((p) =>
  [3, 4, 7, 15, 6].includes(p.id),
);
const NOTICE_POSTS: Post[] = ALL_POSTS.filter((p) => p.category === "공지");
const QUESTION_POSTS: Post[] = ALL_POSTS.filter((p) => p.category === "질문");

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

// ── 유틸 컴포넌트 ─────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
      <div className={`flex items-center gap-1.5 text-sm font-bold ${iconColor} dark:opacity-90`}>
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

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// HOT 게시물 카드 본문 — 데스크톱 사이드바 / 태블릿 / 모바일 모두 공통 사용
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
    return (
      <div className="px-4 py-6 text-center text-[11px] text-gray-400">
        불러오는 중...
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[11px] text-gray-400">
        아직 게시글이 없습니다.
      </div>
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

function TrendIcon({ trend }: { trend: "up" | "down" | "same" | "new" }) {
  if (trend === "new")
    return <span className="text-[10px] font-bold text-red-500">NEW</span>;
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-red-500" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-blue-500" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

// ── 구글 로그인 카드 ─────────────────────────────────────────
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

// 구글 G 로고 (인라인 SVG)
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

// ── 내 프로필 카드 ────────────────────────────────────────────
function ProfileCard({
  nickname,
  role,
  stats,
  onSetupClick,
}: {
  nickname: string | null;
  role: Role | null;
  stats: UserStats;
  onSetupClick?: () => void;
}) {
  const initial = nickname ? nickname.charAt(0) : "?";
  const items: { v: number; l: string }[] = [
    { v: stats.posts, l: "쓴 글" },
    { v: stats.receivedLikes, l: "받은 좋아요" },
    { v: stats.comments, l: "쓴 댓글" },
  ];
  return (
    <Card>
      <SectionHead icon={ArrowUp} title="내 프로필" href="/profile" iconColor="text-cyan-500" />
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#7c3aed,#06b6d4)] text-sm font-bold text-white">
            {initial}
          </div>
          <div className="flex flex-col items-start gap-1">
            {nickname ? (
              <p className="text-sm font-bold text-gray-900 dark:text-white">{nickname}</p>
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
            <div key={s.l} className="rounded-lg bg-gray-50 py-1.5 dark:bg-white/[0.04]">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{s.v}</p>
              <p className="text-[10px] text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── 문튜브 미리보기 카드 ──────────────────────────────────────
function MoonTubeSection() {
  return (
    <Card>
      <SectionHead icon={PlayCircle} title="문튜브" href="/youtube" iconColor="text-red-500" />
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-1">
        {DASHBOARD_YOUTUBE.map((v, i) => (
          <Link
            key={`${v.id}-${i}`}
            href="/youtube"
            className="group relative overflow-hidden rounded-lg bg-black"
          >
            <div className="relative aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                alt={v.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {/* 어두운 오버레이 + 재생 아이콘 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-red-600/90 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                  <Play className="h-4 w-4 fill-current" />
                </span>
              </div>
              {/* 제목 */}
              <p className="absolute inset-x-0 bottom-0 line-clamp-2 px-2.5 pb-2 text-[11px] font-semibold leading-snug text-white">
                {v.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<BoardTab>("전체");
  const { isLoggedIn } = useAuth();

  // ── Supabase 사용자 + profiles row ─────────────────────────
  const { user, profile, loading: profileLoading, refetch } = useSupabaseProfile();
  const [setupOpen, setSetupOpen] = useState(false);
  // 초대 코드로 가입한 사용자 — 로그인 직후 sessionStorage 에서 역할 읽기
  const [inviteRole, setInviteRole] = useState<Role | null>(null);
  const [stats, setStats] = useState<UserStats>({
    posts: 0,
    comments: 0,
    receivedLikes: 0,
  });

  // HOT 게시물 — 최근 7일 / like + view 합계 상위 5개
  const [hotPosts, setHotPosts] = useState<PostRow[]>([]);
  const [hotLoading, setHotLoading] = useState(true);

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

  // 프로필이 로드되면 사용자 통계도 함께 조회
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

  // 최초 로그인 감지: 사용자는 있는데 profiles row 가 없으면 모달 자동 오픈
  useEffect(() => {
    if (!profileLoading && user && !profile) {
      // 초대 코드로 들어온 경우 역할 자동 지정
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
    // 초대 코드 사용자는 역할이 강제됨
    const finalRole: Role = inviteRole ?? role;
    const { error } = await saveNickname(user.id, nickname, finalRole);
    if (error) {
      return { ok: false as const, message: "저장에 실패했어요. 잠시 후 다시 시도해주세요." };
    }
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("inviteRole");
    }
    setInviteRole(null);
    await refetch();
    setSetupOpen(false);
    return { ok: true as const };
  }

  // 프로필 카드 표시값 — Supabase 우선
  const displayNickname: string | null = profile?.nickname ?? null;
  const displayRole: Role | null = profile?.role ?? null;

  const tabPosts: Record<BoardTab, Post[]> = {
    전체: ALL_POSTS,
    인기: HOT_POSTS_BOARD,
    공지: NOTICE_POSTS,
    질문: QUESTION_POSTS,
  };

  const posts = tabPosts[activeTab];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-xl px-4 py-4 md:px-6"
    >
      {/* 배너 슬라이더 */}
      <BannerSlider />

      {/* ── 포탈 레이아웃: 모바일 1컬럼 → 태블릿 2컬럼 → 데스크톱 3컬럼 ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px] lg:grid-cols-[220px_1fr_200px]">

        {/* ── 왼쪽: HOT + 공지 (데스크톱 전용) ── */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          {/* HOT 게시물 — 실제 데이터 */}
          <Card>
            <SectionHead
              icon={Flame}
              title="HOT 게시물"
              href="/board/free"
              iconColor="text-orange-500"
            />
            <HotPostList posts={hotPosts} loading={hotLoading} variant="full" />
          </Card>

          {/* 최신 공지 */}
          <Card>
            <SectionHead icon={Bell} title="최신 공지" href="/notices" iconColor="text-red-500" />
            <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {NOTICES.map((n) => (
                <li key={n.id}>
                  <Link
                    href="/notices"
                    className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                  >
                    <span className="line-clamp-1 flex-1 text-xs text-gray-700 dark:text-gray-200">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{n.date}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {/* 문튜브 미리보기 */}
          <MoonTubeSection />
        </aside>

        {/* ── 중앙: 자유게시판 (+ 태블릿에서 HOT 게시물 상단 표시) ── */}
        <section className="min-w-0 space-y-4">
          {/* 태블릿 전용 HOT 게시물 (md에서만 보임, 데스크톱은 왼쪽 사이드바) */}
          <div className="hidden md:block lg:hidden">
            <Card>
              <SectionHead
                icon={Flame}
                title="HOT 게시물"
                href="/board/free"
                iconColor="text-orange-500"
              />
              <HotPostList posts={hotPosts} loading={hotLoading} variant="full" />
            </Card>
          </div>

          <Card>
            {/* 탭 */}
            <div className="flex border-b border-gray-100 dark:border-white/[0.05]">
              {(["전체", "인기", "공지", "질문"] as BoardTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 border-b-2 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-5 ${
                    activeTab === tab
                      ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                  }`}
                >
                  {tab}
                </button>
              ))}
              <div className="ml-auto hidden items-center px-4 sm:flex">
                <Link
                  href="/feed"
                  className="text-xs text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
                >
                  전체보기 →
                </Link>
              </div>
            </div>

            {/* 게시글 목록 */}
            <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link
                    href="/feed"
                    className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] sm:gap-3"
                  >
                    {/* 번호 */}
                    <span
                      className={`hidden w-10 shrink-0 text-center text-xs tabular-nums sm:block ${
                        post.no === "공지"
                          ? "font-bold text-red-500"
                          : post.no === "NEW"
                          ? "font-bold text-violet-500"
                          : "text-gray-400"
                      }`}
                    >
                      {post.no}
                    </span>

                    {/* 카테고리 */}
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${CATEGORY_COLOR[post.category]}`}
                    >
                      {post.category}
                    </span>

                    {/* 제목 */}
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-gray-800 dark:text-gray-100">
                      <span className="line-clamp-1">{post.title}</span>
                    </span>

                    {/* 댓글 */}
                    {post.comments > 0 && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-violet-500">
                        <MessageSquare className="h-3 w-3" />
                        {post.comments}
                      </span>
                    )}

                    {/* 작성자 */}
                    <span
                      className={`hidden shrink-0 text-[11px] tabular-nums sm:block ${ROLE_COLOR[post.role]}`}
                    >
                      {post.author}
                    </span>

                    {/* 날짜 */}
                    <span className="hidden shrink-0 text-[11px] tabular-nums text-gray-400 md:block">
                      {post.date}
                    </span>

                    {/* 조회수 */}
                    <span className="hidden shrink-0 items-center gap-0.5 text-[11px] text-gray-400 lg:flex">
                      <Eye className="h-3 w-3" />
                      {post.views.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* 하단 글쓰기 버튼 */}
            <div className="flex items-center justify-end border-t border-gray-100 px-4 py-3 dark:border-white/[0.05]">
              <Link
                href="/feed"
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
              >
                글쓰기
              </Link>
            </div>
          </Card>
        </section>

        {/* ── 오른쪽: 프로필 + 검색순위 + 바로가기 ── */}
        <aside className="flex flex-col gap-4">

          {/* 로그인 / 프로필 — 개발 모드에서는 isLoggedIn=true 로 항상 프로필 표시 */}
          {isLoggedIn ? (
            <ProfileCard
              nickname={displayNickname}
              role={displayRole}
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
              <span className="text-[10px] text-gray-400">05.07 12:00 기준</span>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-white/[0.03]">
              {TRENDING.map((t) => (
                <li key={t.rank}>
                  <Link
                    href="/feed"
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

          {/* 태블릿 전용 최신 공지 (데스크톱은 왼쪽 사이드바에서 표시) */}
          <div className="hidden md:block lg:hidden">
            <Card>
              <SectionHead icon={Bell} title="최신 공지" href="/notices" iconColor="text-red-500" />
              <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {NOTICES.slice(0, 4).map((n) => (
                  <li key={n.id}>
                    <Link href="/notices" className="flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <span className="line-clamp-1 flex-1 text-xs text-gray-700 dark:text-gray-200">{n.title}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{n.date}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* 바로가기 */}
          <Card>
            <SectionHead icon={ChevronRight} title="바로가기" iconColor="text-gray-500" />
            <div className="grid grid-cols-2 gap-1.5 p-3">
              {[
                { href: "/admission", label: "2028 대입", icon: GraduationCap, color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20" },
                { href: "/curriculum", label: "과목 가이드", icon: BookOpen, color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
                { href: "/youtube", label: "문튜브", icon: PlayCircle, color: "text-red-500 bg-red-50 dark:bg-red-900/20" },
                { href: "/notices", label: "공지사항", icon: Bell, color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${item.color}`}>
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

      {/* 모바일 전용: HOT + 공지 섹션 (태블릿 이상은 내부 레이아웃에서 처리) */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
        <Card>
          <SectionHead
            icon={Flame}
            title="HOT 게시물"
            href="/board/free"
            iconColor="text-orange-500"
          />
          <HotPostList posts={hotPosts} loading={hotLoading} variant="compact" />
        </Card>
        <Card>
          <SectionHead icon={Bell} title="최신 공지" href="/notices" iconColor="text-red-500" />
          <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {NOTICES.map((n) => (
              <li key={n.id}>
                <Link href="/notices" className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <span className="line-clamp-1 flex-1 text-xs text-gray-700 dark:text-gray-200">{n.title}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{n.date}</span>
                </Link>
              </li>
            ))}
          </ul>
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
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{link.label}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">{link.desc}</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
          </a>
        ))}
      </div>

      {/* ── 하단 피처 카드 3개 (태블릿 2컬럼, 데스크톱 3컬럼) ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 2028 대입 정보 */}
        <Link href="/admission">
          <div className="group rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 transition-shadow hover:shadow-md dark:border-violet-900/30 dark:from-violet-900/10 dark:to-indigo-900/10">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <GraduationCap className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">2028 대입 정보</span>
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

        {/* 과목 가이드 */}
        <Link href="/curriculum">
          <div className="group rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-5 transition-shadow hover:shadow-md dark:border-green-900/30 dark:from-green-900/10 dark:to-emerald-900/10">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <BookOpen className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">교육과정 가이드</span>
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

        {/* 문튜브 */}
        <Link href="/youtube">
          <div className="group rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-5 transition-shadow hover:shadow-md dark:border-red-900/30 dark:from-red-900/10 dark:to-rose-900/10">
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
              <PlayCircle className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">문튜브</span>
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

      {/* 닉네임 최초 설정 모달 — Supabase 사용자 + profiles row 없을 때 자동 노출 */}
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
