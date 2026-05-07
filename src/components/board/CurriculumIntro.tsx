"use client";

// 교육과정 가이드 게시판 상단 — 학년별 탭 정보 페이지.
// 하드코딩된 콘텐츠는 추후 관리자 페이지에서 DB 기반으로 교체 가능.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Languages,
  PenLine,
  Microscope,
  Briefcase,
  Music2,
  Palette,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Grade = 1 | 2 | 3;

const GRADES: Grade[] = [1, 2, 3];

const COMMON_SUBJECTS = [
  { icon: PenLine, name: "국어", desc: "독서·문학·화법과 작문 통합" },
  { icon: Calculator, name: "수학", desc: "수학Ⅰ·Ⅱ 기본 개념" },
  { icon: Languages, name: "영어", desc: "독해·청해·작문" },
  { icon: BookOpen, name: "한국사", desc: "역사 흐름과 사료 해석" },
  { icon: Globe, name: "통합사회", desc: "사회 현상 종합 이해" },
  { icon: FlaskConical, name: "통합과학", desc: "물·화·생·지 통합" },
  { icon: Microscope, name: "과학탐구실험", desc: "탐구 활동 중심 평가" },
];

type Track = {
  key: "stem" | "humanities" | "arts";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  required: string[];
  recommended: string[];
};

const TRACKS: Track[] = [
  {
    key: "stem",
    label: "이공계열",
    icon: Calculator,
    color: "from-blue-500 to-cyan-500",
    required: ["미적분", "물리학", "화학"],
    recommended: ["기하", "생명과학", "지구과학", "공학일반"],
  },
  {
    key: "humanities",
    label: "인문계열",
    icon: Briefcase,
    color: "from-amber-500 to-rose-500",
    required: ["세계사", "정치와법", "경제"],
    recommended: ["사회·문화", "윤리와사상", "한국지리", "고전읽기"],
  },
  {
    key: "arts",
    label: "예체능계열",
    icon: Palette,
    color: "from-violet-500 to-pink-500",
    required: ["미술", "음악", "체육"],
    recommended: ["미술감상과비평", "음악감상과비평", "스포츠과학"],
  },
];

const G3_TIMELINE = [
  { months: "3~4월", title: "내신 + 모의고사 동시 점검", desc: "1학기 중간고사·3월 학평으로 현재 위치 파악" },
  { months: "5~6월", title: "수시 자기소개 정리", desc: "1학기 기말고사 + 6월 모평, 학생부 보완 마지막 기회" },
  { months: "7~8월", title: "수능 영역별 약점 보완", desc: "여름방학 집중 학습, EBS 연계 교재 1회독" },
  { months: "9월", title: "9월 모평 + 수시 원서", desc: "최종 지원 전략 확정, 대학별 일정 체크" },
  { months: "10~11월", title: "수능 마무리 + 면접", desc: "실전 모의 + 수시 면접 준비, 컨디션 관리" },
];

export function CurriculumIntro() {
  const [grade, setGrade] = useState<Grade>(1);

  return (
    <div className="space-y-6">
      {/* 히어로 배너 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-violet-500 p-6 sm:p-8"
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
              MoonPas Curriculum Guide
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl">
              문태고 교육과정 가이드
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">
              2022 개정 교육과정 + 고교학점제 안내. 학년별 핵심 정보를 확인하세요.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 학년 탭 */}
      <div>
        <div className="flex gap-1.5 rounded-2xl bg-gray-100 p-1.5 dark:bg-white/[0.04]">
          {GRADES.map((g) => {
            const active = grade === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-bold transition",
                  active
                    ? "bg-white text-violet-600 shadow-[0_2px_8px_rgba(124,58,237,0.18)] dark:bg-[#1a1a30] dark:text-violet-300"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100",
                )}
              >
                {g}학년
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={grade}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-4"
          >
            {grade === 1 && <Grade1Panel />}
            {grade === 2 && <Grade2Panel />}
            {grade === 3 && <Grade3Panel />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 자료실 헤더 */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-gray-900 dark:text-white">
          📁 교육과정 자료실
        </h2>
        <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
          관리자/교사가 업로드한 교육과정 자료입니다. PDF 첨부도 가능합니다.
        </p>
      </section>
    </div>
  );
}

function Grade1Panel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 text-xs leading-relaxed text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/[0.07] dark:text-violet-200">
        <p className="font-bold">📘 2022 개정 교육과정 적용 (2025 입학생부터)</p>
        <p className="mt-1 opacity-90">
          1학년은 진로 탐색을 위한 공통과목 중심으로 운영됩니다. 모든 학생이 동일한 과목을
          이수합니다.
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {COMMON_SUBJECTS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.name}
              className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/[0.07] dark:bg-[#16162a]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-500 dark:text-violet-300">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {s.name}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {s.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Grade2Panel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/[0.07] dark:text-amber-200">
        <p className="font-bold">🎯 진로에 맞는 과목 선택이 중요합니다!</p>
        <p className="mt-1 opacity-90">
          고교학점제 도입으로 졸업까지 <strong>192학점 이상 이수</strong>가
          필요합니다. 진로 계열에 맞는 과목 조합을 신중히 선택하세요.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {TRACKS.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.key}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]"
            >
              <div className={cn("bg-gradient-to-br p-4 text-white", t.color)}>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <p className="text-sm font-extrabold">{t.label}</p>
                </div>
              </div>
              <div className="space-y-3 p-4 text-xs">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    필수 과목
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.required.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    추천 진로선택
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.recommended.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/[0.05] dark:text-gray-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Grade3Panel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs leading-relaxed text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/[0.07] dark:text-rose-200">
        <p className="font-bold">🎓 3학년은 내신 + 수능 병행이 핵심</p>
        <p className="mt-1 opacity-90">
          1학기 내신은 학생부 마무리, 9월부터는 수능에 집중. 시기별 전략이 합격을
          좌우합니다.
        </p>
      </div>

      <ol className="relative space-y-2.5 border-l border-gray-200 pl-5 dark:border-white/[0.07]">
        {G3_TIMELINE.map((t) => (
          <li key={t.months}>
            <span
              aria-hidden
              className="absolute -left-[7px] grid h-3.5 w-3.5 place-items-center rounded-full bg-violet-500 ring-4 ring-violet-500/20"
            />
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/[0.07] dark:bg-[#16162a]">
              <div className="flex items-center gap-2 text-[11px] text-violet-500 dark:text-violet-300">
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="font-bold">{t.months}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                {t.title}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs dark:border-white/[0.07] dark:bg-[#16162a]">
        <p className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
          <Music2 className="h-4 w-4 text-violet-500" />
          마음 관리도 함께
        </p>
        <p className="mt-1 leading-relaxed text-gray-500 dark:text-gray-400">
          입시 시즌엔 수면·식사·운동이 성적만큼 중요합니다. 무리하지 말고 페이스를
          유지하세요.
        </p>
      </div>
    </div>
  );
}
