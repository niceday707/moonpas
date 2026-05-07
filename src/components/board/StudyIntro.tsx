"use client";

// 스터디 모집 게시판 상단 — 초록+청록 그라데이션 + 과목 필터 탭.
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { STUDY_SUBJECTS, type StudySubject } from "@/lib/board";
import { cn } from "@/lib/utils";

type Props = {
  selected: "" | StudySubject;
  onSelect: (s: "" | StudySubject) => void;
};

/** 과목별 활성 색상 — 비활성은 공통 회색 톤 */
const ACTIVE_COLOR: Record<StudySubject, string> = {
  korean: "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  english: "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  math: "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  science: "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  social: "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  etc: "border-gray-400 bg-gray-400/10 text-gray-600 dark:text-gray-300",
};

export function StudyIntro({ selected, onSelect }: Props) {
  return (
    <div className="space-y-4">
      {/* 히어로 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
              MoonPas · Study Group
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              스터디 모집 📖
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              함께 공부하면 2배 효과! 과목·시간·장소를 적어 친구를 모아보세요.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 과목 필터 탭 */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-1.5">
          <button
            type="button"
            onClick={() => onSelect("")}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
              selected === ""
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
            )}
          >
            전체
          </button>
          {STUDY_SUBJECTS.map((s) => {
            const active = selected === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onSelect(s.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
                  active
                    ? ACTIVE_COLOR[s.value]
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
