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
  Users,
  Newspaper,
  GraduationCap,
  School,
  Quote,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ShareButton } from "@/components/board/ShareButton";
import { AuthGate } from "@/components/auth/AuthGate";
import { AlumniIntro } from "@/components/board/AlumniIntro";
import { CollegeIntro } from "@/components/board/CollegeIntro";
import { CurriculumIntro } from "@/components/board/CurriculumIntro";
import { CouncilIntro } from "@/components/board/CouncilIntro";
import { NewsIntro } from "@/components/board/NewsIntro";
import { AlumniNewsIntro } from "@/components/board/AlumniNewsIntro";
import { ResourcesIntro } from "@/components/board/ResourcesIntro";
import { SeniorIntro } from "@/components/board/SeniorIntro";
import { GuessWhoIntro } from "@/components/board/GuessWhoIntro";
// StudyIntro 는 신규 학습게시판 도입으로 제거 (구 스터디 모집 안내) — 잔존 import 제거.
import { YoutubeIntro } from "@/components/board/YoutubeIntro";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { cn } from "@/lib/utils";
import {
  BOARD_LABEL,
  CHALLENGE_CATEGORY_ICON,
  CHALLENGE_CATEGORY_LABEL,
  MARKET_CONDITION_LABEL,
  POSTS_PER_PAGE,
  QA_SUBJECTS,
  QA_SUBJECT_STYLE,
  RESOURCE_CATEGORY_STYLE,
  YOUTUBE_CATEGORY_STYLE,
  getAlumniCategoryLabel,
  getCareerTrackLabel,
  getChallengeStats,
  getLikedPostIds,
  getMyChallengeSubs,
  getQaSubjectLabel,
  getResourceCategoryLabel,
  getYoutubeCategoryLabel,
  joinChallenge,
  leaveChallenge,
  listPosts,
  rejectChallengePost,
  toggleLike,
  parseAlumniContent,
  parseIssueContent,
  parseLostContent,
  parseMarketContent,
  parseQaContent,
  parseResourceContent,
  parseSeniorContent,
  parseYoutubeContent,
  youtubeThumbUrl,
  STUDY_GRADE_LABEL,
  STUDY_POST_CATEGORY_LABEL,
  STUDY_POST_CATEGORY_STYLE,
  STUDY_SUBJECT_TAG_LABEL,
  STUDY_SUBJECT_TAG_STYLE,
  type AlumniCategory,
  type BoardType,
  type CareerTrack,
  type ChallengeCategory,
  type ChallengeStats,
  type PostRow,
  type PostStatus,
  type QaSubject,
  type ResourceCategory,
  type StudyGrade,
  type StudyPostCategory,
  type StudySubjectTag,
  type YoutubeCategory,
} from "@/lib/board";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { MobileBackButton } from "@/components/nav/MobileBackButton";
import { NicknameButton } from "@/components/profile/NicknameButton";
import { displayAuthorNameFor } from "@/lib/author-display";
import { extractPostPreview } from "@/lib/parsePostContent";
import {
  CHALLENGE_TAGS,
  CHALLENGE_TAG_STYLE,
  formatChallengeDuration,
  getMyPendingInvites,
  listChallenges,
  parseTags,
  respondToInvite,
  type Challenge as ChallengeV2,
  type ChallengeTagKey,
  type PendingInvite,
} from "@/lib/challenge";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

// 준비 중 게시판 — TopBar 메뉴는 노출하되 클릭 시 ComingSoon 안내만 표시.
// study 는 023 마이그레이션 이후 정식 학습게시판으로 활성화됨 (COMING_SOON 에서 제거).
const COMING_SOON_BOARDS: Record<string, { title: string; subtitle?: string }> = {
  campus_story: {
    title: "캠퍼스 스토리",
    subtitle: "선배들의 대학 캠퍼스 이야기를 모아드릴게요.",
  },
  insight: {
    title: "인사이트",
    subtitle: "졸업생·재학생의 인사이트를 나누는 공간입니다.",
  },
  parent_board: {
    title: "학부모 마당",
    subtitle: "학부모님을 위한 전용 공간을 준비하고 있어요.",
  },
};

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
  const rawBoardType = params.boardType;

  // 신규/재개편 예정 게시판은 본 목록 UI 대신 ComingSoon 으로 안내.
  // VALID_BOARDS 검사보다 먼저 처리 — study 처럼 기존 board_type 인 경우도 포함하기 때문.
  const comingSoon = COMING_SOON_BOARDS[rawBoardType];
  if (comingSoon) {
    return <ComingSoon title={comingSoon.title} subtitle={comingSoon.subtitle} />;
  }

  const boardType = rawBoardType as BoardType;

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
  const isAlumniNews = boardType === "alumni_news";
  const isAlumni = boardType === "alumni";
  const isSenior = boardType === "senior";
  const isGuessWho = boardType === "guess_who";
  // 모집중/마감 필터를 지원하는 게시판 — 분실물·나눔장터만 (구 study 모집은 폐기).
  const supportsStatusFilter = isLost || isMarket;

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
  // 신규 학습게시판 — 학년 / 교과 태그 / 글 종류 ("" = 전체).
  const [studyGradeFilter, setStudyGradeFilter] = useState<"" | StudyGrade>("");
  const [studySubjectTagFilter, setStudySubjectTagFilter] = useState<"" | StudySubjectTag>("");
  const [studyPostCategoryFilter, setStudyPostCategoryFilter] = useState<"" | StudyPostCategory>("");

  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | PostStatus>("");
  // 학습Q&A 과목 필터
  const [qaSubjectFilter, setQaSubjectFilter] = useState<"" | QaSubject>("");

  // 챌린지 — 연속 인증/주간 랭킹
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(null);
  // 챌린지 — 카테고리 필터 ("" = 전체) / 내 참여 카테고리 / 인증 취소 모달
  const [challengeCategoryFilter, setChallengeCategoryFilter] = useState<
    "" | ChallengeCategory
  >("");
  const [myChallengeSubs, setMyChallengeSubs] = useState<ChallengeCategory[]>([]);
  const [joiningCategory, setJoiningCategory] = useState<ChallengeCategory | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PostRow | null>(null);

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
    challengeCategoryFilter,
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
    }

    listPosts(boardType, page, {
      pinnedFirst: isNotice,
      status: supportsStatusFilter && statusFilter ? statusFilter : null,
      contentLike,
      // 학습게시판 전용 — 다른 board 에서는 ""(전체) 라 필터 적용 안 됨.
      grade: isStudy && studyGradeFilter ? studyGradeFilter : null,
      subjectTag: isStudy && studySubjectTagFilter ? studySubjectTagFilter : null,
      // 학습 / 챌린지 모두 post_category 컬럼을 사용 — board_type 분기.
      postCategory: isStudy
        ? (studyPostCategoryFilter || null)
        : isChallenge
        ? (challengeCategoryFilter || null)
        : null,
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
    isChallenge,
    challengeCategoryFilter,
    studyGradeFilter,
    studySubjectTagFilter,
    studyPostCategoryFilter,
    supportsStatusFilter,
    statusFilter,
    qaSubjectFilter,
    resourceFilter,
    alumniCategoryFilter,
    seniorTrackFilter,
    youtubeCategoryFilter,
  ]);

  // 챌린지 보드 진입 시 통계 + 내 참여 카테고리 fetch
  useEffect(() => {
    if (!isChallenge) return;
    let active = true;
    getChallengeStats().then((s) => {
      if (active) setChallengeStats(s);
    });
    getMyChallengeSubs().then((subs) => {
      if (active) setMyChallengeSubs(subs);
    });
    return () => {
      active = false;
    };
  }, [isChallenge]);

  // 챌린지 — 카테고리 참여/해제 토글
  async function handleToggleChallengeJoin(category: ChallengeCategory) {
    if (joiningCategory) return;
    const isJoined = myChallengeSubs.includes(category);
    setJoiningCategory(category);
    const { error } = isJoined
      ? await leaveChallenge(category)
      : await joinChallenge(category);
    if (!error) {
      setMyChallengeSubs((prev) =>
        isJoined ? prev.filter((c) => c !== category) : [...prev, category],
      );
      // 참여자 수도 즉시 반영 (낙관적)
      setChallengeStats((prev) => {
        if (!prev) return prev;
        const next = { ...prev.participantCounts };
        next[category] = Math.max(0, next[category] + (isJoined ? -1 : 1));
        return { ...prev, participantCounts: next };
      });
    } else {
      alert(`참여 처리 실패: ${error}`);
    }
    setJoiningCategory(null);
  }

  // 챌린지 — 인증 취소 확정
  async function handleRejectChallenge(postId: string, reason: string) {
    const { error } = await rejectChallengePost(postId, reason);
    if (error) {
      alert(`인증 취소 실패: ${error}`);
      return;
    }
    // 목록 갱신: 해당 글 status 만 즉시 rejected 로 표시
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, challenge_status: "rejected", challenge_rejected_reason: reason }
          : p,
      ),
    );
    // 통계 재집계
    getChallengeStats().then((s) => setChallengeStats(s));
    setRejectTarget(null);
  }

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
    isNews ||
    isAlumniNews ||
    isGuessWho;
    // 학습게시판은 자체 안내 배너 + 3 행 필터를 별도 슬롯에 렌더 — hasIntro 계산에선 제외.

  // 챌린지 v2 — 챌린지 게시판은 글 목록이 아닌 챌린지 카드 목록 UI 로 완전 분기.
  if (isChallenge) {
    return <ChallengeListView currentUserId={user?.id ?? null} />;
  }

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
        <StudyBoardHeader
          gradeFilter={studyGradeFilter}
          subjectFilter={studySubjectTagFilter}
          categoryFilter={studyPostCategoryFilter}
          onGradeChange={setStudyGradeFilter}
          onSubjectChange={setStudySubjectTagFilter}
          onCategoryChange={setStudyPostCategoryFilter}
        />
      )}
      {isNews && <NewsIntro />}
      {isAlumniNews && <AlumniNewsIntro />}
      {isGuessWho && <GuessWhoIntro />}

      {/* 헤더 — 인트로가 있으면 압축, 없으면 표준 */}
      <div className={cn("flex items-end justify-between", hasIntro ? "mt-2 mb-3" : "mb-4")}>
        <div className="flex min-w-0 items-center gap-2">
          <MobileBackButton />
          <div className="min-w-0">
            {!hasIntro && (
              <>
                <h1 className="truncate text-xl font-extrabold text-gray-900 dark:text-white">
                  {BOARD_LABEL[boardType]}
                </h1>
                <p className="mt-1 text-xs text-gray-400">총 {total}개의 글</p>
              </>
            )}
            {hasIntro && (
              <p className="text-xs text-gray-400">총 {total}개의 글</p>
            )}
          </div>
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

      {/* 챌린지 — 카테고리 카드 + 카테고리 탭 주간 랭킹 */}
      {isChallenge && (
        <>
          <ChallengeHeader
            stats={challengeStats}
            currentUserId={user?.id ?? null}
            mySubs={myChallengeSubs}
            joining={joiningCategory}
            onToggleJoin={handleToggleChallengeJoin}
            onSelectCategory={setChallengeCategoryFilter}
            currentCategory={challengeCategoryFilter}
          />
          <ChallengeCategoryTabs
            value={challengeCategoryFilter}
            onChange={setChallengeCategoryFilter}
          />
        </>
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

      {/* 상태 필터 (lost / market) — 학습게시판은 모집 개념이 없어 status 필터 미사용 */}
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
        <EmptyState
          boardType={boardType}
          canWrite={canWrite}
          filtered={(supportsStatusFilter && !!statusFilter) || !!youtubeCategoryFilter || !!resourceFilter || !!studyGradeFilter || !!studySubjectTagFilter || !!studyPostCategoryFilter}
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
          isStaff={isStaff}
          onRequestReject={(post) => setRejectTarget(post)}
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
        // 학습게시판은 표준 리스트 + 태그 뱃지 (DefaultList 가 post.grade/subject_tag/post_category 자동 표시)
        <DefaultList posts={posts} boardType={boardType} highlightPinned={false} />
      ) : isNews ? (
        <NewsMagazine posts={posts} />
      ) : isAlumni ? (
        <AlumniList posts={posts} />
      ) : isSenior ? (
        <SeniorGrid posts={posts} />
      ) : isGuessWho ? (
        <GuessWhoGrid posts={posts} />
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

      {/* 챌린지 — 관리자 인증 취소 모달 */}
      {rejectTarget && (
        <ChallengeRejectModal
          post={rejectTarget}
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) => handleRejectChallenge(rejectTarget.id, reason)}
        />
      )}
    </motion.div>
  );
}

// ── 학습게시판 안내 배너 + 3 행 필터 ─────────────────────────
// 카테고리 헤더(목록 상단)에 한 번만 렌더. 각 행은 [전체] + 옵션 칩 들로 구성.
const STUDY_GRADE_OPTIONS: { value: "" | StudyGrade; label: string }[] = [
  { value: "", label: "전체" },
  { value: "1", label: "1학년" },
  { value: "2", label: "2학년" },
  { value: "3", label: "3학년" },
];
const STUDY_SUBJECT_OPTIONS: { value: "" | StudySubjectTag; label: string }[] = [
  { value: "", label: "전체" },
  { value: "korean", label: "국어" },
  { value: "english", label: "영어" },
  { value: "math", label: "수학" },
  { value: "social", label: "사회" },
  { value: "science", label: "과학" },
  { value: "etc", label: "교양" },
];
const STUDY_CATEGORY_OPTIONS: { value: "" | StudyPostCategory; label: string }[] = [
  { value: "", label: "전체" },
  { value: "question", label: "질문" },
  { value: "tip", label: "꿀팁" },
  { value: "share", label: "자료공유" },
];

function StudyBoardHeader({
  gradeFilter,
  subjectFilter,
  categoryFilter,
  onGradeChange,
  onSubjectChange,
  onCategoryChange,
}: {
  gradeFilter: "" | StudyGrade;
  subjectFilter: "" | StudySubjectTag;
  categoryFilter: "" | StudyPostCategory;
  onGradeChange: (v: "" | StudyGrade) => void;
  onSubjectChange: (v: "" | StudySubjectTag) => void;
  onCategoryChange: (v: "" | StudyPostCategory) => void;
}) {
  return (
    <div className="mb-4 space-y-3">
      {/* 안내 배너 — 항상 표시, 닫기 버튼 없음 */}
      <div className="rounded-2xl bg-violet-50/80 px-4 py-3 text-[12.5px] leading-relaxed text-violet-900 ring-1 ring-inset ring-violet-200/70 dark:bg-violet-500/[0.08] dark:text-violet-100/90 dark:ring-violet-400/15">
        📚 혼자 고민하지 마세요! 질문하면 친구들이 답해주고, 꿀팁으로 서로 도움 주고,
        자료공유로 좋은 자료를 함께 나눠요 🤝
      </div>

      {/* 3 행 필터 — 모바일에서는 가로 스크롤 */}
      <div className="space-y-2">
        <FilterRow
          options={STUDY_GRADE_OPTIONS}
          value={gradeFilter}
          onChange={onGradeChange}
        />
        <FilterRow
          options={STUDY_SUBJECT_OPTIONS}
          value={subjectFilter}
          onChange={onSubjectChange}
        />
        <FilterRow
          options={STUDY_CATEGORY_OPTIONS}
          value={categoryFilter}
          onChange={onCategoryChange}
        />
      </div>
    </div>
  );
}

function FilterRow<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value || "_all"}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.12]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// 학습게시판 글 1 개의 [학년] [교과] [종류] 뱃지 묶음 — DefaultList 에서 호출.
function StudyTagBadges({ post }: { post: PostRow }) {
  if (!post.grade && !post.subject_tag && !post.post_category) return null;
  return (
    <span className="mr-1 inline-flex shrink-0 flex-wrap items-center gap-1">
      {post.grade && (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
          {STUDY_GRADE_LABEL[post.grade]}
        </span>
      )}
      {post.subject_tag && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold",
            STUDY_SUBJECT_TAG_STYLE[post.subject_tag],
          )}
        >
          {STUDY_SUBJECT_TAG_LABEL[post.subject_tag]}
        </span>
      )}
      {post.post_category && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold",
            STUDY_POST_CATEGORY_STYLE[post.post_category as StudyPostCategory],
          )}
        >
          {STUDY_POST_CATEGORY_LABEL[post.post_category as StudyPostCategory]}
        </span>
      )}
    </span>
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
                    {/* 학습게시판 태그 뱃지 — 그 외 board 에서는 모두 null 이라 자동으로 미렌더 */}
                    <StudyTagBadges post={post} />
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
                    <NicknameButton
                      userId={post.author?.id ?? null}
                      className="font-medium text-gray-700 dark:text-gray-300"
                    >
                      {displayAuthorNameFor({ boardType: post.board_type, author: post.author })}
                    </NicknameButton>
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

// ── 챌린지 v2 — 카드 목록 / 탭 / 초대 배너 통합 뷰 ────────────
type ChallengeTab = "all" | "official" | "mine";

function ChallengeListView({ currentUserId }: { currentUserId: string | null }) {
  const [tab, setTab] = useState<ChallengeTab>("all");
  const [allChallenges, setAllChallenges] = useState<ChallengeV2[]>([]);
  const [myChallenges, setMyChallenges] = useState<ChallengeV2[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [all, mine, inv] = await Promise.all([
      listChallenges(),
      currentUserId ? listChallenges({ onlyMine: true }) : Promise.resolve([]),
      currentUserId ? getMyPendingInvites() : Promise.resolve([]),
    ]);
    setAllChallenges(all);
    setMyChallenges(mine);
    setInvites(inv);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [all, mine, inv] = await Promise.all([
        listChallenges(),
        currentUserId ? listChallenges({ onlyMine: true }) : Promise.resolve([]),
        currentUserId ? getMyPendingInvites() : Promise.resolve([]),
      ]);
      if (!active) return;
      setAllChallenges(all);
      setMyChallenges(mine);
      setInvites(inv);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [currentUserId]);

  // 정렬: 학생 챌린지 = 참여자수 내림차순, 공식 챌린지 = 카테고리 순서 유지.
  const popularChallenges = allChallenges
    .filter((c) => !c.is_official)
    .sort(
      (a, b) => (b.participant_count ?? 0) - (a.participant_count ?? 0),
    );
  const officialChallenges = allChallenges.filter((c) => c.is_official);

  const inviteCount = invites.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-screen-lg px-4 py-6"
    >
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MobileBackButton />
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            문태 챌린지 🔥
          </h1>
        </div>
        <Link
          href="/board/challenge/create"
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          <PenSquare className="h-4 w-4" />
          챌린지 만들기 ✏️
        </Link>
      </div>

      {/* 초대 배너 */}
      {inviteCount > 0 && (
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="mb-3 flex w-full items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500/15 to-cyan-500/15 px-4 py-3 text-left ring-1 ring-violet-500/30 transition hover:ring-violet-500/60"
        >
          <span className="text-lg">📩</span>
          <span className="flex-1 text-sm font-bold text-violet-700 dark:text-violet-200">
            {inviteCount}개의 챌린지 초대가 있습니다
          </span>
          <span className="text-xs text-violet-500">자세히 보기 →</span>
        </button>
      )}

      {/* 탭 */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {(
          [
            { value: "all", label: "전체" },
            { value: "official", label: "⭐ 공식" },
            { value: "mine", label: "내 챌린지" },
          ] as { value: ChallengeTab; label: string }[]
        ).map((opt) => {
          const active = tab === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTab(opt.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-violet-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "official" ? (
        <ChallengeSection
          title="⭐ 공식 챌린지"
          challenges={officialChallenges}
          official
          emptyText="공식 챌린지가 없어요."
        />
      ) : tab === "mine" ? (
        <ChallengeSection
          title="📌 내 챌린지"
          challenges={myChallenges}
          emptyText="아직 참여하거나 만든 챌린지가 없어요. 첫 번째 챌린지를 만들어보세요! 🎯"
        />
      ) : (
        <div className="space-y-6">
          <ChallengeSection
            title="🔥 인기 챌린지"
            challenges={popularChallenges}
            emptyText="아직 챌린지가 없어요. 첫 번째 챌린지를 만들어보세요! 🎯"
          />
          <ChallengeSection
            title="⭐ 공식 챌린지"
            challenges={officialChallenges}
            official
          />
        </div>
      )}

      {/* 초대 모달 */}
      {showInviteModal && (
        <ChallengeInviteModal
          invites={invites}
          onClose={() => setShowInviteModal(false)}
          onResolved={async () => {
            await reload();
          }}
        />
      )}
    </motion.div>
  );
}

function ChallengeSection({
  title,
  challenges,
  emptyText,
  official,
}: {
  title: string;
  challenges: ChallengeV2[];
  emptyText?: string;
  official?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-extrabold text-gray-800 dark:text-gray-100">
        {title}
      </h2>
      {challenges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center dark:border-white/10 dark:bg-[#16162a]">
          <p className="text-sm text-gray-500 dark:text-gray-300">
            {emptyText ?? "챌린지가 없어요."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => (
            <ChallengeListCard key={c.id} challenge={c} highlightOfficial={!!official} />
          ))}
        </div>
      )}
    </section>
  );
}

function ChallengeListCard({
  challenge,
  highlightOfficial,
}: {
  challenge: ChallengeV2;
  highlightOfficial?: boolean;
}) {
  const tags = parseTags(challenge.description);
  const durationLabel = formatChallengeDuration(challenge);
  const showOfficialBadge = challenge.is_official;
  const useOfficialBorder = highlightOfficial || challenge.is_official;
  const tagDefByKey = new Map(CHALLENGE_TAGS.map((t) => [t.key, t]));

  return (
    <Link
      href={`/board/challenge/${challenge.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl bg-white p-4 transition hover:scale-[1.02] hover:shadow-lg dark:bg-[#16162a]",
        useOfficialBorder
          ? "border-2 border-violet-400 dark:border-violet-500/60"
          : "border border-gray-200 dark:border-white/[0.07]",
      )}
    >
      {/* 상단: 이모지 + 제목 */}
      <div className="flex items-start gap-2">
        <span className="text-3xl leading-none">{challenge.emoji ?? "🔥"}</span>
        <h3 className="line-clamp-2 flex-1 text-base font-bold text-gray-900 dark:text-white">
          {challenge.title}
        </h3>
      </div>

      {/* 중단: 개설자 + 참여자수 */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-gray-500 dark:text-gray-400">
          {challenge.creator?.nickname ?? "(알수없음)"}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-gray-500 dark:text-gray-400">
          <Users className="h-3.5 w-3.5" />
          {challenge.participant_count ?? 0}명 참여 중
        </span>
      </div>

      {/* 태그 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map((key: ChallengeTagKey) => {
            const def = tagDefByKey.get(key);
            if (!def) return null;
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  CHALLENGE_TAG_STYLE[key],
                )}
              >
                <span>{def.emoji}</span>
                <span>{def.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* 하단: 기간 + 공식 뱃지 */}
      <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
          {durationLabel}
        </span>
        {showOfficialBadge && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
            ⭐ 공식
          </span>
        )}
      </div>
    </Link>
  );
}

// ── 초대 응답 모달 ────────────────────────────────────────────
function ChallengeInviteModal({
  invites,
  onClose,
  onResolved,
}: {
  invites: PendingInvite[];
  onClose: () => void;
  onResolved: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState<Record<string, "accept" | "decline" | null>>({});
  const [resolved, setResolved] = useState<Record<string, "accepted" | "declined">>({});

  async function handleRespond(inviteId: string, accept: boolean) {
    setPending((p) => ({ ...p, [inviteId]: accept ? "accept" : "decline" }));
    const { error } = await respondToInvite(inviteId, accept);
    setPending((p) => ({ ...p, [inviteId]: null }));
    if (error) {
      alert(`처리 실패: ${error}`);
      return;
    }
    setResolved((r) => ({ ...r, [inviteId]: accept ? "accepted" : "declined" }));
    await onResolved();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.08] dark:bg-[#16162a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
            챌린지 초대 📩
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto dark:divide-white/[0.05]">
          {invites.map((inv) => {
            const status = resolved[inv.invite.id];
            const busy = pending[inv.invite.id];
            return (
              <li key={inv.invite.id} className="flex items-start gap-3 px-5 py-4">
                <span className="mt-0.5 text-2xl leading-none">
                  {inv.challenge.emoji ?? "🎯"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {inv.challenge.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    @{inv.inviter.nickname}님이 초대했어요
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {status === "accepted" ? (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        ✓ 참여 완료
                      </span>
                    ) : status === "declined" ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500 dark:bg-white/[0.06]">
                        거절됨
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => handleRespond(inv.invite.id, true)}
                          className="inline-flex items-center gap-1 rounded-full bg-violet-500 px-4 py-1 text-xs font-bold text-white transition hover:bg-violet-600 disabled:opacity-50"
                        >
                          {busy === "accept" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          수락
                        </button>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => handleRespond(inv.invite.id, false)}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-4 py-1 text-xs font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.14]"
                        >
                          {busy === "decline" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          거절
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ── 챌린지 — 카테고리 카드 + 카테고리 탭 주간 랭킹 ────────────
const CHALLENGE_CATEGORY_ORDER: ChallengeCategory[] = [
  "attendance",
  "study_cert",
  "exercise",
];

function ChallengeHeader({
  stats,
  currentUserId,
  mySubs,
  joining,
  onToggleJoin,
  onSelectCategory,
  currentCategory,
}: {
  stats: ChallengeStats | null;
  currentUserId: string | null;
  mySubs: ChallengeCategory[];
  joining: ChallengeCategory | null;
  onToggleJoin: (category: ChallengeCategory) => void;
  onSelectCategory: (category: "" | ChallengeCategory) => void;
  currentCategory: "" | ChallengeCategory;
}) {
  const [rankTab, setRankTab] = useState<"" | ChallengeCategory>("");

  return (
    <div className="mb-4 space-y-3">
      {/* 내 참여 현황 — 3개 카테고리 카드 */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          내 참여 현황
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CHALLENGE_CATEGORY_ORDER.map((cat) => {
            const isJoined = mySubs.includes(cat);
            const isLoading = joining === cat;
            const myStreak =
              isJoined && currentUserId && stats
                ? stats.streakByAuthorByCategory[cat][currentUserId] ?? 0
                : 0;
            const participantCount = stats?.participantCounts[cat] ?? 0;
            const isActiveFilter = currentCategory === cat;
            return (
              <div
                key={cat}
                className={cn(
                  "rounded-2xl p-3.5 ring-1 transition",
                  isActiveFilter
                    ? "bg-gradient-to-br from-violet-500/20 to-cyan-500/20 ring-violet-500/40"
                    : isJoined
                    ? "bg-gradient-to-br from-orange-500/10 to-rose-500/10 ring-orange-500/30"
                    : "bg-gray-50 ring-gray-200 dark:bg-white/[0.03] dark:ring-white/10",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectCategory(isActiveFilter ? "" : cat)}
                  className="block w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg",
                        isJoined ? "bg-white dark:bg-white/10" : "bg-gray-100 dark:bg-white/[0.04]",
                      )}
                    >
                      {CHALLENGE_CATEGORY_ICON[cat]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                        {CHALLENGE_CATEGORY_LABEL[cat]}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {participantCount}명 참여 ·{" "}
                        {isJoined ? `🔥 ${myStreak}일 연속` : "참여 전"}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onToggleJoin(cat)}
                  className={cn(
                    "mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                    isJoined
                      ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
                      : "bg-violet-600 text-white hover:bg-violet-700",
                  )}
                >
                  {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {isJoined ? "참여 중 ✓" : "참여하기"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 주간 랭킹 — 카테고리 탭 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/[0.07] dark:bg-[#16162a]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
            <Trophy className="h-3.5 w-3.5" />
            이번 주 챌린지 TOP 5
          </div>
        </div>
        {/* 탭 */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(
            [
              { value: "" as const, label: "전체" },
              ...CHALLENGE_CATEGORY_ORDER.map((c) => ({
                value: c,
                label: `${CHALLENGE_CATEGORY_ICON[c]} ${CHALLENGE_CATEGORY_LABEL[c]}`,
              })),
            ]
          ).map((opt) => {
            const active = rankTab === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setRankTab(opt.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  active
                    ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {(() => {
          const ranking =
            rankTab === ""
              ? stats?.weeklyRanking ?? null
              : stats?.weeklyRankingByCategory[rankTab] ?? null;
          if (stats == null) {
            return (
              <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            );
          }
          if (!ranking || ranking.length === 0) {
            return (
              <p className="px-1 py-2 text-[11px] text-gray-400">
                아직 인증한 사람이 없어요. 1등을 차지해보세요!
              </p>
            );
          }
          return (
            <ol className="space-y-1.5">
              {ranking.map((r, i) => {
                const medal =
                  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
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
          );
        })()}
      </div>
    </div>
  );
}

// ── 챌린지 — 카테고리 필터 탭 (전체/등교/공부/운동) ──────────
function ChallengeCategoryTabs({
  value,
  onChange,
}: {
  value: "" | ChallengeCategory;
  onChange: (v: "" | ChallengeCategory) => void;
}) {
  const opts: { value: "" | ChallengeCategory; label: string }[] = [
    { value: "", label: "전체" },
    ...CHALLENGE_CATEGORY_ORDER.map((c) => ({
      value: c,
      label: `${CHALLENGE_CATEGORY_ICON[c]} ${CHALLENGE_CATEGORY_LABEL[c].replace(" 인증", "")}`,
    })),
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {opts.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
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
  );
}

// ── 챌린지 — 인증 취소 모달 ───────────────────────────────────
function ChallengeRejectModal({
  post,
  onCancel,
  onConfirm,
}: {
  post: PostRow;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.08] dark:bg-[#16162a]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
          이 인증을 취소하시겠습니까?
        </h3>
        <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2">
          {post.title}
        </p>
        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          취소 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="작성자에게 전달될 사유를 입력해주세요"
          rows={4}
          disabled={submitting}
          className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting || !reason.trim()}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(reason.trim());
              setSubmitting(false);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            인증 취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 챌린지 그리드 (인스타 스타일) ────────────────────────────
function ChallengeGrid({
  posts,
  streakByAuthor,
  isStaff,
  onRequestReject,
}: {
  posts: PostRow[];
  streakByAuthor: Record<string, number>;
  isStaff: boolean;
  onRequestReject: (post: PostRow) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {posts.map((post) => (
        <ChallengeCard
          key={post.id}
          post={post}
          streak={streakByAuthor[post.author_id] ?? 0}
          isStaff={isStaff}
          onRequestReject={onRequestReject}
        />
      ))}
    </div>
  );
}

/** 연속일수 뱃지 색상 — 1-6 주황 / 7-13 빨강 / 14-29 보라 / 30+ 금색 */
function streakBadgeStyle(streak: number): { bg: string; emoji: string } {
  if (streak >= 30) return { bg: "bg-amber-400/95 text-gray-900", emoji: "👑" };
  if (streak >= 14) return { bg: "bg-violet-500/90 text-white", emoji: "💜" };
  if (streak >= 7) return { bg: "bg-red-500/90 text-white", emoji: "🔥" };
  return { bg: "bg-orange-500/90 text-white", emoji: "🔥" };
}

function ChallengeCard({
  post,
  streak,
  isStaff,
  onRequestReject,
}: {
  post: PostRow;
  streak: number;
  isStaff: boolean;
  onRequestReject: (post: PostRow) => void;
}) {
  const isRejected = post.challenge_status === "rejected";
  const cat = (post.post_category as ChallengeCategory | null) ?? null;
  const badge = streakBadgeStyle(streak);

  return (
    <div
      className={cn(
        "group relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.04]",
        isRejected && "opacity-60",
      )}
    >
      <Link
        href={`/board/challenge/${post.id}`}
        className="block h-full w-full"
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

        {/* 카테고리 아이콘 뱃지 — 좌상단 */}
        {cat && (
          <span
            className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-base shadow ring-1 ring-inset ring-white/40 backdrop-blur-sm dark:bg-black/60"
            aria-label={CHALLENGE_CATEGORY_LABEL[cat]}
            title={CHALLENGE_CATEGORY_LABEL[cat]}
          >
            {CHALLENGE_CATEGORY_ICON[cat]}
          </span>
        )}

        {/* 연속일수 뱃지 (3일 이상) — 카테고리 뱃지 아래쪽으로 */}
        {streak >= 3 && (
          <span
            className={cn(
              "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-white/20 backdrop-blur-sm",
              badge.bg,
            )}
          >
            {badge.emoji} {streak}일
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

      {/* 인증 취소 오버레이 */}
      {isRejected && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
          <div className="rounded-lg bg-red-600/95 px-3 py-1.5 text-center">
            <p className="text-[11px] font-extrabold text-white">인증 취소됨</p>
            {post.challenge_rejected_reason && (
              <p className="mt-0.5 line-clamp-2 max-w-[10rem] text-[10px] text-white/85">
                {post.challenge_rejected_reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 관리자 — 인증 취소 버튼 (rejected 가 아닐 때만) */}
      {isStaff && !isRejected && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRequestReject(post);
          }}
          aria-label="인증 취소"
          title="인증 취소"
          className="absolute right-2 bottom-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── "누구일까요?" 카드 그리드 — 인스타 스타일 ────────────────
function GuessWhoGrid({ posts }: { posts: PostRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {posts.map((post) => (
        <GuessWhoCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function GuessWhoCard({ post }: { post: PostRow }) {
  const isResolved = post.status === "resolved";
  const nickname = post.author?.nickname ?? "익명";
  return (
    <Link
      href={`/board/guess_who/${post.id}`}
      className="group relative block overflow-hidden rounded-xl bg-gray-100 ring-1 ring-inset ring-black/5 transition-all hover:scale-[1.02] hover:shadow-lg dark:bg-white/[0.04] dark:ring-white/[0.06]"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 p-3 text-white">
            <span className="text-3xl">🎭</span>
            <span className="line-clamp-3 text-center text-[11px] font-bold leading-tight">
              {post.title}
            </span>
          </div>
        )}

        {/* 정답 공개 뱃지 */}
        {isResolved && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow ring-1 ring-inset ring-white/30 backdrop-blur-sm">
            ✅ 정답 공개
          </span>
        )}

        {/* 댓글 수 — 우상단 */}
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
          <MessageSquare className="h-3 w-3" />
          {post.comment_count}
        </span>

        {/* 닉네임 + 시간 오버레이 */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-2 pt-6">
          <p className="line-clamp-1 text-[12px] font-semibold text-white drop-shadow">
            {nickname}
          </p>
          <p className="text-[10px] text-white/85 drop-shadow">
            {relativeTime(post.created_at)}
          </p>
        </div>
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

// ── 구 스터디 모집 카드 그리드 — 신규 학습게시판 도입으로 제거 ─────
// 23 마이그레이션 이후 study 게시판은 DefaultList + 학습 태그 뱃지로 표시.
// 잔존 legacy 7 글은 동일하게 DefaultList 에서 제목만 노출 (태그 컬럼 NULL).

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
      message: "아직 등록된 글이 없습니다",
      hint: canWrite ? "질문·꿀팁·자료공유 글을 첫 번째로 올려보세요!" : undefined,
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
