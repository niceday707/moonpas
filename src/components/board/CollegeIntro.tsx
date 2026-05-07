"use client";

// 대입정보 게시판 상단의 카탈로그형 정보 영역.
// 하드코딩된 콘텐츠는 추후 관리자 페이지에서 DB 기반으로 교체 가능하도록 이 파일에 모아둠.
import Link from "next/link";
import { motion } from "framer-motion";
import {
  GraduationCap,
  FileText,
  FlaskConical,
  Layers,
  ChevronRight,
} from "lucide-react";

const KEY_CHANGES = [
  {
    icon: FileText,
    emoji: "📝",
    title: "통합형 수능",
    desc: "선택과목 폐지, 국어·수학·탐구 모두 공통 범위로 시험",
  },
  {
    icon: FlaskConical,
    emoji: "🔬",
    title: "통합사회·통합과학",
    desc: "문·이과 구분 없이 모든 수험생이 동일 시험 응시",
  },
  {
    icon: Layers,
    emoji: "📊",
    title: "내신 5등급제",
    desc: "9등급 → 5등급 완화, 수능 변별력 더 중요해짐",
  },
];

type University = {
  name: string;
  desc: string;
  region: "metro" | "local";
};

const UNIVERSITIES: University[] = [
  { name: "서울대", desc: "학생부종합 중심, 2028부터 정시에서도 학생부 반영", region: "metro" },
  { name: "연세대", desc: "2026부터 정시에 학생부 반영, 수시 비율 확대", region: "metro" },
  { name: "고려대", desc: "교과요소 대입 반영, 정성평가 확대", region: "metro" },
  { name: "성균관대", desc: "학생부종합·논술전형 다양, 수시 강세", region: "metro" },
  { name: "한양대", desc: "공학·자연계열 강세, 학생부종합 비중 큼", region: "metro" },
  { name: "중앙대", desc: "수시 다빈치형 인재 / 탐구형 인재 전형", region: "metro" },
  { name: "경희대", desc: "네오르네상스 전형 등 비교과 활동 중시", region: "metro" },
  { name: "서강대", desc: "학생부종합·논술 비중 높음, 정시 정량평가", region: "metro" },
  { name: "전남대", desc: "지역인재 전형 확대, 학생부교과 중심", region: "local" },
  { name: "조선대", desc: "수시 비율 높음, 지역인재 특별전형", region: "local" },
  { name: "목포대", desc: "지역 밀착형, 학생부교과 전형 중심", region: "local" },
];

export function CollegeIntro() {
  return (
    <div className="space-y-6">
      {/* 히어로 배너 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500 p-6 sm:p-8"
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
              MoonPas Admission Center
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              2028학년도 대입 정보센터
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              통합형 수능, 5등급 내신, 학생부 강화 — 문태고 학생을 위한 핵심 변화와
              주요 대학 전형을 한 곳에 모았습니다.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 섹션 1 — 핵심 변경사항 */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-gray-900 dark:text-white">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-[10px] font-extrabold text-violet-500 dark:text-violet-300">
            1
          </span>
          2028 수능 핵심 변경사항
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {KEY_CHANGES.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(124,58,237,0.15)] dark:border-white/[0.07] dark:bg-[#16162a]"
            >
              <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-lg">
                {c.emoji}
              </div>
              <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                {c.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {c.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 섹션 2 — 주요 대학별 전형 요약 */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-gray-900 dark:text-white">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-[10px] font-extrabold text-violet-500 dark:text-violet-300">
            2
          </span>
          주요 대학별 전형 요약
        </h2>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {UNIVERSITIES.map((u) => (
            <Link
              key={u.name}
              href={`/board/college?q=${encodeURIComponent(u.name)}`}
              className="group flex h-full flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_8px_22px_rgba(124,58,237,0.18)] dark:border-white/[0.07] dark:bg-[#16162a] dark:hover:border-violet-500/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {u.name}
                </span>
                <span
                  className={
                    "rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-inset " +
                    (u.region === "metro"
                      ? "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300"
                      : "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300")
                  }
                >
                  {u.region === "metro" ? "수도권" : "지역"}
                </span>
              </div>
              <p className="line-clamp-3 flex-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                {u.desc}
              </p>
              <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-500 group-hover:underline dark:text-violet-300">
                자세히 보기 <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 섹션 3 헤더 — 자료실은 외부 List 컴포넌트가 렌더 */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-gray-900 dark:text-white">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-[10px] font-extrabold text-violet-500 dark:text-violet-300">
            3
          </span>
          입시 자료실
        </h2>
        <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
          관리자/교사가 업로드한 입시 자료입니다. PDF 첨부도 가능합니다.
        </p>
      </section>
    </div>
  );
}
