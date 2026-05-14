"use client";

// 글 쓰기 / 수정 본체 — page.tsx 와 분리한 이유:
//   Next.js App Router 의 page.tsx 는 default + 일부 named export 만 허용한다.
//   /board/challenge/write 라우트는 literal `challenge/` 디렉토리에 묻혀 있어
//   /board/[boardType]/write 가 아니라 /board/challenge/[challengeId] 로 풀린다 (challengeId="write").
//   따라서 challenge 전용 write 라우트를 추가해야 했고, 두 라우트가 공유할
//   `BoardWriteShell` 컴포넌트를 page.tsx 에서 export 하려 했더니
//   "page" 모듈 시그니처를 어겨 빌드 실패. 그래서 본체를 이 파일로 옮겼다.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  FileText,
  Loader2,
  Lock,
  MapPin,
  CalendarDays,
  GraduationCap,
  PlayCircle,
  X,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  ALUMNI_CATEGORIES,
  ALUMNI_YEARS,
  ATTENDANCE_DEADLINE_HOUR,
  ATTENDANCE_DEADLINE_MINUTE,
  BOARD_LABEL,
  CAREER_TRACKS,
  CHALLENGE_CATEGORY_ICON,
  CHALLENGE_CATEGORY_LABEL,
  MARKET_CONDITION_LABEL,
  QA_SUBJECTS,
  RESOURCE_CATEGORIES,
  YOUTUBE_CATEGORIES,
  createPost,
  extractYoutubeId,
  getMyChallengeSubs,
  getPost,
  parseAlumniContent,
  parseIssueContent,
  parseLostContent,
  parseMarketContent,
  parseQaContent,
  parseResourceContent,
  parseSeniorContent,
  parseStudyContent,
  parseTeacherTipContent,
  parseYoutubeContent,
  stringifyAlumniContent,
  stringifyIssueContent,
  stringifyLostContent,
  stringifyMarketContent,
  stringifyQaContent,
  stringifyResourceContent,
  stringifySeniorContent,
  stringifyTeacherTipContent,
  stringifyYoutubeContent,
  updatePost,
  STUDY_GRADE_LABEL,
  STUDY_POST_CATEGORY_LABEL,
  STUDY_SUBJECT_TAG_LABEL,
  TEACHER_TIP_SUBJECT_LABEL,
  type AlumniCategory,
  type BoardType,
  type CareerTrack,
  type ChallengeCategory,
  type MarketCondition,
  type QaSubject,
  type ResourceCategory,
  type StudyGrade,
  type StudyPostCategory,
  type StudySubjectTag,
  type TeacherTipSubject,
  type YoutubeCategory,
} from "@/lib/board";
import { cn } from "@/lib/utils";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { notifyNewPost } from "@/lib/notify";
import {
  formatFileSize,
  uploadFile,
  uploadImage,
  validatePdfFile,
} from "@/lib/storage";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

/** KST 기준 등교 인증 마감 시각(08:10)을 지났는지 */
function isAttendanceClosed(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  return (
    h > ATTENDANCE_DEADLINE_HOUR ||
    (h === ATTENDANCE_DEADLINE_HOUR && m > ATTENDANCE_DEADLINE_MINUTE)
  );
}

/**
 * 외부 라우트(/board/challenge/write 등)에서 boardType 을 직접 주입해 쓰는 케이스 지원.
 * Next.js 가 literal `challenge/` 디렉토리를 우선 매칭하기 때문에
 * /board/challenge/write 는 /board/[boardType]/write 로 풀리지 않는다.
 * 따라서 challenge 전용 write 라우트를 따로 두고 boardType 을 prop 으로 전달한다.
 */
export function BoardWriteShell({
  boardTypeOverride,
}: {
  boardTypeOverride?: BoardType;
}) {
  return (
    <AuthGate
      title="글쓰기는 로그인이 필요합니다"
      description="로그인 후 글을 작성하실 수 있어요."
    >
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        }
      >
        <WriteInner boardTypeOverride={boardTypeOverride} />
      </Suspense>
    </AuthGate>
  );
}

function WriteInner({
  boardTypeOverride,
}: {
  boardTypeOverride?: BoardType;
}) {
  const params = useParams<{ boardType: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const boardType = (boardTypeOverride ?? (params.boardType as BoardType));
  const editId = search.get("id");
  // 챌린지 인증 — 특정 챌린지 ID 가 쿼리에 있으면 그 챌린지에 귀속.
  const challengeIdParam = search.get("challengeId");
  const [challengeContext, setChallengeContext] = useState<{
    id: string;
    title: string;
    emoji: string | null;
    category: ChallengeCategory | null;
  } | null>(null);

  const { user, profile, loading: profileLoading } = useSupabaseProfile();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // 분실물 전용 필드 — content 에 JSON 으로 합쳐 저장
  const [lostLocation, setLostLocation] = useState("");
  const [lostDate, setLostDate] = useState("");
  // 나눔장터 전용
  const [marketCondition, setMarketCondition] = useState<MarketCondition>("good");
  // 이슈토론 전용
  const [optionA, setOptionA] = useState("찬성");
  const [optionB, setOptionB] = useState("반대");
  // 학습 Q&A 전용 — 과목 태그
  const [qaSubject, setQaSubject] = useState<QaSubject>("etc");
  // 문튜브 전용
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeCategory, setYoutubeCategory] = useState<YoutubeCategory>("etc");
  // 자료실 전용 — 카테고리
  const [resourceCategory, setResourceCategory] = useState<ResourceCategory>("study");
  // 신규 학습게시판 전용 — 학년 / 교과 / 글 종류. 모두 필수, 미선택 시 작성 불가.
  // 구 스터디 모집 양식(과목/모집인원/시간대/장소) 은 023 마이그레이션 이후 폐기됨.
  const [studyGrade, setStudyGrade] = useState<StudyGrade | "">("");
  const [studySubjectTag, setStudySubjectTag] = useState<StudySubjectTag | "">("");
  const [studyPostCategory, setStudyPostCategory] = useState<StudyPostCategory | "">("");
  // 쌤 꿀팁 공유 — 교과 (필수) + "직접입력(etc)" 일 때만 customSubject 추가 입력.
  const [teacherTipSubject, setTeacherTipSubject] = useState<TeacherTipSubject | "">("");
  const [teacherTipCustomSubject, setTeacherTipCustomSubject] = useState("");
  // 챌린지 전용 — 카테고리 (등교/공부/운동) 필수. 참여 중인 카테고리만 선택 가능.
  const [challengeCategory, setChallengeCategory] = useState<ChallengeCategory | "">("");
  const [myChallengeSubs, setMyChallengeSubs] = useState<ChallengeCategory[]>([]);
  // 졸업생(선배에게 물어봐) 전용
  const [alumniCategory, setAlumniCategory] =
    useState<AlumniCategory>("college-life");
  const [alumniUniversity, setAlumniUniversity] = useState("");
  const [alumniMajor, setAlumniMajor] = useState("");
  const [alumniYear, setAlumniYear] = useState<number>(
    ALUMNI_YEARS[0] ?? new Date().getFullYear(),
  );
  // 진로 탐색 로드맵(선배 인터뷰) 전용
  const [seniorTrack, setSeniorTrack] = useState<CareerTrack>("science");
  const [seniorUniversity, setSeniorUniversity] = useState("");
  const [seniorMajor, setSeniorMajor] = useState("");
  const [seniorYear, setSeniorYear] = useState<number>(
    ALUMNI_YEARS[0] ?? new Date().getFullYear(),
  );
  const [seniorSummary, setSeniorSummary] = useState("");
  // 이미지 상태 — 새로 고른 파일은 imageFile, 미리보기는 imagePreview, 수정 모드 시작 시 원본은 originalImageUrl
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // PDF 첨부 상태 — 새 파일은 pdfFile, 표시명은 pdfDisplayName, 수정 모드 시작 시 원본은 originalFileUrl
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDisplayName, setPdfDisplayName] = useState<string | null>(null);
  const [pdfDisplaySize, setPdfDisplaySize] = useState<number | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  // 수정 모드: 기존 글 로드
  useEffect(() => {
    if (!editId) return;
    let active = true;
    setLoadingExisting(true);
    getPost(editId).then((post) => {
      if (!active || !post) return;
      setTitle(post.title);
      // 게시판별 JSON 본문을 필드별로 분해
      if (post.board_type === "lost") {
        const parsed = parseLostContent(post.content);
        setLostLocation(parsed.location);
        setLostDate(parsed.lostDate);
        setContent(parsed.description);
      } else if (post.board_type === "market") {
        const parsed = parseMarketContent(post.content);
        setMarketCondition(parsed.condition);
        setContent(parsed.description);
      } else if (post.board_type === "debate") {
        const parsed = parseIssueContent(post.content);
        setOptionA(parsed.optionA);
        setOptionB(parsed.optionB);
        setContent(parsed.description);
      } else if (post.board_type === "qa") {
        const parsed = parseQaContent(post.content);
        setQaSubject(parsed.subject);
        setContent(parsed.question);
      } else if (post.board_type === "youtube") {
        const parsed = parseYoutubeContent(post.content);
        setYoutubeUrl(parsed.youtubeUrl);
        setYoutubeCategory(parsed.category);
        setContent(parsed.description);
      } else if (post.board_type === "resources") {
        const parsed = parseResourceContent(post.content);
        setResourceCategory(parsed.category);
        setContent(parsed.description);
      } else if (post.board_type === "study") {
        // 신규 학습게시판: content 는 plain text, 태그는 별도 컬럼.
        // legacy 글(JSON content) 은 parseStudyContent 가 description 만 안전하게 추출 → 자연스럽게 plain 으로 보임.
        // 단, 태그 컬럼이 모두 null 이라 새 양식에 맞춰 다시 선택해야 저장 가능.
        const looksLegacy = post.content.trim().startsWith("{");
        if (looksLegacy) {
          const parsed = parseStudyContent(post.content);
          setContent(parsed.description);
        } else {
          setContent(post.content);
        }
        if (post.grade) setStudyGrade(post.grade);
        // subject_tag 타입이 study/teacher_tip 두 보드 공용으로 넓어져 캐스팅 필요.
        // 이 분기는 board_type === "study" 이므로 StudySubjectTag 만 들어옴.
        if (post.subject_tag) {
          setStudySubjectTag(post.subject_tag as StudySubjectTag);
        }
        // post_category 는 챌린지와 공유 컬럼이라 union 타입 — study 분기에서는 항상 StudyPostCategory.
        if (post.post_category) {
          setStudyPostCategory(post.post_category as StudyPostCategory);
        }
      } else if (post.board_type === "teacher_tip") {
        // 쌤 꿀팁: subject_tag 컬럼 + content JSON (customSubject, description)
        const parsed = parseTeacherTipContent(post.content);
        setContent(parsed.description);
        setTeacherTipCustomSubject(parsed.customSubject);
        if (post.subject_tag) {
          setTeacherTipSubject(post.subject_tag as TeacherTipSubject);
        }
      } else if (post.board_type === "challenge") {
        // 챌린지: 카테고리는 post_category 컬럼에 저장됨.
        if (post.post_category) {
          setChallengeCategory(post.post_category as ChallengeCategory);
        }
        setContent(post.content);
      } else if (post.board_type === "alumni") {
        const parsed = parseAlumniContent(post.content);
        setAlumniCategory(parsed.category);
        setAlumniUniversity(parsed.university);
        setAlumniMajor(parsed.major);
        setAlumniYear(parsed.graduationYear);
        setContent(parsed.description);
      } else if (post.board_type === "senior") {
        const parsed = parseSeniorContent(post.content);
        setSeniorTrack(parsed.track);
        setSeniorUniversity(parsed.university);
        setSeniorMajor(parsed.major);
        setSeniorYear(parsed.graduationYear);
        setSeniorSummary(parsed.summary);
        setContent(parsed.review);
      } else {
        setContent(post.content);
      }
      setOriginalImageUrl(post.image_url);
      setImagePreview(post.image_url);
      setOriginalFileUrl(post.file_url);
      setOriginalFileName(post.file_name);
      setPdfDisplayName(post.file_name);
      setLoadingExisting(false);
    });
    return () => {
      active = false;
    };
  }, [editId]);

  // 컴포넌트 언마운트 또는 새 파일 선택 시 이전 object URL 메모리 해제
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 챌린지 글쓰기 시 — 내 참여 카테고리 fetch
  useEffect(() => {
    if (boardType !== "challenge") return;
    let active = true;
    getMyChallengeSubs().then((subs) => {
      if (active) setMyChallengeSubs(subs);
    });
    return () => {
      active = false;
    };
  }, [boardType]);

  // 챌린지 v2 — challengeId 쿼리가 있으면 챌린지 정보 로드 + 카테고리 자동 설정
  useEffect(() => {
    if (boardType !== "challenge" || !challengeIdParam) return;
    let active = true;
    import("@/lib/challenge").then(({ getChallenge }) => {
      getChallenge(challengeIdParam).then((c) => {
        if (!active || !c) return;
        const cat: ChallengeCategory | null =
          c.category === "custom"
            ? null
            : (c.category as ChallengeCategory);
        setChallengeContext({
          id: c.id,
          title: c.title,
          emoji: c.emoji,
          category: cat,
        });
        if (cat) setChallengeCategory(cat);
      });
    });
    return () => {
      active = false;
    };
  }, [boardType, challengeIdParam]);

  if (!VALID_BOARDS.includes(boardType)) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center text-sm text-gray-500">
        존재하지 않는 게시판입니다.
      </div>
    );
  }

  if (profileLoading || loadingExisting) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-violet-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10 text-center">
        <p className="text-sm text-gray-500">먼저 닉네임과 역할을 설정해주세요.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
        >
          대시보드로 이동
        </Link>
      </div>
    );
  }

  // 관리자/교사만 작성 가능한 게시판: 공지사항·대입정보·교육과정·문튜브·자료실·뉴스
  const role = profile.role as string;
  const ADMIN_ONLY: BoardType[] = [
    "notice",
    "college",
    "curriculum",
    "youtube",
    "resources",
    "news",
  ];
  if (
    ADMIN_ONLY.includes(boardType) &&
    role !== "admin" &&
    role !== "teacher"
  ) {
    const messages: Partial<Record<BoardType, string>> = {
      notice: "공지사항은 관리자만 작성할 수 있습니다",
      college: "대입정보는 관리자/교사만 작성할 수 있습니다",
      curriculum: "교육과정 가이드는 관리자/교사만 작성할 수 있습니다",
      youtube: "문튜브는 관리자/교사만 영상을 추가할 수 있습니다",
      resources: "자료실은 관리자/교사만 자료를 등록할 수 있습니다",
      news: "문태뉴스는 관리자/교사만 작성할 수 있습니다",
    };
    return (
      <div className="mx-auto max-w-screen-md px-4 py-10">
        <Link
          href={`/board/${boardType}`}
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {BOARD_LABEL[boardType]}로 돌아가기
        </Link>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.07] dark:bg-[#16162a]">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-violet-500/15 text-violet-500 dark:text-violet-300">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {messages[boardType] ?? "관리자만 작성할 수 있습니다"}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            안내자료는 학교/교사 측에서 등록합니다. 일반 게시글은 자유게시판을
            이용해주세요.
          </p>
          <Link
            href="/board/free"
            className="mt-5 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
          >
            자유게시판으로 이동
          </Link>
        </div>
      </div>
    );
  }

  const isChallenge = boardType === "challenge";
  const isLost = boardType === "lost";
  const isMarket = boardType === "market";
  const isIssue = boardType === "debate";
  const isQa = boardType === "qa";
  const isYoutube = boardType === "youtube";
  const isResources = boardType === "resources";
  const isStudy = boardType === "study";
  const isTeacherTip = boardType === "teacher_tip";
  const isAlumni = boardType === "alumni";
  const isSenior = boardType === "senior";
  const isGuessWho = boardType === "guess_who";

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 이전 object URL 정리
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    const objUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(objUrl);
    setError(null);
  }

  function handleImageRemove() {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validatePdfFile(file);
    if (validation) {
      setError(validation.message);
      // input 초기화 — 같은 파일 다시 고를 수 있게
      e.target.value = "";
      return;
    }
    setPdfFile(file);
    setPdfDisplayName(file.name);
    setPdfDisplaySize(file.size);
    setError(null);
  }

  function handlePdfRemove() {
    setPdfFile(null);
    setPdfDisplayName(null);
    setPdfDisplaySize(null);
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!content.trim() && !isGuessWho) {
      setError("내용을 입력해주세요.");
      return;
    }
    // 챌린지는 이미지 필수 — 새 파일이거나 기존 이미지가 있어야 함
    if (isChallenge && !imageFile && !imagePreview) {
      setError("챌린지 게시판은 인증샷 이미지가 필요해요.");
      return;
    }
    // "누구일까요?" 도 사진 필수
    if (isGuessWho && !imageFile && !imagePreview) {
      setError("내 사진을 올려주세요!");
      return;
    }
    // 챌린지는 카테고리 필수 (단, 학생 개설 챌린지(custom)는 카테고리 자동 처리되므로 예외)
    if (isChallenge && !challengeCategory && !challengeContext) {
      setError("챌린지 카테고리를 선택해주세요.");
      return;
    }
    // 등교 인증은 KST 08:10 까지만
    if (isChallenge && challengeCategory === "attendance" && isAttendanceClosed()) {
      setError(
        `등교 인증 시간이 지났습니다 (오전 ${ATTENDANCE_DEADLINE_HOUR}:${String(ATTENDANCE_DEADLINE_MINUTE).padStart(2, "0")}까지).`,
      );
      return;
    }
    if (isLost && !lostLocation.trim()) {
      setError("분실 장소를 입력해주세요.");
      return;
    }
    if (isIssue && (!optionA.trim() || !optionB.trim())) {
      setError("선택지 두 개를 모두 입력해주세요.");
      return;
    }
    if (isYoutube) {
      const id = extractYoutubeId(youtubeUrl);
      if (!id) {
        setError("유효한 YouTube URL 또는 11자리 영상 ID 를 입력해주세요.");
        return;
      }
    }
    if (isStudy) {
      // 신규 학습게시판은 학년·교과·글 종류 3 개 모두 필수.
      if (!studyGrade) {
        setError("학년을 선택해주세요.");
        return;
      }
      if (!studySubjectTag) {
        setError("교과를 선택해주세요.");
        return;
      }
      if (!studyPostCategory) {
        setError("글 종류를 선택해주세요.");
        return;
      }
    }
    if (isTeacherTip) {
      if (!teacherTipSubject) {
        setError("교과를 선택해주세요.");
        return;
      }
      if (teacherTipSubject === "etc" && !teacherTipCustomSubject.trim()) {
        setError("교과명을 직접 입력해주세요.");
        return;
      }
    }
    if (isSenior) {
      if (!seniorUniversity.trim()) {
        setError("대학명을 입력해주세요.");
        return;
      }
      if (!seniorMajor.trim()) {
        setError("학과명을 입력해주세요.");
        return;
      }
      if (!seniorSummary.trim()) {
        setError("한줄 요약을 입력해주세요.");
        return;
      }
    }
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }

    // 게시판별 본문 직렬화
    const finalContent = isLost
      ? stringifyLostContent({
          location: lostLocation,
          lostDate,
          description: content,
        })
      : isMarket
      ? stringifyMarketContent({
          condition: marketCondition,
          description: content,
        })
      : isIssue
      ? stringifyIssueContent({
          description: content,
          optionA,
          optionB,
        })
      : isQa
      ? stringifyQaContent({
          subject: qaSubject,
          question: content,
        })
      : isYoutube
      ? stringifyYoutubeContent({
          category: youtubeCategory,
          youtubeUrl,
          videoId: extractYoutubeId(youtubeUrl) ?? "",
          description: content,
        })
      : isResources
      ? stringifyResourceContent({
          category: resourceCategory,
          description: content,
        })
      : isStudy
      // 신규 학습게시판은 본문을 plain text 로 저장. 학년/교과/글 종류는 별도 컬럼으로.
      ? content.trim()
      : isTeacherTip
      // 쌤 꿀팁: subject_tag 컬럼 + content JSON (customSubject, description)
      ? stringifyTeacherTipContent({
          customSubject:
            teacherTipSubject === "etc" ? teacherTipCustomSubject : "",
          description: content,
        })
      : isAlumni
      ? stringifyAlumniContent({
          category: alumniCategory,
          university: alumniUniversity,
          major: alumniMajor,
          graduationYear: alumniYear,
          description: content,
        })
      : isSenior
      ? stringifySeniorContent({
          track: seniorTrack,
          university: seniorUniversity,
          major: seniorMajor,
          graduationYear: seniorYear,
          summary: seniorSummary,
          review: content,
        })
      : content.trim();

    // 1) 이미지/PDF 업로드 — 새 파일이 있으면 업로드, 없으면 기존 값 유지/제거
    let imageUrl: string | null = originalImageUrl;
    let fileUrl: string | null = originalFileUrl;
    let fileName: string | null = originalFileName;

    if (imageFile || pdfFile) setUploading(true);

    if (imageFile) {
      const url = await uploadImage(imageFile, user.id);
      if (!url) {
        // TODO(임시): 업로드 실패 원인 파악용 로그. uploadImage 내부에서도 console.error 가
        // 찍히지만, 호출부 컨텍스트(어떤 게시판/유저/파일이 실패했는지) 도 같이 보고 싶어 추가.
        console.error("[write] 이미지 업로드 실패", {
          boardType,
          userId: user.id,
          fileName: imageFile.name,
          fileType: imageFile.type,
          fileSize: imageFile.size,
        });
        setUploading(false);
        setError("이미지 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      imageUrl = url;
    } else if (imagePreview === null) {
      imageUrl = null;
    }

    if (pdfFile) {
      const result = await uploadFile(pdfFile, user.id);
      if (!result) {
        setUploading(false);
        setError("PDF 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      fileUrl = result.url;
      fileName = result.fileName;
    } else if (pdfDisplayName === null) {
      // 사용자가 기존 PDF 를 제거했고 새 파일도 안 골랐을 때
      fileUrl = null;
      fileName = null;
    }

    setUploading(false);
    setSubmitting(true);

    console.log("[write] 저장 시도", {
      authUserId: user.id,
      profileId: profile?.id,
      boardType,
      editId,
      imageUrl,
      fileUrl,
      fileName,
    });

    if (editId) {
      const { error: e } = await updatePost(editId, {
        title: title.trim(),
        content: finalContent,
        imageUrl,
        fileUrl,
        fileName,
        // 학습게시판만 태그 컬럼 포함, 챌린지는 post_category 만 갱신, 그 외는 undefined → 변경 없음.
        ...(isStudy
          ? {
              grade: (studyGrade || null) as StudyGrade | null,
              subjectTag: (studySubjectTag || null) as StudySubjectTag | null,
              postCategory: (studyPostCategory || null) as StudyPostCategory | null,
            }
          : isTeacherTip
          ? {
              subjectTag: (teacherTipSubject || null) as TeacherTipSubject | null,
            }
          : isChallenge
          ? {
              postCategory: (challengeCategory || null) as ChallengeCategory | null,
            }
          : {}),
      });
      setSubmitting(false);
      if (e) {
        setError(`수정 실패: ${e}`);
        return;
      }
      // 챌린지 인증 글 수정 후에는 챌린지 상세로. (나머지 게시판은 글 상세로)
      // /board/challenge/{postId} 는 challengeId 라우트와 충돌하므로 별도 경로 사용.
      if (isChallenge && challengeIdParam) {
        router.push(`/board/challenge/${challengeIdParam}`);
      } else if (isChallenge) {
        router.push(`/board/challenge/post/${editId}`);
      } else {
        router.push(`/board/${boardType}/${editId}`);
      }
    } else {
      const result = await createPost({
        authorId: user.id,
        boardType,
        title: title.trim(),
        content: finalContent,
        imageUrl,
        fileUrl,
        fileName,
        // 학습게시판은 입력값 그대로, 다른 board 는 undefined → DB 단에서 NULL.
        grade: isStudy ? ((studyGrade || null) as StudyGrade | null) : undefined,
        // subject_tag — study / teacher_tip 둘 다 사용 (같은 컬럼). board_type 분기로 의미 구분.
        subjectTag: isStudy
          ? ((studySubjectTag || null) as StudySubjectTag | null)
          : isTeacherTip
          ? ((teacherTipSubject || null) as TeacherTipSubject | null)
          : undefined,
        postCategory: isStudy
          ? ((studyPostCategory || null) as StudyPostCategory | null)
          : undefined,
        // 챌린지: 카테고리는 createPost 내부에서 post_category 컬럼으로 저장.
        challengeCategory: isChallenge
          ? ((challengeCategory || null) as ChallengeCategory | null)
          : undefined,
        // 챌린지 v2 — 학생이 만든 챌린지의 인증이면 challenge_id 연결
        challengeId: isChallenge ? challengeIdParam : undefined,
      });
      setSubmitting(false);
      if (result.error || !result.id) {
        const parts = [
          result.error ?? "알 수 없는 오류",
          result.code ? `code=${result.code}` : null,
          result.hint ? `hint=${result.hint}` : null,
        ].filter(Boolean);
        setError(`저장 실패: ${parts.join(" / ")}`);
        return;
      }

      // 게시판별 새 글 알림 (최대 500명, 해당 카테고리 토글 켠 사람만).
      // boardType → 알림 키 매핑은 notify.ts 의 getBoardNotificationKey 가 담당.
      // 매핑에 없는 boardType 은 내부에서 스킵하므로 분기 없이 항상 호출.
      // 이동을 막지 않도록 await 하지 않음 — fire-and-forget.
      console.log("[WriteShell] notifyNewPost 호출:", {
        boardType,
        postId: result.id,
      });
      notifyNewPost({
        postId: result.id,
        title: title.trim(),
        authorId: user.id,
        boardType,
      });

      // 챌린지 인증은 챌린지 상세 페이지(/board/challenge/{challengeId})로 복귀.
      // /board/challenge/{postId} 는 [challengeId] 라우트와 충돌해서 작동하지 않으므로
      // challengeId 가 있으면 챌린지 상세로 보내고, 없으면 별도 인증 글 상세 라우트로.
      if (isChallenge && challengeIdParam) {
        router.push(`/board/challenge/${challengeIdParam}`);
      } else if (isChallenge) {
        router.push(`/board/challenge/post/${result.id}`);
      } else {
        router.push(`/board/${boardType}/${result.id}`);
      }
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
        {BOARD_LABEL[boardType]}로 돌아가기
      </Link>
      <h1 className="mt-2 text-xl font-extrabold text-gray-900 dark:text-white">
        {editId ? "글 수정" : "새 글 작성"}
      </h1>

      <div className="mt-5 space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]">
        {isChallenge && challengeContext && (
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-cyan-500/10 px-4 py-3 ring-1 ring-violet-500/30 dark:from-violet-500/15 dark:to-cyan-500/15">
            <span className="text-2xl">{challengeContext.emoji ?? "🔥"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">
                챌린지 인증
              </p>
              <p className="line-clamp-1 text-sm font-extrabold text-gray-900 dark:text-white">
                {challengeContext.title} 인증하기
              </p>
            </div>
          </div>
        )}
        {isChallenge && !challengeContext && (
          <ChallengeCategoryPicker
            value={challengeCategory}
            onChange={setChallengeCategory}
            mySubs={myChallengeSubs}
            disabled={submitting}
          />
        )}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            {isIssue ? "토론 주제" : isQa ? "질문 제목" : isGuessWho ? "힌트 (제목)" : "제목"}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isIssue
                ? "예) 야자 시간 자유롭게 선택할 수 있게 해야 한다"
                : isQa
                ? "예) 함수의 극한 lim 풀이 도와주세요"
                : isGuessWho
                ? "힌트를 적어주세요! (예: 2학년, 축구를 좋아해요)"
                : "제목을 입력해주세요"
            }
            maxLength={100}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </div>

        {isMarket && (
          <>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/15 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <Camera className="h-3.5 w-3.5" />
                사진을 올리면 나눔이 빨라져요!
              </div>
              <p className="mt-0.5 opacity-80">
                물품 사진을 첨부하면 받아갈 사람이 빨리 나타납니다.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                물품 상태
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(Object.keys(MARKET_CONDITION_LABEL) as MarketCondition[]).map(
                  (key) => {
                    const active = marketCondition === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMarketCondition(key)}
                        disabled={submitting}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50",
                          active
                            ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                        )}
                      >
                        {MARKET_CONDITION_LABEL[key]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </>
        )}

        {isYoutube && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                카테고리 (필수)
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {YOUTUBE_CATEGORIES.map((c) => {
                  const active = youtubeCategory === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setYoutubeCategory(c.value)}
                      disabled={submitting}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-50",
                        active
                          ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-300"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                      )}
                    >
                      <span className="text-base leading-none">{c.emoji}</span>
                      <span className="text-[12px]">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              <PlayCircle className="h-3 w-3 text-red-500" />
              YouTube URL (필수)
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={submitting}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              youtu.be / watch?v= / shorts / embed 어떤 형식이든 OK. 영상 ID 만
              입력해도 됩니다.
            </p>
            {/* 미리보기 — 유효한 ID 추출되면 썸네일 보여주기 */}
            {(() => {
              const id = extractYoutubeId(youtubeUrl);
              if (!id) return null;
              return (
                <div className="mt-3 inline-block overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
                    alt="YouTube 썸네일 미리보기"
                    className="block h-32 w-auto"
                  />
                </div>
              );
            })()}
            </div>
          </div>
        )}

        {isResources && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              카테고리 (필수)
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {RESOURCE_CATEGORIES.map((c) => {
                const active = resourceCategory === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setResourceCategory(c.value)}
                    disabled={submitting}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50",
                      active
                        ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              자료실은 PDF 첨부가 핵심이에요. 아래 PDF 첨부 영역에서 파일을
              올려주세요.
            </p>
          </div>
        )}

        {isStudy && (
          // 신규 학습게시판: 학년 / 교과 / 글 종류 3 개 모두 필수.
          // 미선택은 "" 으로 보관, 제출 직전 검증에서 한국어 안내 메시지 노출.
          <div className="grid gap-3 sm:grid-cols-3">
            <StudyTagPicker
              label="학년 (필수)"
              value={studyGrade}
              onChange={(v) => setStudyGrade(v as StudyGrade | "")}
              // "전체" = 학년 무관 글 (예: 수능 일반 질문). 목록 필터의 "전체"(모두 보기)와는 의미가 다름.
              options={(["all", "1", "2", "3"] as StudyGrade[]).map((g) => ({
                value: g,
                label: STUDY_GRADE_LABEL[g],
              }))}
              disabled={submitting}
            />
            <StudyTagPicker
              label="교과 (필수)"
              value={studySubjectTag}
              onChange={(v) => setStudySubjectTag(v as StudySubjectTag | "")}
              options={(
                ["korean", "english", "math", "social", "science", "etc"] as StudySubjectTag[]
              ).map((s) => ({ value: s, label: STUDY_SUBJECT_TAG_LABEL[s] }))}
              disabled={submitting}
              wide
            />
            <StudyTagPicker
              label="글 종류 (필수)"
              value={studyPostCategory}
              onChange={(v) => setStudyPostCategory(v as StudyPostCategory | "")}
              options={(["question", "tip", "share"] as StudyPostCategory[]).map((c) => ({
                value: c,
                label: STUDY_POST_CATEGORY_LABEL[c],
              }))}
              disabled={submitting}
            />
          </div>
        )}

        {isTeacherTip && (
          // 쌤 꿀팁 공유: 교과 1 개 필수. "직접입력(etc)" 선택 시 자유 입력 필드 추가.
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                교과 (필수)
              </label>
              <select
                value={teacherTipSubject}
                onChange={(e) =>
                  setTeacherTipSubject(e.target.value as TeacherTipSubject | "")
                }
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                <option value="">교과를 선택해주세요</option>
                {(Object.keys(TEACHER_TIP_SUBJECT_LABEL) as TeacherTipSubject[]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {TEACHER_TIP_SUBJECT_LABEL[k]}
                    </option>
                  ),
                )}
              </select>
            </div>
            {teacherTipSubject === "etc" && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  교과명 직접 입력 (필수)
                </label>
                <input
                  type="text"
                  value={teacherTipCustomSubject}
                  onChange={(e) => setTeacherTipCustomSubject(e.target.value)}
                  placeholder="예) 보건, 환경, 동아리 등"
                  maxLength={20}
                  disabled={submitting}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            )}
          </div>
        )}

        {isAlumni && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                카테고리 (필수)
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {ALUMNI_CATEGORIES.map((c) => {
                  const active = alumniCategory === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setAlumniCategory(c.value)}
                      disabled={submitting}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-50",
                        active
                          ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                      )}
                    >
                      <span className="text-lg leading-none">{c.emoji}</span>
                      <span className="text-[12px] leading-tight">{c.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400">
                카테고리는 목록에서 뱃지로 표시되고, 후배들이 주제별로 글을
                찾아볼 수 있게 도와줘요.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  대학명 (선택)
                </label>
                <input
                  type="text"
                  value={alumniUniversity}
                  onChange={(e) => setAlumniUniversity(e.target.value)}
                  placeholder="예) 서울대학교"
                  maxLength={40}
                  disabled={submitting}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  전공 (선택)
                </label>
                <input
                  type="text"
                  value={alumniMajor}
                  onChange={(e) => setAlumniMajor(e.target.value)}
                  placeholder="예) 컴퓨터공학"
                  maxLength={40}
                  disabled={submitting}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  <GraduationCap className="h-3 w-3" />
                  졸업연도
                </label>
                <select
                  value={alumniYear}
                  onChange={(e) => setAlumniYear(Number(e.target.value))}
                  disabled={submitting}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                >
                  {ALUMNI_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}년 졸업
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {isSenior && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                계열 (필수)
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CAREER_TRACKS.map((t) => {
                  const active = seniorTrack === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSeniorTrack(t.value)}
                      disabled={submitting}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                        active
                          ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                      )}
                    >
                      <span className="text-sm leading-none">{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                대학명
              </label>
              <input
                type="text"
                value={seniorUniversity}
                onChange={(e) => setSeniorUniversity(e.target.value)}
                placeholder="예) 서울대학교"
                maxLength={40}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                학과명
              </label>
              <input
                type="text"
                value={seniorMajor}
                onChange={(e) => setSeniorMajor(e.target.value)}
                placeholder="예) 컴퓨터공학부"
                maxLength={40}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                <GraduationCap className="h-3 w-3" />
                졸업연도
              </label>
              <select
                value={seniorYear}
                onChange={(e) => setSeniorYear(Number(e.target.value))}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                {ALUMNI_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년 졸업
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                한줄 요약
              </label>
              <input
                type="text"
                value={seniorSummary}
                onChange={(e) => setSeniorSummary(e.target.value)}
                placeholder="예) 동아리 활동에 진심이면 합격해요!"
                maxLength={60}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            </div>
          </div>
        )}

        {isQa && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              과목 태그 (필수)
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {QA_SUBJECTS.map((s) => {
                const active = qaSubject === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setQaSubject(s.value)}
                    disabled={submitting}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                      active
                        ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              과목 태그는 목록에서 색상 뱃지로 표시되고, 필터링에 사용됩니다.
            </p>
          </div>
        )}

        {isIssue && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              선택지 (두 개)
            </label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-900/40 dark:bg-blue-900/15">
                <p className="px-1 text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                  A 선택지 (찬성 측)
                </p>
                <input
                  type="text"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  placeholder="예: 찬성"
                  maxLength={30}
                  disabled={submitting}
                  className="mt-1 w-full rounded-md bg-white px-2 py-1.5 text-sm focus:outline-none dark:bg-white/[0.05] dark:text-white"
                />
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 dark:border-rose-900/40 dark:bg-rose-900/15">
                <p className="px-1 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
                  B 선택지 (반대 측)
                </p>
                <input
                  type="text"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  placeholder="예: 반대"
                  maxLength={30}
                  disabled={submitting}
                  className="mt-1 w-full rounded-md bg-white px-2 py-1.5 text-sm focus:outline-none dark:bg-white/[0.05] dark:text-white"
                />
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              제목은 토론 주제, 본문은 배경/설명이에요. 투표는 작성 후 상세 페이지에서 진행됩니다.
            </p>
          </div>
        )}

        {isLost && (
          <>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-[11px] leading-relaxed text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-900/15 dark:text-cyan-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <Camera className="h-3.5 w-3.5" />
                분실물 사진을 첨부하면 찾을 확률이 높아져요!
              </div>
              <p className="mt-0.5 opacity-80">
                물건의 색·모양이 잘 보이는 사진을 함께 올리면 좋아요.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  <MapPin className="h-3 w-3" />
                  분실 장소
                </label>
                <input
                  type="text"
                  value={lostLocation}
                  onChange={(e) => setLostLocation(e.target.value)}
                  placeholder="예) 3층 화장실 앞"
                  maxLength={60}
                  disabled={submitting}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  <CalendarDays className="h-3 w-3" />
                  분실 날짜
                </label>
                <input
                  type="date"
                  value={lostDate}
                  onChange={(e) => setLostDate(e.target.value)}
                  disabled={submitting}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            {isLost
              ? "상세 설명"
              : isMarket
              ? "물품 설명"
              : isIssue
              ? "주제 설명/배경"
              : isQa
              ? "질문 내용"
              : isYoutube
              ? "영상 설명"
              : isResources
              ? "자료 설명"
              : isStudy
              ? "내용"
              : isTeacherTip
              ? "꿀팁 내용"
              : isAlumni
              ? "후배에게 한마디"
              : isSenior
              ? "후기 본문"
              : isGuessWho
              ? "추가 힌트"
              : "내용"}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isLost
                ? "분실물의 특징, 발견 시 연락 방법 등을 적어주세요."
                : isMarket
                ? "물품의 상세 정보, 인수 방법, 만남 장소 등을 적어주세요."
                : isIssue
                ? "왜 이 주제로 토론하고 싶은지, 배경 설명을 적어주세요."
                : isQa
                ? "어디까지 풀었는지, 어디서 막혔는지 자세히 적으면 답변이 빨라요."
                : isYoutube
                ? "영상에 대한 소개와 추천 이유를 적어주세요."
                : isResources
                ? "자료의 출처, 분량, 활용 팁을 적어주세요."
                : isStudy
                ? "질문·꿀팁·자료공유 내용을 자유롭게 적어주세요."
                : isTeacherTip
                ? "수업/공부 노하우, 추천 자료, 시험 팁 등을 자유롭게 적어주세요."
                : isAlumni
                ? "재학생들에게 들려주고 싶은 이야기를 자유롭게 적어주세요."
                : isSenior
                ? "지원 동기, 면접 준비, 합격 비결 등 자세히 적어주세요."
                : isGuessWho
                ? "추가 힌트나 하고 싶은 말을 적어주세요"
                : "내용을 입력해주세요"
            }
            rows={10}
            disabled={submitting}
            className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </div>

        {/* 이미지 첨부 — 챌린지/누구일까요는 필수, 그 외에는 선택 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            {isChallenge
              ? "인증샷 (필수)"
              : isGuessWho
              ? "📸 내 사진 올리기 (필수)"
              : "이미지 첨부 (선택)"}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={submitting || uploading}
            className="mt-1.5 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white file:hover:bg-violet-700 dark:text-gray-300"
          />
          {imagePreview && (
            <div className="relative mt-3 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="미리보기"
                className="max-h-72 rounded-lg border border-gray-200 object-contain dark:border-white/10"
              />
              <button
                type="button"
                onClick={handleImageRemove}
                disabled={submitting || uploading}
                className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-black/90 disabled:opacity-50"
              >
                이미지 제거
              </button>
            </div>
          )}
        </div>

        {/* PDF 첨부 — 모든 게시판에서 선택사항 (누구일까요? 제외) */}
        {!isGuessWho && (
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            PDF 첨부 (선택)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfChange}
            disabled={submitting || uploading}
            className="mt-1.5 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white file:hover:bg-violet-700 dark:text-gray-300"
          />
          <p className="mt-1 text-[10px] text-gray-400">
            10MB 이하의 PDF 파일만 업로드할 수 있어요.
          </p>
          {pdfDisplayName && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
              <FileText className="h-5 w-5 shrink-0 text-violet-500" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {pdfDisplayName}
                </p>
                {pdfDisplaySize !== null && (
                  <p className="text-[10px] text-gray-500">
                    {formatFileSize(pdfDisplaySize)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePdfRemove}
                disabled={submitting || uploading}
                aria-label="PDF 제거"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-gray-200 disabled:opacity-50 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={`/board/${boardType}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(submitting || uploading) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {uploading
              ? "이미지 업로드 중..."
              : submitting
              ? "저장 중..."
              : editId
              ? "수정"
              : "작성"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── 챌린지 글쓰기 — 카테고리 picker ───────────────────────────
// 등교/공부/운동 3개 중 하나 선택 (필수). 참여하지 않은 카테고리는 비활성.
const CHALLENGE_PICKER_OPTIONS: ChallengeCategory[] = [
  "attendance",
  "study_cert",
  "exercise",
];

function ChallengeCategoryPicker({
  value,
  onChange,
  mySubs,
  disabled,
}: {
  value: ChallengeCategory | "";
  onChange: (v: ChallengeCategory | "") => void;
  mySubs: ChallengeCategory[];
  disabled?: boolean;
}) {
  const showAttendanceClosed =
    value === "attendance" && isAttendanceClosed();
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        챌린지 카테고리 (필수)
      </label>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {CHALLENGE_PICKER_OPTIONS.map((cat) => {
          const active = value === cat;
          const isJoined = mySubs.includes(cat);
          const isDisabled = disabled || !isJoined;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(cat)}
              disabled={isDisabled}
              title={isJoined ? "" : "먼저 '참여하기'를 눌러주세요"}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                isDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="text-lg leading-none">
                {CHALLENGE_CATEGORY_ICON[cat]}
              </span>
              <span className="text-[12px]">
                {CHALLENGE_CATEGORY_LABEL[cat]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-gray-400">
        참여하지 않은 카테고리는 챌린지 목록에서 먼저 &quot;참여하기&quot;를 눌러주세요.
      </p>
      {showAttendanceClosed && (
        <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          ⚠️ 등교 인증 시간이 지났습니다 (오전{" "}
          {ATTENDANCE_DEADLINE_HOUR}:
          {String(ATTENDANCE_DEADLINE_MINUTE).padStart(2, "0")}까지)
        </p>
      )}
    </div>
  );
}

// ── 학습게시판 글쓰기 — 학년/교과/글 종류 picker ─────────────
// "선택 안 함" 값은 ""(빈 문자열). 제출 검증에서 빈 값이면 안내 메시지 표시.
function StudyTagPicker<V extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  wide,
}: {
  label: string;
  value: V | "";
  onChange: (v: V | "") => void;
  options: { value: V; label: string }[];
  disabled?: boolean;
  /** 옵션이 많을 때 sm:col-span-2 부여 (교과 6 개 등) */
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </label>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? ("" as V | "") : opt.value)}
              disabled={disabled}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                active
                  ? "border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
