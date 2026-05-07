"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BANNERS = [
  {
    id: 1,
    badge: "시험 안내",
    title: "2학기 중간고사 일정 발표",
    desc: "10월 14일(화) ~ 18일(토) · 학년별 시험 범위 및 시간표 확인",
    cta: "공지 보기",
    href: "/notices",
    from: "#7c3aed",
    to: "#4f46e5",
  },
  {
    id: 2,
    badge: "학교 행사",
    title: "2025 체육대회 D-7",
    desc: "응원 티셔츠 투표 진행 중 · 학급별 준비 사항 확인하세요",
    cta: "참여하기",
    href: "/feed",
    from: "#0891b2",
    to: "#0284c7",
  },
  {
    id: 3,
    badge: "문튜브 NEW",
    title: "유튜브 채널 '문태고 학생자치회' 오픈!",
    desc: "진로·입시·동기부여 영상 매주 업로드 · 지금 바로 구독하세요",
    cta: "유튜브 보기",
    href: "/youtube",
    from: "#dc2626",
    to: "#b91c1c",
  },
  {
    id: 4,
    badge: "2028 대입",
    title: "통합형 수능 개편안 완벽 정리",
    desc: "고교학점제·통합사회과학 핵심 변경점을 한눈에 확인하세요",
    cta: "정보 보기",
    href: "/admission",
    from: "#d97706",
    to: "#b45309",
  },
  {
    id: 5,
    badge: "나눔장터",
    title: "학기말 교재 나눔 이벤트 진행 중",
    desc: "필요 없는 교재·문제집을 후배들에게 나눠주세요",
    cta: "참여하기",
    href: "/market",
    from: "#059669",
    to: "#047857",
  },
];

export function BannerSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % BANNERS.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + BANNERS.length) % BANNERS.length), []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, next]);

  const b = BANNERS[current];

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ height: "140px" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={b.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 flex items-center gap-6 px-6 md:px-10"
          style={{ background: `linear-gradient(135deg, ${b.from} 0%, ${b.to} 100%)` }}
        >
          <div className="flex-1 min-w-0">
            <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 mb-2">
              {b.badge}
            </span>
            <h2 className="text-lg font-extrabold text-white leading-tight md:text-xl truncate">
              {b.title}
            </h2>
            <p className="mt-0.5 text-sm text-white/75 hidden md:block truncate">{b.desc}</p>
          </div>
          <Link
            href={b.href}
            className="shrink-0 rounded-full bg-white/20 hover:bg-white/35 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            {b.cta} →
          </Link>
        </motion.div>
      </AnimatePresence>

      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-black/25 text-white transition-colors hover:bg-black/45"
        aria-label="이전"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-black/25 text-white transition-colors hover:bg-black/45"
        aria-label="다음"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
            aria-label={`배너 ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
