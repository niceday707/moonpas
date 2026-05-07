"use client";

// ============================================================================
// 문튜브 — 큐레이션된 유튜브 영상 모음 페이지
// ----------------------------------------------------------------------------
// - 카테고리 탭 (전체 / 진로진학 / 동기부여 / 학습법 / 학교소식)
// - 영상 카드 그리드 (모바일 1열, 태블릿 2열, 데스크톱 3열)
// - 교사 모드일 때만 "영상 추가" 모달 / 카드 ✕ 삭제 노출
//   (실제 인증 연동 전까지는 우상단 [학생]/[교사] 토글로 시뮬레이션)
// ============================================================================
import { useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Plus, PlayCircle, X, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VideoCard } from "@/components/youtube/VideoCard";
import {
  YOUTUBE_VIDEOS,
  YOUTUBE_CATEGORIES,
  CATEGORY_COLOR,
  parseYoutubeId,
  type YoutubeCategory,
  type YoutubeVideo,
} from "@/lib/youtube-data";
import { cn } from "@/lib/utils";

// ─── 애니메이션 ────────────────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

// 탭 타입: "전체" + 4개 카테고리
type Tab = "전체" | YoutubeCategory;
const TABS: Tab[] = ["전체", ...YOUTUBE_CATEGORIES];

// ─── 영상 추가 모달 ─────────────────────────────────────────────────────────
function AddVideoModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (v: YoutubeVideo) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<YoutubeCategory>("진로진학");
  const [error, setError] = useState<string | null>(null);

  const INPUT_CLS =
    "w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50";

  const handleSubmit = () => {
    const id = parseYoutubeId(url);
    if (!id) {
      setError("유효한 유튜브 URL 또는 영상 ID 를 입력하세요.");
      return;
    }
    if (!title.trim()) {
      setError("영상 제목을 입력하세요.");
      return;
    }
    onAdd({ id, title: title.trim(), category });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* 딤 배경 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* 모달 */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "glass relative w-full overflow-hidden",
          "rounded-t-3xl sm:max-w-md sm:rounded-3xl",
        )}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-foreground/20" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-500/15 text-red-400">
              <PlayCircle className="h-4 w-4" />
            </span>
            <p className="text-sm font-extrabold">문튜브 영상 추가</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/50 hover:bg-foreground/18"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 폼 */}
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/65">
              유튜브 URL 또는 영상 ID
            </label>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className={INPUT_CLS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/65">
              영상 제목
            </label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="예) 2028 대입 완벽 정리"
              className={INPUT_CLS}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground/65">
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {YOUTUBE_CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                      active
                        ? "text-white"
                        : "bg-foreground/5 text-foreground/55 hover:bg-foreground/10",
                    )}
                    style={
                      active
                        ? { background: CATEGORY_COLOR[c] }
                        : undefined
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="mt-1 w-full rounded-xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] transition-opacity hover:opacity-90"
          >
            영상 추가하기
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────
export default function YoutubePage() {
  const [videos, setVideos] = useState<YoutubeVideo[]>(YOUTUBE_VIDEOS);
  const [tab, setTab] = useState<Tab>("전체");
  const [isTeacher, setIsTeacher] = useState(false); // TODO: Supabase auth 연동
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = useMemo(
    () => (tab === "전체" ? videos : videos.filter((v) => v.category === tab)),
    [videos, tab],
  );

  const handleAdd = (video: YoutubeVideo) => {
    setVideos((prev) => [video, ...prev]);
  };

  const handleRemove = (idx: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6 flex items-end justify-between gap-4"
      >
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-red-500/15 text-red-400">
              <PlayCircle className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              문튜브
            </h1>
          </div>
          <p className="text-sm text-foreground/55">
            진로·학습·동기부여까지, 문태고 학생들을 위한 영상 큐레이션.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 교사 모드 토글 — 인증 연동 전 임시 시뮬레이션 */}
          <button
            onClick={() => setIsTeacher((v) => !v)}
            className="text-[11px] text-foreground/25 hover:text-foreground/50"
          >
            {isTeacher ? "[교사]" : "[학생]"}
          </button>
          <AnimatePresence>
            {isTeacher && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,#7c3aed_0%,#06b6d4_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                영상 추가
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── 카테고리 탭 ──────────────────────────────────────── */}
      <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const active = tab === t;
          // "전체" 는 액센트 보라, 나머지는 카테고리 컬러로
          const accent = t === "전체" ? "#7c3aed" : CATEGORY_COLOR[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "relative shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "text-white"
                  : "bg-foreground/5 text-foreground/65 hover:bg-foreground/10 hover:text-foreground",
              )}
              style={active ? { background: accent } : undefined}
            >
              {active && (
                <motion.span
                  layoutId="youtube-tab-active"
                  className="absolute inset-0 -z-10 rounded-full"
                  style={{ background: accent }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                />
              )}
              {t}
            </button>
          );
        })}
      </div>

      {/* ── 영상 그리드 ──────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <GlassCard interactive={false} className="py-12 text-center">
          <p className="text-sm text-foreground/45">
            아직 이 카테고리의 영상이 없어요.
            {isTeacher && " 영상을 추가해 보세요!"}
          </p>
        </GlassCard>
      ) : (
        <motion.section
          key={tab} // 탭 바뀔 때마다 stagger 재실행
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((video, i) => {
            // 원본 배열에서의 인덱스 — 삭제 시 정확한 항목 제거에 사용
            const originalIdx = videos.indexOf(video);
            return (
              <motion.div key={`${video.id}-${i}`} variants={itemVariants}>
                <VideoCard
                  video={video}
                  onRemove={
                    isTeacher
                      ? () => handleRemove(originalIdx)
                      : undefined
                  }
                />
              </motion.div>
            );
          })}
        </motion.section>
      )}

      {/* ── 영상 추가 모달 ──────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && isTeacher && (
          <AddVideoModal
            onClose={() => setShowAddModal(false)}
            onAdd={handleAdd}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
