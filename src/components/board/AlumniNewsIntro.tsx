"use client";

// 동문 뉴스 게시판 상단 — 보라+남색 그라데이션, 동문 소식 분위기.
import { motion } from "framer-motion";
import { Newspaper } from "lucide-react";

export function AlumniNewsIntro() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][today.getDay()];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900 via-indigo-800 to-blue-900 p-6 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-violet-400/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent"
      />
      <div className="relative flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-400/20 text-violet-200 ring-1 ring-inset ring-violet-300/30 backdrop-blur-sm">
          <Newspaper className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-200/90">
              MoonPas Alumni News
            </p>
            <span className="hidden text-[10px] font-semibold text-white/60 sm:inline">
              ·
            </span>
            <p className="hidden text-[10px] font-semibold tabular-nums text-white/70 sm:block">
              {yyyy}.{mm}.{dd} ({weekday})
            </p>
          </div>
          <h1 className="mt-1 font-extrabold leading-snug text-white">
            <span className="text-xl sm:text-2xl">동문 뉴스 📰</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
            문태고 동문들의 소식을 전합니다 — 동문 근황, 졸업생 인터뷰, 동문회 소식까지.
          </p>
          <p className="mt-2 block text-[10px] font-semibold tabular-nums text-white/70 sm:hidden">
            {yyyy}.{mm}.{dd} ({weekday})
          </p>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent"
      />
    </motion.section>
  );
}
