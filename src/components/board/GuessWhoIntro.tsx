"use client";

// "누구일까요?" 게시판 상단 인트로 — 보라→핑크 그라데이션, 미스터리/추리 분위기.
import { motion } from "framer-motion";
import { Drama } from "lucide-react";

export function GuessWhoIntro() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-700 via-fuchsia-600 to-pink-500 p-6 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-pink-300/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-purple-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-200/70 to-transparent"
      />

      <div className="relative flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-pink-100 ring-1 ring-inset ring-white/30 backdrop-blur-sm">
          <Drama className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-pink-100/90">
            MOONPAS MYSTERY CORNER
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-snug text-white md:text-3xl">
            누구일까요? 🎭
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/90 sm:text-sm">
            사진 속 주인공은 누구? 선생님들의 추리가 시작됩니다!
          </p>
        </div>
      </div>

      <div className="relative mt-5 rounded-xl bg-white/10 px-4 py-3 text-[11px] font-medium text-white/95 ring-1 ring-inset ring-white/20 backdrop-blur-sm sm:text-sm">
        📸 학생: 사진을 올려주세요 <span className="mx-2 text-white/50">|</span>{" "}
        🧑‍🏫 선생님: 댓글로 이름을 맞춰보세요!
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-pink-200/70 to-transparent"
      />
    </motion.section>
  );
}
