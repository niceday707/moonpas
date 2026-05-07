"use client";

// 졸업생 게시판 상단 — "선배에게 물어봐"
// 5개 카테고리 카드 + 1:1 멘토 매칭(Coming Soon) 배너.
// 카드 클릭 시 onSelect(category) 로 부모에게 필터값 전달.
import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Sparkles } from "lucide-react";
import { ALUMNI_CATEGORIES, type AlumniCategory } from "@/lib/board";
import { cn } from "@/lib/utils";

type Props = {
  /** 현재 선택된 카테고리 — 빈 문자열이면 전체 */
  selected: "" | AlumniCategory;
  onSelect: (cat: "" | AlumniCategory) => void;
};

export function AlumniIntro({ selected, onSelect }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  function showComingSoon() {
    setToast("준비 중입니다. 곧 만나요! 🤝");
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <div className="space-y-5">
      {/* 히어로 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-700 p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
              MoonPas · Ask a Senior
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              선배에게 물어봐 🎓
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              문태고 졸업생이 전하는 진짜 이야기 — 대학 생활, 전공 선택, 입시 꿀팁까지.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 카테고리 카드 — PC 5열, 모바일 2열+1열 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
            관심 주제 골라보기
          </h2>
          {selected !== "" && (
            <button
              type="button"
              onClick={() => onSelect("")}
              className="text-[11px] font-semibold text-violet-500 hover:text-violet-600 dark:text-violet-300"
            >
              전체보기 →
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {ALUMNI_CATEGORIES.map((c) => {
            const active = selected === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onSelect(active ? "" : c.value)}
                className={cn(
                  "group relative flex h-full flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition",
                  active
                    ? "border-violet-500 bg-violet-500/10 shadow-[0_8px_28px_rgba(124,58,237,0.25)] dark:bg-violet-500/15"
                    : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_8px_22px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a] dark:hover:border-violet-500/40",
                )}
              >
                <span className="text-2xl leading-none">{c.emoji}</span>
                <span
                  className={cn(
                    "text-[12px] font-extrabold leading-snug",
                    active
                      ? "text-violet-700 dark:text-violet-200"
                      : "text-gray-900 dark:text-white",
                  )}
                >
                  {c.label}
                </span>
              </button>
            );
          })}

          {/* Coming Soon — 1:1 멘토 매칭 */}
          <button
            type="button"
            onClick={showComingSoon}
            className="relative col-span-2 flex h-full items-center gap-3 rounded-2xl border border-dashed border-amber-400/70 bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-violet-500/10 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(245,158,11,0.2)] sm:col-span-3 lg:col-span-5"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-xl">
              🤝
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-extrabold text-amber-700 dark:text-amber-200">
                  1:1 멘토 매칭
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 ring-1 ring-inset ring-amber-500/40 dark:text-amber-200">
                  <Sparkles className="h-2.5 w-2.5" />
                  Coming Soon
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                관심 전공 선배와 직접 상담하는 멘토 매칭 기능을 준비 중이에요.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* 토스트 */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-xs font-semibold text-white shadow-xl ring-1 ring-white/10 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}
