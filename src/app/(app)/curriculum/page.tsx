"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  X,
  Star,
  ChevronRight,
  MessageSquare,
  CheckCircle,
  Plus,
  Search,
  BookOpen,
  Users,
  HelpCircle,
  Pencil,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  COURSES,
  REVIEWS,
  QNAS,
  addReview,
  addQna,
  answerQna,
  getReviewsByCourse,
  getAverageRating,
  STREAM_COLORS,
  AREA_COLORS,
  type Course,
  type CourseCategory,
  type CourseReview,
  type CourseQna,
} from "@/lib/curriculum-data";

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const CATEGORIES: CourseCategory[] = ["일반선택", "진로선택", "융합선택"];

const CATEGORY_META: Record<CourseCategory, { color: string; desc: string }> = {
  일반선택: { color: "#06b6d4", desc: "기본 소양을 쌓는 공통 과목 군" },
  진로선택: { color: "#7c3aed", desc: "전공 연계·심화 학습 과목 군" },
  융합선택: { color: "#10b981", desc: "교과 경계를 넘는 융합 탐구 과목 군" },
};

// ─── 애니메이션 ────────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

// ─── 별점 컴포넌트 ─────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(s)}
          className={cn(
            "transition-colors",
            readonly ? "cursor-default" : "cursor-pointer",
          )}
        >
          <Star
            className={cn(
              "h-4 w-4",
              s <= value ? "fill-warning text-warning" : "text-foreground/20",
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── 과목 카드 ─────────────────────────────────────────────────────────────────

function CourseCard({
  course,
  onClick,
}: {
  course: Course;
  onClick: () => void;
}) {
  const avgRating = getAverageRating(course.id);
  const reviewCount = getReviewsByCourse(course.id).length;
  const areaColor = AREA_COLORS[course.area] ?? "#7c3aed";

  return (
    <GlassCard onClick={onClick} className="flex flex-col gap-3">
      {/* 영역 배지 */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: `${areaColor}18`, color: areaColor }}
        >
          {course.area}
        </span>
        {reviewCount > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-foreground/45">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span>{avgRating.toFixed(1)}</span>
            <span className="text-foreground/30">({reviewCount})</span>
          </div>
        )}
      </div>

      {/* 과목명 + 설명 */}
      <div>
        <p className="font-bold leading-snug">{course.name}</p>
        <p className="mt-1 line-clamp-2 text-xs text-foreground/60">{course.description}</p>
      </div>

      {/* 계열 태그 */}
      <div className="mt-auto flex flex-wrap gap-1.5">
        {course.streams.map((s) => (
          <span
            key={s}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: `${STREAM_COLORS[s]}15`, color: STREAM_COLORS[s] }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-end text-[11px] text-foreground/35">
        자세히 보기 <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </GlassCard>
  );
}

// ─── 과목 상세 모달 ────────────────────────────────────────────────────────────

function CourseModal({
  course,
  onClose,
}: {
  course: Course;
  onClose: () => void;
}) {
  const reviews = getReviewsByCourse(course.id);
  const avgRating = getAverageRating(course.id);
  const areaColor = AREA_COLORS[course.area] ?? "#7c3aed";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="glass relative w-full max-w-lg overflow-y-auto rounded-3xl p-6 max-h-[85vh]"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/50 hover:bg-foreground/20"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 헤더 */}
        <div className="mb-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: `${areaColor}18`, color: areaColor }}
            >
              {course.area}
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                background: `${CATEGORY_META[course.category].color}15`,
                color: CATEGORY_META[course.category].color,
              }}
            >
              {course.category}
            </span>
          </div>
          <h2 className="text-xl font-extrabold">{course.name}</h2>
          <p className="mt-1 text-sm text-foreground/60">{course.description}</p>
          {reviews.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <StarRating value={Math.round(avgRating)} readonly />
              <span className="text-sm font-semibold text-warning">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-foreground/45">후기 {reviews.length}개</span>
            </div>
          )}
        </div>

        {/* 과목 소개 */}
        <div className="mb-4 rounded-2xl bg-foreground/5 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
            과목 소개
          </p>
          <p className="text-sm leading-relaxed text-foreground/75">{course.detail}</p>
        </div>

        {/* 이런 학생에게 추천 */}
        <div className="mb-4 rounded-2xl bg-accent/8 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent/70">
            이런 학생에게 추천
          </p>
          <p className="text-sm leading-relaxed text-foreground/75">{course.recommended_for}</p>
        </div>

        {/* 연계 대학학과 */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
            연계 대학학과
          </p>
          <div className="flex flex-wrap gap-2">
            {course.related_majors.map((m) => (
              <span
                key={m}
                className="rounded-xl bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/70"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* 계열 태그 */}
        <div className="flex flex-wrap gap-1.5">
          {course.streams.map((s) => (
            <span
              key={s}
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: `${STREAM_COLORS[s]}18`, color: STREAM_COLORS[s] }}
            >
              {s}계열
            </span>
          ))}
        </div>

        {/* 미니 후기 목록 */}
        {reviews.length > 0 && (
          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="mb-3 text-sm font-bold">선배 후기</p>
            <ul className="flex flex-col gap-3">
              {reviews.slice(0, 2).map((r) => (
                <li key={r.id} className="rounded-xl bg-foreground/5 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <StarRating value={r.rating} readonly />
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        r.difficulty === "어려움" && "bg-red-500/10 text-red-400",
                        r.difficulty === "보통" && "bg-warning/10 text-warning",
                        r.difficulty === "쉬움" && "bg-success/10 text-success",
                      )}
                    >
                      {r.difficulty}
                    </span>
                    <Badge role={r.author_role} />
                    <span className="text-[11px] text-foreground/40">{r.author_name}</span>
                  </div>
                  <p className="text-xs text-foreground/70">{r.content}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function CurriculumPage() {
  const [activeTab, setActiveTab] = useState<CourseCategory>("일반선택");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [search, setSearch] = useState("");

  // 후기 상태
  const [reviews, setReviews] = useState<CourseReview[]>(REVIEWS);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    course_id: "",
    content: "",
    rating: 5 as 1 | 2 | 3 | 4 | 5,
    difficulty: "보통" as "쉬움" | "보통" | "어려움",
    recommended: true,
  });

  // Q&A 상태
  const [qnas, setQnas] = useState<CourseQna[]>(QNAS);
  const [showQnaForm, setShowQnaForm] = useState(false);
  const [qnaForm, setQnaForm] = useState({ course_id: "", question: "" });
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [isTeacher, setIsTeacher] = useState(false); // TODO: Supabase auth 연동

  // 교사 과목 등록 상태
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [localCourses] = useState<Course[]>(COURSES);

  const filteredCourses = useMemo(
    () =>
      localCourses.filter(
        (c) =>
          c.category === activeTab &&
          (c.name.includes(search) || c.description.includes(search)),
      ),
    [localCourses, activeTab, search],
  );

  const submitReview = () => {
    if (!reviewForm.content.trim() || !reviewForm.course_id) return;
    const newReview = addReview({
      course_id: reviewForm.course_id,
      author_id: "me",
      author_name: "나",
      author_role: "student",
      content: reviewForm.content,
      rating: reviewForm.rating,
      difficulty: reviewForm.difficulty,
      recommended: reviewForm.recommended,
    });
    setReviews((prev) => [newReview, ...prev]);
    setReviewForm({ course_id: "", content: "", rating: 5, difficulty: "보통", recommended: true });
    setShowReviewForm(false);
  };

  const submitQna = () => {
    if (!qnaForm.question.trim()) return;
    const newQna = addQna({
      course_id: qnaForm.course_id || null,
      author_id: "me",
      author_name: "나",
      question: qnaForm.question,
    });
    setQnas((prev) => [newQna, ...prev]);
    setQnaForm({ course_id: "", question: "" });
    setShowQnaForm(false);
  };

  const submitAnswer = (id: string) => {
    if (!answerText.trim()) return;
    answerQna(id, answerText, "선생님");
    setQnas((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, answer: answerText, answered_by: "선생님", answered_at: new Date().toISOString() }
          : q,
      ),
    );
    setAnsweringId(null);
    setAnswerText("");
  };

  const INPUT_CLS =
    "w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14">
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-1.5 text-sm font-semibold text-success ring-1 ring-success/25">
          <BookOpen className="h-4 w-4" />
          2022 개정 교육과정
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          선택과목 <span className="text-gradient">완벽 가이드</span>
        </h1>
        <p className="mt-2 text-foreground/60">
          일반선택 · 진로선택 · 융합선택 과목을 탐색하고, 선배들의 후기와 Q&A를 확인하세요.
        </p>

        {/* 교사 모드 토글 — Supabase auth 연동 전 임시 */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setIsTeacher((v) => !v)}
            className="text-[11px] text-foreground/25 hover:text-foreground/50"
          >
            {isTeacher ? "[교사 모드]" : "[학생 모드]"}
          </button>
          {isTeacher && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCourseForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-role-teacher/12 px-3 py-1 text-xs font-semibold text-role-teacher ring-1 ring-role-teacher/30 hover:bg-role-teacher/20"
            >
              <Pencil className="h-3 w-3" />
              과목 정보 등록/수정
            </motion.button>
          )}
        </div>

        {/* 교사 과목 등록 폼 */}
        <AnimatePresence>
          {showCourseForm && isTeacher && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 overflow-hidden"
            >
              <GlassCard interactive={false} className="ring-1 ring-role-teacher/20">
                <p className="mb-3 text-sm font-bold text-role-teacher">과목 정보 등록</p>
                <p className="mb-3 text-xs text-foreground/50">
                  새 과목 데이터는 Supabase courses 테이블에 저장됩니다. 환경변수 설정 후 실제 DB에 반영됩니다.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input placeholder="과목명" className={INPUT_CLS} />
                  <select className={cn(INPUT_CLS, "appearance-none")}>
                    <option>일반선택</option>
                    <option>진로선택</option>
                    <option>융합선택</option>
                  </select>
                  <input placeholder="교과 영역 (예: 수학, 과학)" className={INPUT_CLS} />
                  <input placeholder="계열 (쉼표 구분, 예: 자연, 의약)" className={INPUT_CLS} />
                </div>
                <textarea placeholder="과목 설명" rows={2} className={cn(INPUT_CLS, "mt-3 resize-none")} />
                <textarea placeholder="과목 상세 소개" rows={3} className={cn(INPUT_CLS, "mt-3 resize-none")} />
                <textarea placeholder="이런 학생에게 추천" rows={2} className={cn(INPUT_CLS, "mt-3 resize-none")} />
                <input placeholder="연계 학과 (쉼표 구분)" className={cn(INPUT_CLS, "mt-3")} />
                <Button className="mt-3 w-full" onClick={() => setShowCourseForm(false)}>
                  저장 (Supabase 연동 후 활성화)
                </Button>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── 과목 카테고리 탭 ─────────────────────────────────────────── */}
      <section>
        {/* 탭 */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = activeTab === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={cn(
                  "relative shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all",
                  active ? "text-white" : "text-foreground/60 hover:text-foreground",
                )}
                style={active ? { background: meta.color } : {}}
              >
                {!active && (
                  <span
                    className="absolute inset-0 rounded-2xl opacity-0 transition-opacity hover:opacity-100"
                    style={{ background: `${meta.color}15` }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="course-tab-active"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: meta.color }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  />
                )}
                <span className="relative">{cat}</span>
              </button>
            );
          })}
        </div>

        {/* 탭 설명 + 검색 */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground/55">{CATEGORY_META[activeTab].desc}</p>
          <div className="relative max-w-xs flex-shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="과목명 검색..."
              className="w-full rounded-2xl bg-foreground/5 py-2 pl-9 pr-4 text-sm outline-none ring-1 ring-white/10 placeholder:text-foreground/30 focus:ring-accent/50"
            />
          </div>
        </div>

        {/* 과목 카드 그리드 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredCourses.map((course) => (
              <motion.div key={course.id} variants={itemVariants}>
                <CourseCard course={course} onClick={() => setSelectedCourse(course)} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredCourses.length === 0 && (
          <div className="py-14 text-center text-sm text-foreground/40">
            검색 결과가 없습니다.
          </div>
        )}
      </section>

      {/* ── 선배들의 과목 후기 ──────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-warning" />
            <h2 className="text-xl font-bold">선배들의 과목 후기</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowReviewForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning ring-1 ring-warning/25 transition-all hover:bg-warning/18"
          >
            {showReviewForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showReviewForm ? "닫기" : "후기 작성"}
          </motion.button>
        </div>

        {/* 후기 작성 폼 */}
        <AnimatePresence>
          {showReviewForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="mb-4 overflow-hidden"
            >
              <GlassCard interactive={false} className="ring-1 ring-warning/20">
                <p className="mb-3 text-sm font-bold text-warning">과목 후기 작성</p>
                <div className="flex flex-col gap-3">
                  {/* 과목 선택 */}
                  <select
                    value={reviewForm.course_id}
                    onChange={(e) => setReviewForm((v) => ({ ...v, course_id: e.target.value }))}
                    className={cn(INPUT_CLS, "appearance-none")}
                  >
                    <option value="">과목을 선택하세요</option>
                    {CATEGORIES.map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {localCourses
                          .filter((c) => c.category === cat)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* 별점 */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground/60">별점</span>
                    <StarRating
                      value={reviewForm.rating}
                      onChange={(v) =>
                        setReviewForm((prev) => ({ ...prev, rating: v as 1 | 2 | 3 | 4 | 5 }))
                      }
                    />
                  </div>

                  {/* 난이도 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground/60">난이도</span>
                    {(["쉬움", "보통", "어려움"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setReviewForm((v) => ({ ...v, difficulty: d }))}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                          reviewForm.difficulty === d
                            ? "bg-accent text-white"
                            : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  {/* 추천 여부 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground/60">추천</span>
                    {([true, false] as const).map((r) => (
                      <button
                        key={String(r)}
                        type="button"
                        onClick={() => setReviewForm((v) => ({ ...v, recommended: r }))}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                          reviewForm.recommended === r
                            ? r
                              ? "bg-success text-white"
                              : "bg-red-500/80 text-white"
                            : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10",
                        )}
                      >
                        {r ? "추천해요" : "비추천"}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={reviewForm.content}
                    onChange={(e) => setReviewForm((v) => ({ ...v, content: e.target.value }))}
                    placeholder="수강 후기와 팁을 남겨주세요..."
                    rows={3}
                    className={cn(INPUT_CLS, "resize-none")}
                  />
                  <button
                    onClick={submitReview}
                    className="w-full rounded-xl bg-warning py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    후기 등록
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 후기 목록 */}
        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          {reviews.map((r) => {
            const course = localCourses.find((c) => c.id === r.course_id);
            return (
              <motion.li key={r.id} variants={itemVariants}>
                <GlassCard
                  interactive={false}
                  className={cn(
                    "border-l-2",
                    r.recommended ? "border-success/50" : "border-red-400/40",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge role={r.author_role} />
                      <span className="font-semibold text-sm">{r.author_name}</span>
                      {course && (
                        <button
                          onClick={() => setSelectedCourse(course)}
                          className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent hover:bg-accent/18"
                        >
                          {course.name}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating} readonly />
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          r.difficulty === "어려움" && "bg-red-500/10 text-red-400",
                          r.difficulty === "보통" && "bg-warning/10 text-warning",
                          r.difficulty === "쉬움" && "bg-success/10 text-success",
                        )}
                      >
                        {r.difficulty}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          r.recommended
                            ? "bg-success/10 text-success"
                            : "bg-red-500/10 text-red-400",
                        )}
                      >
                        {r.recommended ? "추천" : "비추"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-foreground/75">{r.content}</p>
                  <p className="mt-1.5 text-[11px] text-foreground/35">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </GlassCard>
              </motion.li>
            );
          })}
        </motion.ul>
      </section>

      {/* ── Q&A 게시판 ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-cyan-accent" />
            <h2 className="text-xl font-bold">과목 Q&A</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowQnaForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-cyan-accent/10 px-3 py-2 text-xs font-semibold text-cyan-accent ring-1 ring-cyan-accent/25 transition-all hover:bg-cyan-accent/18"
          >
            {showQnaForm ? <X className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
            {showQnaForm ? "닫기" : "질문하기"}
          </motion.button>
        </div>

        {/* Q&A 작성 폼 */}
        <AnimatePresence>
          {showQnaForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="mb-4 overflow-hidden"
            >
              <GlassCard interactive={false} className="ring-1 ring-cyan-accent/20">
                <p className="mb-3 text-sm font-bold text-cyan-accent">과목 질문하기</p>
                <div className="flex flex-col gap-3">
                  <select
                    value={qnaForm.course_id}
                    onChange={(e) => setQnaForm((v) => ({ ...v, course_id: e.target.value }))}
                    className={cn(INPUT_CLS, "appearance-none")}
                  >
                    <option value="">관련 과목 (선택 사항)</option>
                    {CATEGORIES.map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {localCourses
                          .filter((c) => c.category === cat)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <textarea
                    value={qnaForm.question}
                    onChange={(e) => setQnaForm((v) => ({ ...v, question: e.target.value }))}
                    placeholder="궁금한 점을 자유롭게 질문하세요..."
                    rows={3}
                    className={cn(INPUT_CLS, "resize-none")}
                  />
                  <button
                    onClick={submitQna}
                    className="w-full rounded-xl bg-cyan-accent py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    질문 등록
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Q&A 목록 */}
        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          {qnas.map((q) => {
            const relatedCourse = q.course_id
              ? localCourses.find((c) => c.id === q.course_id)
              : null;
            const answered = !!q.answer;

            return (
              <motion.li key={q.id} variants={itemVariants}>
                <GlassCard interactive={false}>
                  {/* 질문 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge role="student" />
                        <span className="text-sm font-semibold">{q.author_name}</span>
                        {relatedCourse && (
                          <button
                            onClick={() => setSelectedCourse(relatedCourse)}
                            className="rounded-full bg-foreground/8 px-2.5 py-0.5 text-xs text-foreground/60 hover:bg-foreground/14"
                          >
                            {relatedCourse.name}
                          </button>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            answered
                              ? "bg-success/12 text-success ring-1 ring-success/25"
                              : "bg-foreground/8 text-foreground/45",
                          )}
                        >
                          {answered ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              답변완료
                            </span>
                          ) : (
                            "답변대기"
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80">{q.question}</p>
                      <p className="mt-1 text-[11px] text-foreground/35">
                        {new Date(q.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>

                  {/* 답변 */}
                  {q.answer && (
                    <div className="mt-3 rounded-xl bg-accent/8 p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Badge role="teacher" />
                        <span className="text-xs font-semibold">{q.answered_by}</span>
                      </div>
                      <p className="text-sm text-foreground/75">{q.answer}</p>
                    </div>
                  )}

                  {/* 교사 답변 입력 */}
                  {isTeacher && !q.answer && (
                    <div className="mt-3">
                      {answeringId === q.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="답변을 입력하세요..."
                            rows={2}
                            className={cn(INPUT_CLS, "resize-none")}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitAnswer(q.id)}
                              className="flex-1 rounded-xl bg-role-teacher py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            >
                              답변 등록
                            </button>
                            <button
                              onClick={() => { setAnsweringId(null); setAnswerText(""); }}
                              className="rounded-xl bg-foreground/8 px-4 py-2 text-xs font-semibold text-foreground/50"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAnsweringId(q.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-role-teacher hover:underline"
                        >
                          <Pencil className="h-3 w-3" />
                          답변 달기
                        </button>
                      )}
                    </div>
                  )}
                </GlassCard>
              </motion.li>
            );
          })}
        </motion.ul>
      </section>

      {/* ── 과목 상세 모달 ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCourse && (
          <CourseModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
