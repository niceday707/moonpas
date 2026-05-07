"use client";

// 진로 탐색 로드맵 — /board/senior 상단
// 5개 계열 탭(가로 스크롤) + 적성 체크리스트 + 추천 선택과목 + 대입정보 링크.
import Link from "next/link";
import { motion } from "framer-motion";
import { Compass, ListChecks, BookMarked, ExternalLink } from "lucide-react";
import { CAREER_TRACKS, type CareerTrack } from "@/lib/board";
import { cn } from "@/lib/utils";

type Props = {
  selected: CareerTrack;
  onSelect: (track: CareerTrack) => void;
};

/** 계열별 적성 체크리스트 — 하드코딩 */
const CHECKLIST: Record<CareerTrack, string[]> = {
  science: [
    "수학·과학 문제를 풀 때 시간 가는 줄 모른다",
    "원리·구조를 따져보는 걸 좋아한다",
    "코드·실험·도면 같은 손에 잡히는 결과물을 만들고 싶다",
    "데이터·숫자로 설명하는 게 편하다",
  ],
  humanities: [
    "책·영화·역사 이야기를 오래 곱씹는 편이다",
    "글로 표현하는 것에 자신이 있다",
    "사람·문화·언어에 대한 호기심이 크다",
    "추상적인 개념을 정리하는 게 즐겁다",
  ],
  social: [
    "사회 이슈·뉴스에 관심이 많다",
    "토론·발표할 때 에너지가 올라간다",
    "사람 사이의 관계와 제도를 분석하는 게 흥미롭다",
    "법·정치·경제·심리 중 끌리는 분야가 있다",
  ],
  arts: [
    "그림·음악·운동 등 표현하는 활동에서 만족감을 느낀다",
    "감각적인 디테일에 민감하다",
    "꾸준한 연습·반복을 견딜 수 있다",
    "내 작품·퍼포먼스를 사람들에게 보여주고 싶다",
  ],
  medical: [
    "생명·인체·약 같은 주제에 관심이 깊다",
    "꼼꼼하고 책임감 있다는 말을 자주 듣는다",
    "장기적인 공부량을 감당할 자신이 있다",
    "사람을 돕고 회복시키는 일에 끌린다",
  ],
};

/** 계열별 추천 선택과목 — 하드코딩 (교육과정 가이드 기준) */
const RECOMMENDED_SUBJECTS: Record<CareerTrack, string[]> = {
  science: ["미적분", "기하", "물리학Ⅱ / 화학Ⅱ", "정보 / 인공지능 기초"],
  humanities: ["언어와 매체", "문학", "세계사·동아시아사", "윤리와 사상"],
  social: ["정치와 법", "경제", "사회·문화", "확률과 통계"],
  arts: ["미술 창작 / 음악 연주", "체육 전공실기", "문학 / 화법과 작문", "사회·문화"],
  medical: ["생명과학Ⅱ", "화학Ⅱ", "미적분", "확률과 통계"],
};

/** 계열별 그라데이션 — 히어로/탭 강조용 */
const TRACK_GRADIENT: Record<CareerTrack, string> = {
  science: "from-emerald-500 via-teal-500 to-cyan-500",
  humanities: "from-amber-500 via-orange-500 to-rose-500",
  social: "from-sky-500 via-blue-500 to-indigo-500",
  arts: "from-pink-500 via-fuchsia-500 to-purple-500",
  medical: "from-rose-500 via-red-500 to-orange-500",
};

export function SeniorIntro({ selected, onSelect }: Props) {
  const checks = CHECKLIST[selected];
  const subjects = RECOMMENDED_SUBJECTS[selected];
  const trackInfo = CAREER_TRACKS.find((t) => t.value === selected)!;

  return (
    <div className="space-y-5">
      {/* 히어로 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
            <Compass className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
              MoonPas · Career Roadmap
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              진로 탐색 로드맵 🧭
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              계열별로 알아보는 나의 미래 — 적성 체크리스트, 추천 과목, 선배 인터뷰까지.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 계열 탭 — 가로 스크롤 */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          {CAREER_TRACKS.map((t) => {
            const active = selected === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onSelect(t.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition",
                  active
                    ? "border-transparent bg-gradient-to-r text-white shadow-[0_6px_20px_rgba(16,185,129,0.35)] " +
                        TRACK_GRADIENT[t.value]
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]",
                )}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 체크리스트 + 추천 과목 */}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 적성 체크리스트 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-[#16162a]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-300">
            <ListChecks className="h-3.5 w-3.5" />이 계열이 맞을까?
          </div>
          <p className="mt-1.5 text-sm font-extrabold text-gray-900 dark:text-white">
            {trackInfo.emoji} {trackInfo.label} 적성 체크
          </p>
          <ul className="mt-3 space-y-2">
            {checks.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200"
              >
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-md border border-emerald-300 bg-emerald-50 text-[9px] font-extrabold text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-gray-400">
            3개 이상 공감되면 이 계열을 한 번 더 들여다 볼 만해요.
          </p>
        </div>

        {/* 추천 선택과목 + 대입정보 링크 */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-[#16162a]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-violet-500 dark:text-violet-300">
              <BookMarked className="h-3.5 w-3.5" />
              추천 선택과목
            </div>
            <p className="mt-1.5 text-sm font-extrabold text-gray-900 dark:text-white">
              {trackInfo.label} 지망생을 위한 조합
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-lg bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-inset ring-violet-500/30 dark:text-violet-200"
                >
                  {s}
                </span>
              ))}
            </div>
            <Link
              href="/board/curriculum"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-500 hover:text-violet-600 dark:text-violet-300"
            >
              교육과정 가이드에서 자세히 보기
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <Link
            href="/board/college"
            className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-500/10 via-cyan-500/5 to-transparent p-4 transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(124,58,237,0.18)] dark:border-white/[0.07]"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-300">
                관련 대학 바로가기
              </p>
              <p className="mt-0.5 text-sm font-extrabold text-gray-900 dark:text-white">
                대입정보 카탈로그 둘러보기
              </p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500 text-white transition group-hover:bg-violet-600">
              <ExternalLink className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* 인터뷰 섹션 헤더 */}
      <section>
        <h2 className="mb-1 text-sm font-extrabold text-gray-900 dark:text-white">
          🎙 {trackInfo.label} 선배 인터뷰
        </h2>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {trackInfo.label} 선배들의 진짜 후기 — 지원 동기, 실제 공부, 진로까지.
        </p>
      </section>
    </div>
  );
}
