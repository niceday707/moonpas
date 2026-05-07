"use client";

// 문튜브 게시판 상단 — 빨강+검정 그라데이션 + 카테고리 필터 탭.
import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";
import { YOUTUBE_CATEGORIES, type YoutubeCategory } from "@/lib/board";
import { cn } from "@/lib/utils";

type Props = {
  selected: "" | YoutubeCategory;
  onSelect: (cat: "" | YoutubeCategory) => void;
};

export function YoutubeIntro({ selected, onSelect }: Props) {
  return (
    <div className="space-y-4">
      {/* 히어로 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-black p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-red-500/40 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
            <PlayCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
              MoonPas · MoonTube
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              문튜브 🎬
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              문태고생이 추천하는 영상 모음 — 수능부터 교양까지, 한 번에.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 카테고리 필터 탭 */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-1.5">
          <button
            type="button"
            onClick={() => onSelect("")}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
              selected === ""
                ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-300"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
            )}
          >
            전체
          </button>
          {YOUTUBE_CATEGORIES.map((c) => {
            const active = selected === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onSelect(c.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
                  active
                    ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-300"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                )}
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
