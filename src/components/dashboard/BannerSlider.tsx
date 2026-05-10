"use client";

// 대시보드 상단 히어로 배너 슬라이더 — Supabase 'banners' 테이블 + 자동 배너(시험/행사) 통합.
//   · image_url 있음 → 이미지 풀블리드 + 그라데이션 오버레이 + 텍스트
//   · image_url 없음 → 단색 배경 + 텍스트 (기존 스타일과 유사)
//   · auto 배너 → CSS 그라디언트 + 이모지 + D-day 텍스트
//   · 0개면 슬라이더 자체 숨김
//   · 자동 4초 슬라이드, 좌/우 버튼, 터치 스와이프, pill 인디케이터

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listActiveBanners, type Banner } from "@/lib/banners";
import {
  getAutoBanners,
  getBirthdayBanners,
  type AutoBanner,
} from "@/lib/autoBanners";

const SWIPE_THRESHOLD = 50; // px
const SLIDE_INTERVAL_MS = 4000;

// 수동(DB) 배너 + 자동(시험/행사) 배너를 같은 슬라이더에서 다루기 위한 통합 타입
type Slide =
  | { kind: "manual"; data: Banner }
  | { kind: "auto"; data: AutoBanner };

export function BannerSlider() {
  const [manualBanners, setManualBanners] = useState<Banner[]>([]);
  const [birthdayBanners, setBirthdayBanners] = useState<AutoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  // 활성 배너 로드
  useEffect(() => {
    let cancelled = false;
    listActiveBanners()
      .then((data) => {
        if (cancelled) return;
        setManualBanners(data);
        setCurrent(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 생일 배너 로드 (비동기 — Supabase 조회)
  useEffect(() => {
    let cancelled = false;
    getBirthdayBanners()
      .then((data) => {
        if (cancelled) return;
        setBirthdayBanners(data);
      })
      .catch(() => {
        // 실패해도 다른 배너는 정상 노출
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 자동 배너 + 수동 배너 합치기 (자동 배너를 앞에 배치 — 시험/행사 정보가 가장 시급)
  const slides = useMemo<Slide[]>(() => {
    const auto = getAutoBanners().map<Slide>((b) => ({ kind: "auto", data: b }));
    const birthday = birthdayBanners.map<Slide>((b) => ({ kind: "auto", data: b }));
    const manual = manualBanners.map<Slide>((b) => ({ kind: "manual", data: b }));
    return [...auto, ...birthday, ...manual];
  }, [manualBanners, birthdayBanners]);

  const total = slides.length;

  const next = useCallback(() => {
    if (total === 0) return;
    setCurrent((c) => (c + 1) % total);
  }, [total]);
  const prev = useCallback(() => {
    if (total === 0) return;
    setCurrent((c) => (c - 1 + total) % total);
  }, [total]);

  // 자동 슬라이드
  useEffect(() => {
    if (paused || total <= 1) return;
    timerRef.current = setInterval(next, SLIDE_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, next, total]);

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

  // 로딩 중에는 스켈레톤 (높이는 유지해서 레이아웃 점프 방지)
  if (loading) {
    return (
      <div className="relative h-[120px] animate-pulse overflow-hidden rounded-2xl bg-gray-200 dark:bg-white/[0.06] md:h-[140px] lg:h-[160px]" />
    );
  }

  // 배너 0개 → 숨김
  if (total === 0) return null;

  // current가 슬라이드 수 변화로 범위를 벗어났을 때 안전 가드
  const safeIndex = Math.min(current, total - 1);
  const slide = slides[safeIndex];

  return (
    <div
      className="relative h-[120px] overflow-hidden rounded-2xl md:h-[140px] lg:h-[160px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.data.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {slide.kind === "manual" ? (
            <ManualSlide banner={slide.data} />
          ) : (
            <AutoSlide banner={slide.data} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* 좌/우 버튼 — 2개 이상일 때만, 배너가 작아진 만큼 버튼도 축소 */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 z-20 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 md:left-2.5 md:h-8 md:w-8"
            aria-label="이전"
          >
            <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 z-20 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 md:right-2.5 md:h-8 md:w-8"
            aria-label="다음"
          >
            <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </button>

          {/* pill 인디케이터 */}
          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`배너 ${i + 1}`}
                className={
                  "h-1.5 rounded-full bg-white transition-all duration-300 " +
                  (i === safeIndex ? "w-6 opacity-100" : "w-1.5 opacity-50")
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── 수동 배너(DB) 렌더 ──────────────────────────────────────
function ManualSlide({ banner: b }: { banner: Banner }) {
  const hasImage = !!b.image_url;
  const hasLink = !!b.link && b.link.trim().length > 0;

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: b.background_color,
        ...(hasImage
          ? {
              backgroundImage: `url(${b.image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {}),
      }}
    >
      {/* 이미지 모드: 가독성을 위한 어두운 그라데이션 오버레이 */}
      {hasImage && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.05) 100%)",
          }}
        />
      )}

      {/* 텍스트 영역 — 축소된 배너에 맞춰 패딩/간격 압축 */}
      <div className="relative z-10 flex h-full w-[80%] flex-col justify-center gap-1 px-4 md:w-[75%] md:gap-1.5 md:px-5 lg:px-6">
        <h2
          className="line-clamp-2 text-lg font-extrabold leading-snug text-white md:text-xl"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
        >
          {b.title}
        </h2>

        {b.description && (
          <p
            className="line-clamp-1 text-xs font-medium leading-relaxed text-white/90 md:line-clamp-2 md:text-sm"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}
          >
            {b.description}
          </p>
        )}

        {hasLink && (
          <Link
            href={b.link!}
            className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-900 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 md:px-3.5 md:py-1.5 md:text-xs"
          >
            자세히 보기 →
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── 자동 배너(시험/행사) 렌더 — 이미지 없이 그라디언트 + 이모지 + 텍스트 ──
function AutoSlide({ banner: b }: { banner: AutoBanner }) {
  const hasLink = !!b.link && b.link.trim().length > 0;

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${b.gradient}`}>
      {/* 우측 큰 이모지 — 배경 데코 */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-[80px] leading-none opacity-20 md:right-5 md:text-[110px]"
      >
        {b.emoji}
      </div>

      {/* 텍스트 영역 */}
      <div className="relative z-10 flex h-full w-[80%] flex-col justify-center gap-1 px-4 md:w-[75%] md:gap-1.5 md:px-5 lg:px-6">
        <div className="flex items-center gap-1.5">
          <span
            className="text-base md:text-lg"
            aria-hidden
          >
            {b.emoji}
          </span>
          <h2
            className="text-lg font-extrabold leading-snug text-white md:text-xl"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
          >
            {b.title}
          </h2>
        </div>

        <p
          className="line-clamp-1 text-xs font-medium leading-relaxed text-white/90 md:line-clamp-2 md:text-sm"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}
        >
          {b.description}
        </p>

        {hasLink && (
          <Link
            href={b.link!}
            className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-900 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 md:px-3.5 md:py-1.5 md:text-xs"
          >
            자세히 보기 →
          </Link>
        )}
      </div>
    </div>
  );
}
