"use client";

// 글 쓰기 / 수정 — /board/[boardType]/write?id=xxx (id 있으면 수정 모드)
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
  Clock,
  Users,
  PlayCircle,
  X,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import {
  ALUMNI_CATEGORIES,
  ALUMNI_YEARS,
  BOARD_LABEL,
  CAREER_TRACKS,
  MARKET_CONDITION_LABEL,
  QA_SUBJECTS,
  RESOURCE_CATEGORIES,
  STUDY_SUBJECTS,
  YOUTUBE_CATEGORIES,
  createPost,
  extractYoutubeId,
  getPost,
  parseAlumniContent,
  parseIssueContent,
  parseLostContent,
  parseMarketContent,
  parseQaContent,
  parseResourceContent,
  parseSeniorContent,
  parseStudyContent,
  parseYoutubeContent,
  stringifyAlumniContent,
  stringifyIssueContent,
  stringifyLostContent,
  stringifyMarketContent,
  stringifyQaContent,
  stringifyResourceContent,
  stringifySeniorContent,
  stringifyStudyContent,
  stringifyYoutubeContent,
  updatePost,
  type AlumniCategory,
  type BoardType,
  type CareerTrack,
  type MarketCondition,
  type QaSubject,
  type ResourceCategory,
  type StudySubject,
  type YoutubeCategory,
} from "@/lib/board";
import { cn } from "@/lib/utils";
import { useSupabaseProfile } from "@/lib/supabase-profile";
import { notifyNotice } from "@/lib/notify";
import {
  formatFileSize,
  uploadFile,
  uploadImage,
  validatePdfFile,
} from "@/lib/storage";

const VALID_BOARDS = Object.keys(BOARD_LABEL) as BoardType[];

export default function BoardWritePage() {
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
        <WriteInner />
      </Suspense>
    </AuthGate>
  );
}

function WriteInner() {
  const params = useParams<{ boardType: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const boardType = params.boardType as BoardType;
  const editId = search.get("id");

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
  // 스터디 전용
  const [studySubject, setStudySubject] = useState<StudySubject>("etc");
  const [studyMaxMembers, setStudyMaxMembers] = useState<number>(4);
  const [studySchedule, setStudySchedule] = useState("");
  const [studyLocation, setStudyLocation] = useState("");
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
        const parsed = parseStudyContent(post.content);
        setStudySubject(parsed.subject);
        setStudyMaxMembers(parsed.maxMembers);
        setStudySchedule(parsed.schedule);
        setStudyLocation(parsed.location);
        setContent(parsed.description);
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
  const isAlumni = boardType === "alumni";
  const isSenior = boardType === "senior";

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
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }
    // 챌린지는 이미지 필수 — 새 파일이거나 기존 이미지가 있어야 함
    if (isChallenge && !imageFile && !imagePreview) {
      setError("챌린지 게시판은 인증샷 이미지가 필요해요.");
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
      if (!Number.isFinite(studyMaxMembers) || studyMaxMembers < 1) {
        setError("모집 인원은 1명 이상이어야 합니다.");
        return;
      }
      if (!studySchedule.trim()) {
        setError("스터디 시간대를 입력해주세요.");
        return;
      }
      if (!studyLocation.trim()) {
        setError("스터디 장소를 입력해주세요.");
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
      ? stringifyStudyContent({
          subject: studySubject,
          maxMembers: studyMaxMembers,
          schedule: studySchedule,
          location: studyLocation,
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
      });
      setSubmitting(false);
      if (e) {
        setError(`수정 실패: ${e}`);
        return;
      }
      router.push(`/board/${boardType}/${editId}`);
    } else {
      const result = await createPost({
        authorId: user.id,
        boardType,
        title: title.trim(),
        content: finalContent,
        imageUrl,
        fileUrl,
        fileName,
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

      // 공지사항 신규 등록 시 전체 사용자 알림 (최대 500명, onNotice 켠 사람만).
      // 이동을 막지 않도록 await 하지 않음 — notify.ts 내부에서 청크 INSERT.
      if (boardType === "notice") {
        notifyNotice({
          postId: result.id,
          title: title.trim(),
          authorId: user.id,
        });
      }

      router.push(`/board/${boardType}/${result.id}`);
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
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            {isIssue ? "토론 주제" : isQa ? "질문 제목" : "제목"}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                과목
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STUDY_SUBJECTS.map((s) => {
                  const active = studySubject === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStudySubject(s.value)}
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
            </div>
            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                <Users className="h-3 w-3" />
                모집 인원
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={studyMaxMembers}
                onChange={(e) =>
                  setStudyMaxMembers(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                }
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                <Clock className="h-3 w-3" />
                시간대
              </label>
              <input
                type="text"
                value={studySchedule}
                onChange={(e) => setStudySchedule(e.target.value)}
                placeholder="예) 매주 월/수 18-20시"
                maxLength={60}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                <MapPin className="h-3 w-3" />
                장소
              </label>
              <input
                type="text"
                value={studyLocation}
                onChange={(e) => setStudyLocation(e.target.value)}
                placeholder="예) 도서관 3층 그룹실"
                maxLength={60}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
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
              ? "스터디 소개"
              : isAlumni
              ? "후배에게 한마디"
              : isSenior
              ? "후기 본문"
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
                ? "어떤 사람과 어떻게 공부할지 자유롭게 적어주세요."
                : isAlumni
                ? "재학생들에게 들려주고 싶은 이야기를 자유롭게 적어주세요."
                : isSenior
                ? "지원 동기, 면접 준비, 합격 비결 등 자세히 적어주세요."
                : "내용을 입력해주세요"
            }
            rows={10}
            disabled={submitting}
            className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </div>

        {/* 이미지 첨부 — 챌린지는 필수, 그 외에는 선택 */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            {isChallenge ? "인증샷 (필수)" : "이미지 첨부 (선택)"}
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

        {/* PDF 첨부 — 모든 게시판에서 선택사항 */}
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
