"use client";

// 게시판 목록 — /board/[boardType]
// boardType 별 분기:
//  - notice: 고정글 우선 + "중요" 뱃지
//  - lost: 카드 그리드 + 상태 필터
//  - market: 당근 스타일 카드 그리드 + 상태 필터 + 물품상태 뱃지
//  - debate: 토론 리스트 + 미니 투표 바 + 🔥HOT 뱃지
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
  PlayCircle,
  FileText,
  Clock,
  Users,
  Newspaper,
  GraduationCap,
  School,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ShareButton } from "@/components/board/ShareButton";
import { AuthGate } from "@/components/auth/AuthGate";
import { AlumniIntro } from "@/components/board/AlumniIntro";
import { CollegeIntro } from "@/components/board/CollegeIntro";
import { CurriculumIntro } from "@/components/board/CurriculumIntro";
import { CouncilIntro } from "@/components/board/CouncilIntro";
import { NewsIntro } from "@/components/board/NewsIntro";
import { ResourcesIntro } from "@/components/board/ResourcesIntro";
import { SeniorIntro } from "@/components/board/SeniorIntro";
import { StudyIntro } from "@/components/board/StudyIntro";
import { YoutubeIntro } from "@/components/board/YoutubeIntro";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";
import {
  BOARD_LABEL,
  MARKET_CONDITION_LABEL,
  POSTS_PER_PAGE,
  QA_SUBJECTS,
  QA_SUBJECT_STYLE,
  RESOURCE_CATEGORY_STYLE,
  STUDY_SUBJECT_STYLE,
  YOUTUBE_CATEGORY_STYLE,
  getAlumniCategoryLabel,
  getCareerTrackLabel,
  getChallengeStats,
  getLikedPostIds,
  getQaSubjectLabel,
  getResourceCategoryLabel,
  getStudySubjectLabel,
  getYoutubeCategoryLabel,
  listPosts,
  toggleLike,
  parseAlumniContent,
  parseIssueContent,
  parseLostContent,
  parseMarketContent,
  parseQaContent,
  parseResourceContent,
  parseSeniorContent,
  parseStudyContent,
  parseYoutubeContent,
  youtubeThumbUrl,
  type AlumniCategory,
  type BoardType,
  type CareerTrack,
  type ChallengeStats,
  type PostRow,
  type PostStatus,
  type QaSubject,
  type ResourceCategory,
  type StudySubject,
  type YoutubeCategory,
} from "@/lib/board";
import { displayAuthorNameFor } from "@/lib/author-display";
import { extractPostPreview } from "@/lib/parsePostContent";

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

/**
 * 미리보기 텍스트 — 게시판별 JSON 본문은 parsePostContent 가 표시 텍스트만 추출.
 * (free/news 처럼 plain text 보드여도 방어적으로 같은 경로를 사용)
 */
function previewText(
  content: string,
  boardType: BoardType,
  max = 120,
): string {
  return extractPostPreview(content, { boardType, max });
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

  // 문태 이벤트 5개 게시판은 일반 글-목록 UI 가 아닌 전용 페이지로 분기.
  // 각 페이지는 src/components/event/* 에서 점진적으로 채운다.
  if (boardType.startsWith("event_")) {
    return (
      <AuthGate
        title={`${BOARD_LABEL[boardType]}은 로그인이 필요합니다`}
        description="문태고 학생·교사·학부모·졸업생만 이용할 수 있어요."
      >
        <EventComingSoon boardType={boardType} />
      </AuthGate>
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

// ── 문태 이벤트 임시 placeholder ───────────────────────────
// 단계별 빌드아웃: 후속 커밋에서 5개 페이지를 하나씩 전용 컴포넌트로 교체한다.
function EventComingSoon({ boardType }: { boardType: BoardType }) {
  const meta: Record<
    string,
    { emoji: string; tagline: string; from: string; to: string }
  > = {
    event_member: {
      emoji: "🎯",
      tagline: "정회원 미션에 도전하세요",
      from: "#7c3aed",
      to: "#a855f7",
    },
    event_find: {
      emoji: "🥨",
      tagline: "이번 주 꽈배기를 찾아라",
      from: "#f97316",
      to: "#fbbf24",
    },
    event_praise: {
      emoji: "💜",
      tagline: "따뜻한 한마디가 하루를 바꿔요",
      from: "#ec4899",
      to: "#8b5cf6",
    },
    event_study: {
      emoji: "📚",
      tagline: "오늘도 한 걸음 더!",
      from: "#06b6d4",
      to: "#10b981",
    },
    event_quiz: {
      emoji: "🧩",
      tagline: "오늘의 퀴즈에 도전!",
      from: "#fbbf24",
      to: "#f97316",
    },
  };
  const m = meta[boardType] ?? {
    emoji: "🎉",
    tagline: "곧 만나요",
    from: "#7c3aed",
    to: "#06b6d4",
  };

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-6">
      <section
        className="relative overflow-hidden rounded-2xl p-8 sm:p-10"
        style={{
          background: `linear-gradient(135deg, ${m.from} 0%, ${m.to} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 select-none text-[180px] leading-none opacity-25 sm:text-[240px]"
        >
          {m.emoji}
        </div>
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/85">
            MoonPas · Events
          </p>
          <h1 className="mt-1 text-2xl font-extrabold leading-snug text-white sm:text-3xl">
            {BOARD_LABEL[boardType]} {m.emoji}
          </h1>
          <p
            className="mt-2 max-w-xl text-sm leading-relaxed text-white/90"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
          >
            {m.tagline}
          </p>
          <p className="mt-4 inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm ring-1 ring-inset ring-white/30">
            준비 중 · 곧 오픈해요
          </p>
        </div>
      </section>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-center dark:border-white/[0.07] dark:bg-[#16162a]">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          이 코너는 단계별로 오픈 예정이에요.
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          문의는 자유게시판이나 학생회 게시판에 남겨주세요.
        </p>
        <Link
          href="/board/free"
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
        >
          자유게시판으로 이동
        </Link>
      </div>
    </div>
  );
}

function BoardListInner({ boardType }: { boardType: BoardType }) {
  const isNotice = boardType === "notice";
  const isLost = boardType === "lost";
  const isMarket = boardType === "market";
  const isIssue = boardType === "debate";
  const isChallenge = boardType === "challenge";
  const isFree = boardType === "free";
  const isCollege = boardType === "college";
  const isCurriculum = boardType === "curriculum";
  const isCouncil = boardType === "council";
  const isQa = boardType === "qa";
  const isYoutube = boardType === "youtube";
  const isResources = boardType === "resources";
  const isStudy = boardType === "study";
  const isNews = boardType === "news";
  const isAlumni = boardType === "alumni";
  const isSenior = boardType === "senior";
  // 모집중/마감 필터를 지원하는 게시판 — lost/market 외에 study 도 active/resolved 상태 사용
  const supportsStatusFilter = isLost || isMarket || isStudy;

  const { user, profile } = useSupabaseProfile();
  const role = (profile?.role ?? "") as string;
  const isStaff = role === "admin" || role === "teacher";
  const adminOnlyBoards: BoardType[] = [
    "notice",
    "college",
    "curriculum",
    "youtube",
    "resources",
    "news",
  ];
  const canWrite = adminOnlyBoards.includes(boardType) ? isStaff : true;
  // 자료실 카테고리 / 졸업생 카테고리 / 선배 계열 / 문튜브 카테고리 / 스터디 과목 필터
  const [resourceFilter, setResourceFilter] = useState<"" | ResourceCategory>("");
  const [alumniCategoryFilter, setAlumniCategoryFilter] = useState<"" | AlumniCategory>("");
  const [seniorTrackFilter, setSeniorTrackFilter] = useState<CareerTrack>("science");
  const [youtubeCategoryFilter, setYoutubeCategoryFilter] = useState<"" | YoutubeCategory>("");
  const [studySubjectFilter, setStudySubjectFilter] = useState<"" | StudySubject>("");

  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | PostStatus>("");
  // 학습Q&A 과목 필터
  const [qaSubjectFilter, setQaSubjectFilter] = useState<"" | QaSubject>("");

  // 챌린지 — 연속 인증/주간 랭킹
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(null);

  // 자유게시판 — 좋아요 진행 중 상태
  const [likingId, setLikingId] = useState<string | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPage(1);
  }, [
    statusFilter,
    qaSubjectFilter,
    resourceFilter,
    alumniCategoryFilter,
    seniorTrackFilter,
    youtubeCategoryFilter,
    studySubjectFilter,
    boardType,
  ]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // content 안에 JSON 키워드 매칭으로 필터링
    //  - Q&A 과목 / 자료실 카테고리 / 졸업생 카테고리 / 선배 인터뷰 계열 /
    //    문튜브 카테고리 / 스터디 과목
    let contentLike: string | null = null;
    if (isQa && qaSubjectFilter) {
      contentLike = `%"subject":"${qaSubjectFilter}"%`;
    } else if (isResources && resourceFilter) {
      contentLike = `%"category":"${resourceFilter}"%`;
    } else if (isAlumni && alumniCategoryFilter) {
      contentLike = `%"category":"${alumniCategoryFilter}"%`;
    } else if (isSenior) {
      // 선배 인터뷰는 항상 계열로 필터 — 탭이 기본 선택값을 가짐
      contentLike = `%"track":"${seniorTrackFilter}"%`;
    } else if (isYoutube && youtubeCategoryFilter) {
      contentLike = `%"category":"${youtubeCategoryFilter}"%`;
    } else if (isStudy && studySubjectFilter) {
      contentLike = `%"subject":"${studySubjectFilter}"%`;
    }

    listPosts(boardType, page, {
      pinnedFirst: isNotice,
      status: supportsStatusFilter && statusFilter ? statusFilter : null,
      contentLike,
    }).then((res) => {
      if (!active) return;
      setPosts(res.posts);
      setTotal(res.total);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [
    boardType,
    page,
    isNotice,
    isQa,
    isResources,
    isAlumni,
    isSenior,
    isYoutube,
    isStudy,
    supportsStatusFilter,
    statusFilter,
    qaSubjectFilter,
    resourceFilter,
    alumniCategoryFilter,
    seniorTrackFilter,
    youtubeCategoryFilter,
    studySubjectFilter,
  ]);

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

  // 자유게시판 — 현재 페이지 글들에 대해 본인 좋아요 상태를 서버에서 hydrate
  useEffect(() => {
    if (!isFree) return;
    if (posts.length === 0) {
      setLikedSet(new Set());
      return;
    }
    let active = true;
    getLikedPostIds(posts.map((p) => p.id)).then((s) => {
      if (active) setLikedSet(s);
    });
    return () => {
      active = false;
    };
  }, [isFree, posts]);

  async function handleLikeFromCard(postId: string) {
    if (likingId) return;
    const wasLiked = likedSet.has(postId);
    // optimistic — 즉시 UI 반영
    setLikedSet((prev) => {
      const s = new Set(prev);
      if (wasLiked) s.delete(postId);
      else s.add(postId);
      return s;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, like_count: Math.max(0, p.like_count + (wasLiked ? -1 : 1)) }
          : p,
      ),
    );
    setLikingId(postId);
    const { error, liked, like_count } = await toggleLike(postId);
    setLikingId(null);
    if (error) {
      // 실패 시 optimistic 롤백
      setLikedSet((prev) => {
        const s = new Set(prev);
        if (wasLiked) s.add(postId);
        else s.delete(postId);
        return s;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, like_count: Math.max(0, p.like_count + (wasLiked ? 1 : -1)) }
            : p,
        ),
      );
      return;
    }
    // 서버 확정값으로 동기화
    setLikedSet((prev) => {
      const s = new Set(prev);
      if (liked) s.add(postId);
      else s.delete(postId);
      return s;
    });
    if (like_count != null) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, like_count } : p)),
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  const hasIntro =
    isCollege ||
    isCurriculum ||
    isCouncil ||
    isAlumni ||
    isSenior ||
    isYoutube ||
    isResources ||
    isStudy ||
    isNews;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-lg px-4 py-6"
    >
      {/* 인트로 (대입정보/교육과정/학생자치회/졸업생/선배인터뷰/문튜브/자료실/스터디/문태뉴스) */}
      {isCollege && <CollegeIntro />}
      {isCurriculum && <CurriculumIntro />}
      {isCouncil && <CouncilIntro />}
      {isAlumni && (
        <AlumniIntro
          selected={alumniCategoryFilter}
          onSelect={setAlumniCategoryFilter}
        />
      )}
      {isSenior && (
        <SeniorIntro selected={seniorTrackFilter} onSelect={setSeniorTrackFilter} />
      )}
      {isYoutube && (
        <YoutubeIntro
          selected={youtubeCategoryFilter}
          onSelect={setYoutubeCategoryFilter}
        />
      )}
      {isResources && (
        <ResourcesIntro selected={resourceFilter} onSelect={setResourceFilter} />
      )}
      {isStudy && (
        <StudyIntro selected={studySubjectFilter} onSelect={setStudySubjectFilter} />
      )}
      {isNews && <NewsIntro />}

      {/* 헤더 — 인트로가 있으면 압축, 없으면 표준 */}
      <div className={cn("flex items-end justify-between", hasIntro ? "mt-2 mb-3" : "mb-4")}>
        <div>
          {!hasIntro && (
            <>
              <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
                {BOARD_LABEL[boardType]}
              </h1>
              <p className="mt-1 text-xs text-gray-400">총 {total}개의 글</p>
            </>
          )}
          {hasIntro && (
            <p className="text-xs text-gray-400">총 {total}개의 글</p>
          )}
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

      {/* 학습 Q&A 과목 필터 */}
      {isQa && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setQaSubjectFilter("")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              qaSubjectFilter === ""
                ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
            )}
          >
            전체
          </button>
          {QA_SUBJECTS.map((s) => {
            const active = qaSubjectFilter === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setQaSubjectFilter(s.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition ring-1 ring-inset",
                  active
                    ? QA_SUBJECT_STYLE[s.value] +
                        " border-transparent"
                    : "border-gray-200 bg-white text-gray-500 ring-transparent hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 자료실 카테고리 필터는 ResourcesIntro 카드에서 처리 */}

      {/* 졸업생 카테고리 필터는 AlumniIntro 카드에서 직접 처리 */}

      {/* 상태 필터 (lost / market / study) */}
      {supportsStatusFilter && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(
            [
              { value: "", label: "전체" },
              {
                value: "active",
                label: isLost
                  ? "찾는 중 🔴"
                  : isStudy
                  ? "모집중 🟢"
                  : "나눔중 🟢",
              },
              {
                value: "resolved",
                label: isLost ? "찾았어요 🟢" : isStudy ? "마감" : "나눔완료",
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
        <EmptyState
          boardType={boardType}
          canWrite={canWrite}
          filtered={(supportsStatusFilter && !!statusFilter) || !!youtubeCategoryFilter || !!studySubjectFilter || !!resourceFilter}
        />
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
      ) : isQa ? (
        <QaList posts={posts} />
      ) : isYoutube ? (
        <YoutubeGrid posts={posts} />
      ) : isResources ? (
        <ResourceList posts={posts} />
      ) : isStudy ? (
        <StudyGrid posts={posts} />
      ) : isNews ? (
        <NewsMagazine posts={posts} />
      ) : isAlumni ? (
        <AlumniList posts={posts} />
      ) : isSenior ? (
        <SeniorGrid posts={posts} />
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
                      {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
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
                    <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400">
                      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                        <Eye className="h-3 w-3" />
                        <span className="tabular-nums">{post.view_count}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                        <MessageSquare className="h-3 w-3" />
                        <span className="tabular-nums">{post.comment_count}</span>
                      </span>
                      <ShareButton
                        boardType={boardType}
                        postId={post.id}
                        title={post.title}
                      />
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
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
              <Eye className="h-3 w-3" />
              <span className="tabular-nums">{post.view_count}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
              <MessageSquare className="h-3 w-3" />
              <span className="tabular-nums">{post.comment_count}</span>
            </span>
            <ShareButton
              boardType={post.board_type}
              postId={post.id}
              title={post.title}
            />
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
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
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
        href={`/board/debate/${post.id}`}
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
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          {post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400">
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
              <Eye className="h-3 w-3" />
              <span className="tabular-nums">{post.view_count}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
              <MessageSquare className="h-3 w-3" />
              <span className="tabular-nums">{post.comment_count}</span>
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
          {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
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
  const preview = previewText(post.content, post.board_type, 140);

  return (
    <li>
      <div className="rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a]">
        <Link href={`/board/free/${post.id}`} className="block p-4">
          <div className="flex items-start gap-3">
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
            </div>
          </div>

          {/* 메타 행 — 작성자/시간 + 조회/댓글/좋아요/공유.
              모바일에서 좁아도 겹치지 않게 flex-wrap + gap-x-3 + 각 항목 shrink-0/whitespace-nowrap */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-gray-500">
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
              </span>
              {post.author && (
                <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
              )}
            </span>
            <span className="shrink-0 tabular-nums whitespace-nowrap">
              {relativeTime(post.created_at)}
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400">
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                <Eye className="h-3 w-3" />
                <span className="tabular-nums">{post.view_count}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                <MessageSquare className="h-3 w-3" />
                <span className="tabular-nums">{post.comment_count}</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (loading) return;
                  onLike(post.id);
                }}
                disabled={loading}
                aria-pressed={liked}
                aria-label={liked ? "좋아요 취소" : "좋아요"}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 transition disabled:cursor-not-allowed",
                  liked
                    ? "text-rose-500 dark:text-rose-300"
                    : "text-gray-400 hover:text-rose-500 dark:text-gray-400 dark:hover:text-rose-300",
                )}
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Heart
                    className={cn("h-3 w-3", liked && "fill-current")}
                    strokeWidth={2.2}
                  />
                )}
                <span className="tabular-nums">
                  {post.like_count.toLocaleString()}
                </span>
              </button>
              <ShareButton boardType="free" postId={post.id} title={post.title} />
            </span>
          </div>
        </Link>
      </div>
    </li>
  );
}

// ── 학습 Q&A 리스트 ────────────────────────────────────────
function QaList({ posts }: { posts: PostRow[] }) {
  return (
    <ul className="space-y-2.5">
      {posts.map((post) => (
        <QaRow key={post.id} post={post} />
      ))}
    </ul>
  );
}

function QaRow({ post }: { post: PostRow }) {
  const info = useMemo(() => parseQaContent(post.content), [post.content]);
  const answered = post.comment_count > 0;
  const fresh = isNewPost(post.created_at);

  return (
    <li>
      <Link
        href={`/board/qa/${post.id}`}
        className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
              QA_SUBJECT_STYLE[info.subject],
            )}
          >
            [{getQaSubjectLabel(info.subject)}]
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
          {fresh && (
            <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
              NEW
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400">
            {formatDate(post.created_at)}
          </span>
        </div>

        <p className="mt-2 line-clamp-1 text-sm font-extrabold text-gray-900 dark:text-white">
          {post.title}
        </p>
        {info.question && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {info.question}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-gray-500">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          {post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
          <span className="ml-auto flex items-center gap-2 text-gray-400">
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {post.view_count}
            </span>
            <span
              className={cn(
                "flex items-center gap-0.5",
                answered && "text-emerald-500 dark:text-emerald-300",
              )}
            >
              <MessageSquare className="h-3 w-3" />
              {post.comment_count}
            </span>
            <ShareButton
              boardType={post.board_type}
              postId={post.id}
              title={post.title}
            />
          </span>
        </div>
      </Link>
    </li>
  );
}

// ── 문튜브 — YouTube 썸네일 그리드 ───────────────────────────
function YoutubeGrid({ posts }: { posts: PostRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <YoutubeCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function YoutubeCard({ post }: { post: PostRow }) {
  const info = useMemo(() => parseYoutubeContent(post.content), [post.content]);
  const fresh = isNewPost(post.created_at);
  // videoId 없으면 보라색 그라디언트 fallback
  const thumb = info.videoId ? youtubeThumbUrl(info.videoId) : null;

  return (
    <Link
      href={`/board/youtube/${post.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)] dark:border-white/[0.07] dark:bg-[#16162a]"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
            <PlayCircle className="h-12 w-12 opacity-90" />
          </div>
        )}
        {/* ▶️ 재생 아이콘 오버레이 */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/15 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-red-600/95 text-white shadow-xl ring-2 ring-white/40">
            <PlayCircle className="h-8 w-8" />
          </span>
        </div>
        <span className="pointer-events-none absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-red-600/90 text-white ring-1 ring-white/20 backdrop-blur-sm">
          <PlayCircle className="h-4 w-4" />
        </span>
        {fresh && (
          <span className="absolute left-2 top-2 rounded-full bg-violet-500/85 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            NEW
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
              YOUTUBE_CATEGORY_STYLE[info.category],
            )}
          >
            {getYoutubeCategoryLabel(info.category)}
          </span>
          <span className="ml-auto text-[10px] text-gray-400 tabular-nums">
            {formatDate(post.created_at)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm font-bold text-gray-900 dark:text-white">
          {post.title}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
            </span>
            {post.author && (
              <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
            )}
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
            <ShareButton
              boardType={post.board_type}
              postId={post.id}
              title={post.title}
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── 자료실 — PDF 중심 리스트 ──────────────────────────────
function ResourceList({ posts }: { posts: PostRow[] }) {
  return (
    <ul className="space-y-2.5">
      {posts.map((post) => (
        <ResourceRow key={post.id} post={post} />
      ))}
    </ul>
  );
}

/** 첨부파일 확장자별 아이콘 컬러 */
function fileExtStyle(fileName: string | null): {
  label: string;
  bg: string;
  text: string;
} {
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return {
      label: "PDF",
      bg: "bg-rose-500/10 dark:bg-rose-500/15",
      text: "text-rose-500 dark:text-rose-300",
    };
  }
  if (ext === "hwp" || ext === "hwpx") {
    return {
      label: "HWP",
      bg: "bg-blue-500/10 dark:bg-blue-500/15",
      text: "text-blue-500 dark:text-blue-300",
    };
  }
  return {
    label: ext ? ext.toUpperCase() : "FILE",
    bg: "bg-gray-500/10 dark:bg-gray-500/15",
    text: "text-gray-500 dark:text-gray-300",
  };
}

function ResourceRow({ post }: { post: PostRow }) {
  const info = useMemo(() => parseResourceContent(post.content), [post.content]);
  const fresh = isNewPost(post.created_at);
  const hasFile = !!post.file_url;
  const fileStyle = fileExtStyle(post.file_name);

  return (
    <li>
      <Link
        href={`/board/resources/${post.id}`}
        className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a]"
      >
        {/* 왼쪽: 파일 아이콘 + 확장자 라벨 (PDF=빨강 / HWP=파랑 / 기타=회색) */}
        <span
          className={cn(
            "relative grid h-14 w-14 shrink-0 place-items-center rounded-xl",
            fileStyle.bg,
            fileStyle.text,
          )}
        >
          <FileText className="h-6 w-6" />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-white px-1 text-[8.5px] font-extrabold leading-none ring-1 ring-inset ring-current dark:bg-[#16162a]">
            {fileStyle.label}
          </span>
        </span>

        {/* 가운데: 제목 + 카테고리 뱃지 + 설명 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                RESOURCE_CATEGORY_STYLE[info.category],
              )}
            >
              {getResourceCategoryLabel(info.category)}
            </span>
            {fresh && (
              <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
                NEW
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm font-extrabold text-gray-900 dark:text-white">
            {post.title}
          </p>
          {info.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
              {info.description}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
            </span>
            {post.author && (
              <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
            )}
          </div>
        </div>

        {/* 오른쪽: 다운로드 수(view_count 활용) + 날짜 + 다운로드 CTA */}
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            DL
          </span>
          <span className="text-base font-extrabold tabular-nums text-violet-600 dark:text-violet-300">
            {post.view_count}
          </span>
          <span className="text-[10px] tabular-nums text-gray-400">
            {formatDate(post.created_at)}
          </span>
          {hasFile && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition group-hover:bg-violet-700">
              <Paperclip className="h-2.5 w-2.5" />
              다운로드
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

// ── 스터디 — 모집 카드 그리드 ─────────────────────────────
function StudyGrid({ posts }: { posts: PostRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {posts.map((post) => (
        <StudyCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function StudyCard({ post }: { post: PostRow }) {
  const info = useMemo(() => parseStudyContent(post.content), [post.content]);
  const fresh = isNewPost(post.created_at);
  const closed = post.status === "resolved";
  // 댓글 수 = 모집된 인원 수 비슷한 의미로 활용 (작성자 + 댓글 단 사람)
  // 단순화: comment_count + 1 (작성자) 를 가입 의사 표현 인원으로 가정. 상한은 maxMembers.
  const joined = Math.min(info.maxMembers, post.comment_count + 1);
  const full = !closed && joined >= info.maxMembers;

  return (
    <Link
      href={`/board/study/${post.id}`}
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(16,185,129,0.18)] dark:bg-[#16162a]",
        closed
          ? "border-gray-200 opacity-60 dark:border-white/[0.05]"
          : "border-gray-200 dark:border-white/[0.07]",
      )}
    >
      {/* 카드 상단: 과목 뱃지 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
            STUDY_SUBJECT_STYLE[info.subject],
          )}
        >
          {getStudySubjectLabel(info.subject)}
        </span>
        {fresh && !closed && (
          <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
            NEW
          </span>
        )}
        <span className="ml-auto text-[10px] tabular-nums text-gray-400">
          {formatDate(post.created_at)}
        </span>
      </div>

      <p className="mt-2 line-clamp-1 text-base font-extrabold text-gray-900 dark:text-white">
        {post.title}
      </p>

      {/* 정보 행: 인원 / 스케줄 / 장소 */}
      <div className="mt-2 grid gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {joined}/{info.maxMembers}명
          </span>
          {full && (
            <span className="ml-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
              정원 마감
            </span>
          )}
        </span>
        {info.schedule && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-emerald-500" />
            <span className="line-clamp-1">{info.schedule}</span>
          </span>
        )}
        {info.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
            <span className="line-clamp-1">{info.location}</span>
          </span>
        )}
      </div>

      {/* 하단: 작성자 + 상태 뱃지 */}
      <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          {post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
            closed
              ? "bg-gray-500/15 text-gray-500 ring-gray-500/30 dark:text-gray-300"
              : "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
          )}
        >
          {closed ? "⬜ 마감" : "🟢 모집중"}
        </span>
      </div>

      {/* 마감 오버레이 — 카드 위 대각선 워터마크 */}
      {closed && (
        <span className="pointer-events-none absolute right-3 top-3 rotate-6 rounded-md bg-gray-900/85 px-2 py-1 text-[10px] font-extrabold text-white shadow-lg ring-1 ring-white/10">
          마감
        </span>
      )}
    </Link>
  );
}

// ── 문태뉴스 — 매거진 레이아웃 (히어로 + 가로형 카드) ────────
function NewsMagazine({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) return null;
  const [hero, ...rest] = posts;
  return (
    <div className="space-y-5">
      <NewsHero post={hero} />
      {rest.length > 0 && (
        <ul className="space-y-3">
          {rest.map((post) => (
            <NewsRow key={post.id} post={post} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewsHero({ post }: { post: PostRow }) {
  const fresh = isNewPost(post.created_at);
  const preview = previewText(post.content, post.board_type, 180);
  return (
    <Link
      href={`/board/news/${post.id}`}
      className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(124,58,237,0.2)] dark:border-white/[0.07] dark:bg-[#16162a]"
    >
      <div className="relative aspect-[16/8] w-full overflow-hidden">
        {post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500 text-white">
            <Newspaper className="h-16 w-16 opacity-80" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-inset ring-white/40 backdrop-blur-sm">
            <Newspaper className="h-3 w-3" />
            메인 뉴스
          </span>
          {fresh && (
            <span className="rounded-full bg-violet-500/85 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              NEW
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <h2 className="line-clamp-2 text-xl font-extrabold leading-snug text-gray-900 dark:text-white">
          {post.title}
        </h2>
        {preview && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
            {preview}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          {post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
          <span className="text-gray-300">·</span>
          <span className="tabular-nums">{formatDate(post.created_at)}</span>
          <span className="ml-auto flex items-center gap-2 text-gray-400">
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {post.comment_count}
            </span>
            <ShareButton
              boardType={post.board_type}
              postId={post.id}
              title={post.title}
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

function NewsRow({ post }: { post: PostRow }) {
  const fresh = isNewPost(post.created_at);
  const preview = previewText(post.content, post.board_type, 120);
  return (
    <li>
      <Link
        href={`/board/news/${post.id}`}
        className="flex gap-4 rounded-xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a]"
      >
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-40">
          {post.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
              <Newspaper className="h-7 w-7 opacity-90" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {fresh && (
              <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
                NEW
              </span>
            )}
            <span className="text-[11px] text-gray-400">
              {formatDate(post.created_at)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-extrabold leading-snug text-gray-900 dark:text-white">
            {post.title}
          </p>
          {preview && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {preview}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
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
              <ShareButton
                boardType={post.board_type}
                postId={post.id}
                title={post.title}
              />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

// ── 졸업생 — 연도 뱃지 리스트 ─────────────────────────────
function AlumniList({ posts }: { posts: PostRow[] }) {
  return (
    <ul className="space-y-2.5">
      {posts.map((post) => (
        <AlumniRow key={post.id} post={post} />
      ))}
    </ul>
  );
}

/** 졸업생 카테고리별 색상 */
const ALUMNI_CATEGORY_STYLE: Record<string, string> = {
  "college-life":
    "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300",
  "why-this-major":
    "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
  "admission-tips":
    "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300",
  "looking-back":
    "bg-cyan-500/15 text-cyan-600 ring-cyan-500/30 dark:text-cyan-300",
};

function AlumniRow({ post }: { post: PostRow }) {
  const info = useMemo(() => parseAlumniContent(post.content), [post.content]);
  const fresh = isNewPost(post.created_at);
  // info.description 은 이미 plain text — boardType 은 alumni 로 명시 (시그니처 일치용)
  const preview = previewText(info.description, "alumni", 140);
  const isAlumniRole = post.author?.role === "alumni";
  const catStyle =
    ALUMNI_CATEGORY_STYLE[info.category] ?? ALUMNI_CATEGORY_STYLE["college-life"];

  return (
    <li>
      <Link
        href={`/board/alumni/${post.id}`}
        className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(124,58,237,0.18)] dark:border-white/[0.07] dark:bg-[#16162a]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
              catStyle,
            )}
          >
            {getAlumniCategoryLabel(info.category)}
          </span>
          {(info.university || info.major) && (
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              {info.university}
              {info.university && info.major && " · "}
              {info.major}
            </span>
          )}
          <span className="text-[11px] text-gray-400">
            {info.graduationYear}년 졸업
          </span>
          {fresh && (
            <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
              NEW
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400">
            {formatDate(post.created_at)}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-1 text-sm font-extrabold text-gray-900 dark:text-white">
          {post.title}
        </p>
        {preview && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {preview}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          {post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
          {isAlumniRole && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
              <GraduationCap className="h-2.5 w-2.5" />
              졸업생 인증
            </span>
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
            <ShareButton
              boardType={post.board_type}
              postId={post.id}
              title={post.title}
            />
          </span>
        </div>
      </Link>
    </li>
  );
}

// ── 선배의 한마디 — 대학/학과 카드 ──────────────────────────
function SeniorGrid({ posts }: { posts: PostRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {posts.map((post) => (
        <SeniorCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function SeniorCard({ post }: { post: PostRow }) {
  const info = useMemo(() => parseSeniorContent(post.content), [post.content]);
  const fresh = isNewPost(post.created_at);

  return (
    <Link
      href={`/board/senior/${post.id}`}
      className="group flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(16,185,129,0.18)] dark:border-white/[0.07] dark:bg-[#16162a]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-md">
          <School className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-base font-extrabold text-gray-900 dark:text-white">
            {info.university || "(대학명 미입력)"}
          </p>
          <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
            {info.major || "(학과 미입력)"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
          <GraduationCap className="h-3 w-3" />
          {info.graduationYear}
        </span>
      </div>

      <div className="-mt-1 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300">
          {getCareerTrackLabel(info.track)} 계열
        </span>
      </div>

      {info.summary && (
        <div className="rounded-lg bg-violet-500/[0.06] px-3 py-2.5 text-sm font-semibold text-violet-700 ring-1 ring-inset ring-violet-500/20 dark:text-violet-200">
          <span className="mr-1 inline-flex items-center text-violet-500">
            <Quote className="h-3.5 w-3.5" />
          </span>
          {info.summary}
        </div>
      )}

      <p className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white">
        {post.title}
      </p>

      <div className="mt-auto flex items-center justify-between text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
          </span>
          {post.author && (
            <Badge role={post.author.role} className="text-[9px] py-0 px-1.5" />
          )}
          {fresh && (
            <span className="ml-1 inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-300">
              NEW
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-gray-400">
          <span className="flex items-center gap-0.5">
            <Eye className="h-3 w-3" />
            {post.view_count}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" />
            {post.comment_count}
          </span>
          <ShareButton
            boardType={post.board_type}
            postId={post.id}
            title={post.title}
          />
        </span>
      </div>
    </Link>
  );
}

// ── 빈 상태 — 게시판별 아이콘/문구 ─────────────────────────
function EmptyState({
  boardType,
  canWrite,
  filtered,
}: {
  boardType: BoardType;
  canWrite: boolean;
  filtered: boolean;
}) {
  // 게시판별 아이콘과 안내 문구
  const meta: Partial<
    Record<BoardType, { Icon: typeof PlayCircle; message: string; hint?: string }>
  > = {
    youtube: {
      Icon: PlayCircle,
      message: "아직 등록된 영상이 없습니다",
      hint: "교사 선생님이 추천 영상을 곧 올려드릴 거예요.",
    },
    resources: {
      Icon: FileText,
      message: "아직 등록된 자료가 없습니다",
      hint: "기출문제·학습자료·양식이 곧 업로드될 예정이에요.",
    },
    study: {
      Icon: Users,
      message: "모집 중인 스터디가 없습니다",
      hint: canWrite ? "첫 번째 스터디를 모집해보세요!" : undefined,
    },
    news: {
      Icon: Newspaper,
      message: "아직 등록된 뉴스가 없습니다",
      hint: "학교 소식이 올라오면 이곳에 표시돼요.",
    },
  };
  const m = meta[boardType];
  const Icon = m?.Icon ?? FileText;
  const message = filtered
    ? "조건에 해당하는 콘텐츠가 없습니다"
    : m?.message ?? "아직 게시글이 없습니다";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-white/[0.07] dark:bg-[#16162a]">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/10 text-violet-500 dark:text-violet-300">
        <Icon className="h-7 w-7" />
      </span>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        {message}
      </p>
      {!filtered && m?.hint && (
        <p className="mt-1 text-xs text-gray-400">{m.hint}</p>
      )}
      {!filtered && canWrite && !m?.hint && (
        <p className="mt-1 text-xs text-gray-400">첫 번째 글을 작성해보세요!</p>
      )}
    </div>
  );
}
