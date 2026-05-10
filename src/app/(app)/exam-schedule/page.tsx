"use client";

// 평가일정 & 출제범위 페이지
// ---------------------------------------------------------------
// 1) 학년 필터 (전체/1·2·3학년) → grades 배열에 포함된 시험만 노출
// 2) D-day 카드 — 필터된 시험 중 미래 + 가장 가까운 1개 (그라데이션)
// 3) 월별 타임라인 (3월~12월) — sticky 월 헤더 + 좌측 indigo 라인 + 시험 카드들
// 4) 시험 카드 클릭 → 출제범위 아코디언 (학년 탭 → 과목별 테이블)
//
// 데이터 소스: src/data/examSchedule2026.ts (순수 TS, 빌드 시 정적 인라인)
// 모든 D-day/요일 계산은 클라이언트 new Date() KST 기준 — 서버 SSR 시 hydration mismatch
// 가능성을 피하려 'use client' + 마운트 후 렌더 패턴은 쓰지 않고,
// new Date() 만으로 결정되는 텍스트는 useState(0) + useEffect 로 한 번 reflow 시킨다.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, CalendarDays } from "lucide-react";
import { examSchedule2026, type Exam, type ExamType } from "@/data/examSchedule2026";
import { cn } from "@/lib/utils";

// ── 상수: 시험 타입별 색상 ─────────────────────────────
const TYPE_BORDER: Record<ExamType, string> = {
  모의고사: "border-blue-500",
  모의평가: "border-red-500",
  내신: "border-green-500",
  수능: "border-yellow-500",
  영어듣기: "border-purple-500",
};

const TYPE_BADGE: Record<ExamType, string> = {
  모의고사: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  모의평가: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  내신: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  수능: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
  영어듣기: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
};

const GRADE_BADGE: Record<number, string> = {
  1: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  2: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  3: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

// ── 유틸 ─────────────────────────────────────────────────

/** YYYY-MM-DD → Date (KST 자정으로 고정해 D-day 계산을 일관되게.) */
function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 두 자정 시각 사이의 일수 차이 (양수: 미래, 음수: 과거). */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** "28~30일" 형태의 날짜 라벨 (단일 날짜는 "24일") */
function dateRangeLabel(exam: Exam): { day: string; weekday: string } {
  const start = ymdToDate(exam.date);
  if (exam.dateEnd) {
    const end = ymdToDate(exam.dateEnd);
    return {
      day: `${start.getDate()}~${end.getDate()}일`,
      weekday: WEEKDAY_KR[start.getDay()],
    };
  }
  return {
    day: `${start.getDate()}일`,
    weekday: WEEKDAY_KR[start.getDay()],
  };
}

/** D-day 라벨: 미래 → "D-N", 진행중 → "D-DAY 🔥", 과거 → "완료 ✓" */
function ddayLabel(exam: Exam, today: Date): string {
  const start = ymdToDate(exam.date);
  const end = exam.dateEnd ? ymdToDate(exam.dateEnd) : start;
  const diffStart = daysBetween(today, start);
  const diffEnd = daysBetween(today, end);
  if (diffEnd < 0) return "완료 ✓";
  if (diffStart <= 0 && diffEnd >= 0) return "D-DAY 🔥";
  return `D-${diffStart}`;
}

// ── 학년 필터 타입 ─────────────────────────────────────
type GradeFilter = "all" | 1 | 2 | 3;

// ── 페이지 ─────────────────────────────────────────────
export default function ExamSchedulePage() {
  const [filter, setFilter] = useState<GradeFilter>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  // SSR 안전성을 위해 today 는 마운트 후에 세팅 (hydration mismatch 방지)
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
    // 자정이 지나면 D-day 가 갱신되도록 하루 1회 재계산 — 사용자가 페이지를 오래 열어둔 경우 대응
    const id = window.setInterval(() => setToday(new Date()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // 필터 적용 후 시험 목록
  const filtered = useMemo(() => {
    if (filter === "all") return examSchedule2026;
    return examSchedule2026.filter((e) => e.grades.includes(filter));
  }, [filter]);

  // D-day 카드용 — 미래 + 가장 가까운 시험 1개
  const upcoming = useMemo(() => {
    if (!today) return null;
    const future = filtered
      .filter((e) => {
        const end = ymdToDate(e.dateEnd ?? e.date);
        return daysBetween(today, end) >= 0;
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return future[0] ?? null;
  }, [filtered, today]);

  // 월별 그룹 — 3월(03)부터 12월(12)까지 순서 유지
  const groupedByMonth = useMemo(() => {
    const map = new Map<number, Exam[]>();
    for (const e of filtered) {
      const m = ymdToDate(e.date).getMonth() + 1;
      const arr = map.get(m) ?? [];
      arr.push(e);
      map.set(m, arr);
    }
    // 같은 달 내 날짜 오름차순
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    }
    // 3 ~ 12 월 순
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filtered]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-screen-md px-4 py-6 md:px-6"
    >
      {/* ── 페이지 헤더 ── */}
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
          📝 평가일정 & 출제범위
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          2026학년도 학력평가 · 모의평가 · 교내 시험 · 영어듣기 · 수능 일정
        </p>
      </div>

      {/* ── 학년 필터 ── */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          { key: "all" as const, label: "전체" },
          { key: 1 as const, label: "1학년" },
          { key: 2 as const, label: "2학년" },
          { key: 3 as const, label: "3학년" },
        ].map((b) => {
          const active = filter === b.key;
          return (
            <button
              key={String(b.key)}
              type="button"
              onClick={() => setFilter(b.key)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]",
              )}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* ── D-day 카운터 카드 ── */}
      <DdayCard exam={upcoming} today={today} />

      {/* ── 월별 타임라인 ── */}
      <div className="mt-6">
        {groupedByMonth.length === 0 && (
          <p className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-sm text-gray-400 dark:border-white/[0.06] dark:bg-[#16162a]">
            해당 학년의 평가 일정이 없습니다.
          </p>
        )}

        {groupedByMonth.map(([month, exams]) => (
          <section key={month} className="mb-6">
            {/* 월 헤더 (sticky) */}
            <div className="sticky top-0 z-10 -mx-4 mb-2 bg-gray-50/95 px-4 py-2 text-base font-bold text-gray-700 backdrop-blur dark:bg-[#0d0d1a]/95 dark:text-gray-200 md:-mx-6 md:px-6">
              {month}월
            </div>

            {/* 좌측 세로 라인 + 카드 리스트 */}
            <div className="relative border-l-2 border-indigo-200 pl-4 dark:border-indigo-500/30">
              <div className="flex flex-col gap-3">
                {exams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    today={today}
                    open={openId === exam.id}
                    onToggle={() =>
                      setOpenId((cur) => (cur === exam.id ? null : exam.id))
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </motion.div>
  );
}

// ── D-day 카드 ─────────────────────────────────────────
function DdayCard({ exam, today }: { exam: Exam | null; today: Date | null }) {
  if (!today) {
    // 첫 페인트 — today 가 아직 없으므로 자리만 잡고 빈 카드
    return (
      <div className="h-[112px] animate-pulse rounded-xl bg-gradient-to-r from-indigo-500/40 to-purple-500/40" />
    );
  }
  if (!exam) {
    return (
      <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-6 text-center text-white shadow-lg">
        <p className="text-sm font-medium opacity-90">올해 시험 일정이 모두 종료되었습니다</p>
      </div>
    );
  }

  const start = ymdToDate(exam.date);
  const end = exam.dateEnd ? ymdToDate(exam.dateEnd) : start;
  const dStart = daysBetween(today, start);
  const dEnd = daysBetween(today, end);
  const isDDay = dStart <= 0 && dEnd >= 0;

  const bigText = isDDay ? "D-DAY 🔥" : `D-${dStart}`;

  // 날짜 표시: "2026.03.24 (화)" / "2026.04.28 ~ 04.30"
  const startStr = exam.date.replace(/-/g, ".");
  const endStr = exam.dateEnd ? exam.dateEnd.slice(5).replace("-", ".") : null;
  const dateStr = endStr ? `${startStr} ~ ${endStr}` : `${startStr} (${WEEKDAY_KR[start.getDay()]})`;

  return (
    <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-5 text-white shadow-[0_8px_28px_rgba(124,58,237,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80">
            <CalendarDays className="h-3.5 w-3.5" />
            다가오는 시험
          </p>
          <p className="mt-1 truncate text-base font-bold sm:text-lg">{exam.title}</p>
          <p className="mt-0.5 text-xs text-white/80">
            {dateStr}
            {exam.organizer ? ` · ${exam.organizer}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-3xl font-extrabold tabular-nums sm:text-4xl">
          {bigText}
        </p>
      </div>
    </div>
  );
}

// ── 시험 카드 ─────────────────────────────────────────
function ExamCard({
  exam,
  today,
  open,
  onToggle,
}: {
  exam: Exam;
  today: Date | null;
  open: boolean;
  onToggle: () => void;
}) {
  const { day, weekday } = dateRangeLabel(exam);
  const dlabel = today ? ddayLabel(exam, today) : "";
  const isPast = today
    ? daysBetween(today, ymdToDate(exam.dateEnd ?? exam.date)) < 0
    : false;

  return (
    <div
      className={cn(
        "rounded-xl border-l-4 bg-white shadow-sm transition-shadow dark:bg-[#16162a]",
        TYPE_BORDER[exam.type],
        isPast && "opacity-50",
        "border-y border-r border-gray-100 dark:border-white/[0.06]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-stretch gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.02] sm:gap-4"
      >
        {/* 날짜 — 모바일은 좁게, sm+ 는 24/20 폭 */}
        <div className="flex w-14 shrink-0 flex-col items-center justify-center sm:w-20">
          <span className="text-xl font-extrabold text-gray-900 dark:text-white sm:text-2xl">
            {day}
          </span>
          {!exam.dateEnd && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{weekday}</span>
          )}
        </div>

        {/* 가운데 — 제목 + 메타 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                TYPE_BADGE[exam.type],
              )}
            >
              {exam.type}
            </span>
            {exam.grades.map((g) => (
              <span
                key={g}
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  GRADE_BADGE[g],
                )}
              >
                {g}학년
              </span>
            ))}
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {exam.title}
          </h3>
          {exam.organizer && (
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {exam.organizer}
            </p>
          )}
        </div>

        {/* 우측 — D-day + 토글 아이콘 */}
        <div className="flex w-16 shrink-0 flex-col items-end justify-center gap-1 sm:w-20">
          <span
            className={cn(
              "text-sm font-extrabold tabular-nums",
              dlabel === "D-DAY 🔥"
                ? "text-rose-500"
                : dlabel === "완료 ✓"
                  ? "text-gray-400"
                  : "text-indigo-600 dark:text-indigo-400",
            )}
          >
            {dlabel}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* 출제범위 아코디언 */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-t border-gray-100 dark:border-white/[0.06]"
          >
            <ScopeBody exam={exam} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 출제범위 본문 ───────────────────────────────────────
function ScopeBody({ exam }: { exam: Exam }) {
  const grades = Object.keys(exam.scope).map(Number).sort();
  const [activeGrade, setActiveGrade] = useState<number | null>(grades[0] ?? null);

  // exam 이 바뀔 때 active 갱신 — 같은 패널에서 다른 시험이 열릴 일은 없지만 안전장치.
  useEffect(() => {
    setActiveGrade(grades[0] ?? null);
  }, [exam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (grades.length === 0) {
    return (
      <div className="px-4 py-5 text-center text-sm text-gray-500 dark:text-gray-400">
        📋 시험 범위가 공지되면 업데이트됩니다.
      </div>
    );
  }

  const subjects = activeGrade !== null ? Object.entries(exam.scope[activeGrade]) : [];

  return (
    <div className="px-4 py-4">
      {/* 학년 탭 — 가로 스크롤 */}
      {grades.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {grades.map((g) => {
            const active = activeGrade === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setActiveGrade(g)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]",
                )}
              >
                {g}학년
              </button>
            );
          })}
        </div>
      )}

      {/* 과목 테이블 */}
      <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-white/[0.06]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
            <tr>
              <th className="w-32 px-3 py-2 text-left sm:w-36">과목</th>
              <th className="px-3 py-2 text-left">출제범위</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {subjects.map(([sub, range]) => (
              <tr key={sub} className="bg-white dark:bg-transparent">
                <td className="whitespace-nowrap px-3 py-2 align-top text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {sub}
                </td>
                <td className="px-3 py-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  {range}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 전체 일정 보기 링크 (모바일에서 하단 anchor) */}
      <div className="mt-3 flex justify-end">
        <Link
          href="/exam-schedule"
          className="text-[11px] text-gray-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          학사일정 캘린더에서 보기 <ChevronRight className="inline h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
