"use client";

// 학생자치회 게시판 상단 — 자치회 소개 + 회장/부회장 카드.
// 기본값은 "추후 업데이트". 추후 관리자 페이지에서 DB 기반으로 교체 가능.
import { motion } from "framer-motion";
import { Megaphone, Users } from "lucide-react";

type Officer = {
  role: string; // 회장 / 부회장 / ...
  name: string; // 닉네임
  bio: string; // 한줄 소개
  emoji: string;
};

const OFFICERS: Officer[] = [
  {
    role: "회장",
    name: "추후 업데이트",
    bio: "학생들의 목소리를 학교에 전달하고, 학교생활을 더 즐겁게 만드는 게 목표입니다.",
    emoji: "👑",
  },
  {
    role: "부회장",
    name: "추후 업데이트",
    bio: "회장과 함께 자치회를 운영하며, 행사 기획과 학생 의견 수렴을 담당합니다.",
    emoji: "✨",
  },
];

const ACTIVITY_HIGHLIGHTS = [
  "학년/학급 건의사항 수렴",
  "체육대회·축제 등 학교 행사 기획",
  "학교 시설·급식·복지 관련 협의",
  "동아리 박람회·교내 캠페인 운영",
];

export function CouncilIntro() {
  return (
    <div className="space-y-6">
      {/* 히어로 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-violet-500 to-cyan-500 p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
              MoonPas Student Council
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              문태고 학생자치회
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              학생을 대표하는 자치 기구입니다. 건의사항·아이디어를 자유롭게 남겨주세요.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 소개 + 활동 */}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-[#16162a]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-violet-500 dark:text-violet-300">
            <Megaphone className="h-3.5 w-3.5" />
            자치회 소개
          </div>
          <p className="mt-2 text-sm font-extrabold text-gray-900 dark:text-white">
            학생들의 목소리가 모이는 곳
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            문태고 학생자치회는 학생들의 의견을 학교에 전달하고, 더 즐겁고 의미 있는
            학교생활을 함께 만들어가는 자치 기구입니다. 누구나 이 게시판에 건의·제안·질문을
            남길 수 있어요.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-[#16162a]">
          <p className="text-xs font-bold text-violet-500 dark:text-violet-300">
            주요 활동
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
            {ACTIVITY_HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-1.5">
                <span className="mt-0.5 text-violet-500">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 임원 카드 */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold text-gray-900 dark:text-white">
          이번 학기 임원진
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {OFFICERS.map((o) => (
            <div
              key={o.role}
              className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#16162a]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-2xl">
                {o.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-300">
                  {o.role}
                </p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-gray-900 dark:text-white">
                  {o.name}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {o.bio}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 게시글 헤더 */}
      <section>
        <h2 className="mb-2 text-sm font-extrabold text-gray-900 dark:text-white">
          📝 자치회 게시판
        </h2>
        <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
          학생회 공지부터 건의사항까지 — 누구나 글을 남길 수 있습니다.
        </p>
      </section>
    </div>
  );
}
