"use client";

// 대시보드 상단 히어로 배너 슬라이더.
//  · 배너마다 고유한 그라데이션 + 패턴 + 큰 이모지로 시각적 차별화
//  · 모바일 200px / PC 280px, 좌측 텍스트 60% / 우측 이모지 40%
//  · 자동 4초 슬라이드, fade + slight scale 전환, pill 모양 인디케이터, 터치 스와이프

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PatternKind = "stripes" | "dots" | "sparkle" | "waves" | "zigzag";

type Banner = {
  id: number;
  /** 좌측 상단 카테고리 칩 텍스트 */
  tag: string;
  /** 칩 색상 hint — Tailwind 색 토큰 */
  tagAccent: "violet" | "rose" | "pink" | "cyan" | "emerald";
  title: string;
  cta: string;
  link: string;
  /** 그라데이션 hex 시작/끝 */
  from: string;
  to: string;
  /** 우측 큰 이모지 */
  emoji: string;
  /** 배경 패턴 종류 */
  pattern: PatternKind;
};

// 5개 배너 — 각자 다른 색감/패턴/이모지로 차별화.
// 라우트는 현재 존재하는 게시판(`/board/[boardType]`)에 매핑.
//  · 이벤트(정회원 미션): 전용 게시판이 아직 없어 공지로 연결
//  · 챌린지(공부 인증): 기존 challenge 게시판 사용
const BANNERS: Banner[] = [
  {
    id: 1,
    tag: "2028 대입",
    tagAccent: "violet",
    title: "통합형 수능 개편안 완벽 정리",
    cta: "자세히 보기",
    link: "/board/college",
    from: "#6366f1",
    to: "#4f46e5",
    emoji: "🎓",
    pattern: "stripes",
  },
  {
    id: 2,
    tag: "공지",
    tagAccent: "rose",
    title: "2학기 중간고사 일정 발표",
    cta: "공지 보기",
    link: "/board/notice",
    from: "#f97316",
    to: "#ef4444",
    emoji: "📢",
    pattern: "dots",
  },
  {
    id: 3,
    tag: "이벤트",
    tagAccent: "pink",
    title: "정회원 미션 도전하고 뱃지 받자!",
    cta: "참여하기",
    link: "/board/notice",
    from: "#ec4899",
    to: "#8b5cf6",
    emoji: "🎉",
    pattern: "sparkle",
  },
  {
    id: 4,
    tag: "커뮤니티",
    tagAccent: "cyan",
    title: "자유게시판에서 소통해요",
    cta: "구경하기",
    link: "/board/free",
    from: "#06b6d4",
    to: "#3b82f6",
    emoji: "💬",
    pattern: "waves",
  },
  {
    id: 5,
    tag: "챌린지",
    tagAccent: "emerald",
    title: "공부 인증 챌린지 진행 중!",
    cta: "도전하기",
    link: "/board/challenge",
    from: "#10b981",
    to: "#059669",
    emoji: "🔥",
    pattern: "zigzag",
  },
];

const TAG_STYLE: Record<Banner["tagAccent"], string> = {
  violet: "bg-violet-200/95 text-violet-800",
  rose: "bg-rose-100/95 text-rose-700",
  pink: "bg-pink-100/95 text-pink-700",
  cyan: "bg-cyan-100/95 text-cyan-700",
  emerald: "bg-emerald-100/95 text-emerald-800",
};

/** 배너 배경 패턴 — 반투명 화이트 라인/도형으로 그라데이션 위에 텍스처 추가 */
function patternStyle(p: PatternKind): React.CSSProperties {
  switch (p) {
    case "stripes":
      // 대각선 스트라이프 (대입정보용)
      return {
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent 0 14px, rgba(255,255,255,0.10) 14px 28px)",
      };
    case "dots":
      // 도트 패턴 (공지용)
      return {
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.18) 1.4px, transparent 1.6px)",
        backgroundSize: "16px 16px",
      };
    case "sparkle":
      // 별/반짝이 — 작은 점들 + 큰 별 모양 글로우 (이벤트용)
      return {
        backgroundImage: [
          "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.55) 0 1.5px, transparent 2.5px)",
          "radial-gradient(circle at 70% 18%, rgba(255,255,255,0.55) 0 1.5px, transparent 2.5px)",
          "radial-gradient(circle at 38% 70%, rgba(255,255,255,0.55) 0 1.5px, transparent 2.5px)",
          "radial-gradient(circle at 85% 60%, rgba(255,255,255,0.55) 0 2px, transparent 3px)",
          "radial-gradient(circle at 55% 90%, rgba(255,255,255,0.45) 0 1.2px, transparent 2px)",
          "radial-gradient(circle at 25% 45%, rgba(255,255,255,0.4) 0 1.2px, transparent 2px)",
        ].join(", "),
      };
    case "waves":
      // 가로 물결 (커뮤니티용) — 반투명 라인을 곡선처럼 보이도록 두 겹의 큰 radial
      return {
        backgroundImage: [
          "radial-gradient(ellipse 600px 80px at 0% 30%, rgba(255,255,255,0.18), transparent 60%)",
          "radial-gradient(ellipse 600px 80px at 100% 60%, rgba(255,255,255,0.16), transparent 60%)",
          "repeating-linear-gradient(135deg, transparent 0 22px, rgba(255,255,255,0.06) 22px 24px)",
        ].join(", "),
      };
    case "zigzag":
      // 지그재그 (챌린지용) — 두 방향 사선으로 V 패턴 흉내
      return {
        backgroundImage: [
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 8px, transparent 8px 16px)",
          "repeating-linear-gradient(-45deg, rgba(255,255,255,0.08) 0 8px, transparent 8px 16px)",
        ].join(", "),
      };
  }
}

const SWIPE_THRESHOLD = 50; // px

export function BannerSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % BANNERS.length),
    [],
  );
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + BANNERS.length) % BANNERS.length),
    [],
  );

  // 자동 슬라이드 — 4초
  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, next]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  }

  const b = BANNERS[current];

  return (
    <div
      className="relative h-[200px] overflow-hidden rounded-2xl md:h-[280px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={b.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${b.from} 0%, ${b.to} 100%)`,
          }}
        >
          {/* 패턴 오버레이 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={patternStyle(b.pattern)}
          />

          {/* 우측 큰 이모지 — 약간 잘려 나가는 듯한 인상으로 배치 */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none text-[150px] leading-none opacity-25 drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)] md:-right-6 md:text-[230px]"
          >
            {b.emoji}
          </div>

          {/* 좌측 텍스트 영역 (60%) */}
          <div className="relative z-10 flex h-full w-[62%] flex-col justify-center gap-2.5 px-5 md:w-[60%] md:gap-3 md:px-10">
            <span
              className={
                "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm " +
                TAG_STYLE[b.tagAccent]
              }
            >
              {b.tag}
            </span>

            <h2
              className="line-clamp-2 text-[18px] font-extrabold leading-snug text-white md:text-[28px]"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
            >
              {b.title}
            </h2>

            <Link
              href={b.link}
              className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-900 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 md:px-5 md:py-2 md:text-sm"
            >
              {b.cta} →
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 좌/우 이동 버튼 */}
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 md:left-3 md:h-9 md:w-9"
        aria-label="이전"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 md:right-3 md:h-9 md:w-9"
        aria-label="다음"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* pill 인디케이터 — 활성: 24px, 비활성: 6px */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`배너 ${i + 1}`}
            className={
              "h-1.5 rounded-full bg-white transition-all duration-300 " +
              (i === current ? "w-6 opacity-100" : "w-1.5 opacity-50")
            }
          />
        ))}
      </div>
    </div>
  );
}
