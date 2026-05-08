"use client";

// 대시보드 상단 히어로 배너 슬라이더 — Supabase 'banners' 테이블에서 활성 배너 로드.
//   · image_url 있음 → 이미지 풀블리드 + 그라데이션 오버레이 + 텍스트
//   · image_url 없음 → 단색 배경 + 텍스트 (기존 스타일과 유사)
//   · 0개면 슬라이더 자체 숨김
//   · 자동 4초 슬라이드, 좌/우 버튼, 터치 스와이프, pill 인디케이터

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listActiveBanners, type Banner } from "@/lib/banners";

const SWIPE_THRESHOLD = 50; // px
const SLIDE_INTERVAL_MS = 4000;

export function BannerSlider() {
  const [banners, setBanners] = useState<Banner[]>([]);
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
        setBanners(data);
        setCurrent(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = banners.length;

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
      <div className="relative h-[200px] animate-pulse overflow-hidden rounded-2xl bg-gray-200 dark:bg-white/[0.06] md:h-[280px]" />
    );
  }

  // 배너 0개 → 숨김
  if (total === 0) return null;

  const b = banners[current];
  const hasImage = !!b.image_url;
  const hasLink = !!b.link && b.link.trim().length > 0;

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

          {/* 텍스트 영역 */}
          <div className="relative z-10 flex h-full w-[80%] flex-col justify-center gap-2 px-5 md:w-[70%] md:gap-3 md:px-10">
            <h2
              className="line-clamp-2 text-[18px] font-extrabold leading-snug text-white md:text-[28px]"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
            >
              {b.title}
            </h2>

            {b.description && (
              <p
                className="line-clamp-2 text-[12px] font-medium leading-relaxed text-white/90 md:text-sm"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}
              >
                {b.description}
              </p>
            )}

            {hasLink && (
              <Link
                href={b.link!}
                className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-900 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 md:px-5 md:py-2 md:text-sm"
              >
                자세히 보기 →
              </Link>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 좌/우 버튼 — 2개 이상일 때만 */}
      {total > 1 && (
        <>
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

          {/* pill 인디케이터 */}
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
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
        </>
      )}
    </div>
  );
}
