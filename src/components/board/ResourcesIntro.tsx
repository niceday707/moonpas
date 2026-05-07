"use client";

// 자료실 게시판 상단 — 남색+보라 그라데이션 + 3개 카테고리 카드.
import { motion } from "framer-motion";
import { FileText, FolderArchive, ScrollText, FileCheck2 } from "lucide-react";
import { type ResourceCategory } from "@/lib/board";
import { cn } from "@/lib/utils";

type Props = {
  selected: "" | ResourceCategory;
  onSelect: (cat: "" | ResourceCategory) => void;
};

const CARDS: {
  value: ResourceCategory;
  label: string;
  hint: string;
  icon: typeof FileText;
  gradient: string;
  iconBg: string;
}[] = [
  {
    value: "exam",
    label: "기출문제",
    hint: "수능·모의고사 기출",
    icon: ScrollText,
    gradient: "from-rose-500/20 via-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/15 text-rose-500 dark:text-rose-300",
  },
  {
    value: "study",
    label: "학습자료",
    hint: "생기부·자소서·가이드",
    icon: FileText,
    gradient: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    iconBg: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300",
  },
  {
    value: "form",
    label: "양식·서류",
    hint: "보고서·신청서 템플릿",
    icon: FileCheck2,
    gradient: "from-blue-500/20 via-blue-500/10 to-transparent",
    iconBg: "bg-blue-500/15 text-blue-500 dark:text-blue-300",
  },
];

export function ResourcesIntro({ selected, onSelect }: Props) {
  return (
    <div className="space-y-4">
      {/* 히어로 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-700 p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
            <FolderArchive className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
              MoonPas · Resources
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              자료실 📁
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              기출·학습자료·양식 한 곳에 — 필요한 자료를 카테고리별로 빠르게 찾아보세요.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 3개 카테고리 카드 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const active = selected === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onSelect(active ? "" : c.value)}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-4 text-left transition",
                "bg-gradient-to-br",
                c.gradient,
                active
                  ? "border-violet-500 shadow-[0_8px_28px_rgba(124,58,237,0.25)] dark:border-violet-400"
                  : "border-gray-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_8px_22px_rgba(124,58,237,0.18)] dark:border-white/[0.07] dark:hover:border-violet-500/40",
              )}
            >
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                  c.iconBg,
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {c.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {c.hint}
                </p>
              </div>
              {active && (
                <span className="absolute right-3 top-3 rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  필터 ON
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected !== "" && (
        <button
          type="button"
          onClick={() => onSelect("")}
          className="text-[11px] font-semibold text-violet-500 hover:text-violet-600 dark:text-violet-300"
        >
          ← 전체 자료 보기
        </button>
      )}
    </div>
  );
}
