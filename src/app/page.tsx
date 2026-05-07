"use client";

// 랜딩 페이지 (/) — Phillips Andover 스타일의 풀스크린 히어로
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, LogIn } from "lucide-react";
import { FullscreenMenu } from "@/components/landing/FullscreenMenu";

// 배경 슬라이드: 4장의 사진을 6초 간격으로 페이드 전환, 각자 다른 Ken Burns 모션
const SLIDES = [
  { src: "/school1.jpg", kb: "kb-zoom-in" },
  { src: "/school2.jpg", kb: "kb-pan-left-right" },
  { src: "/school3.jpg", kb: "kb-pan-right-left" },
  { src: "/school4.jpg", kb: "kb-zoom-out" },
] as const;

const SLIDE_INTERVAL_MS = 6000;
const FADE_MS = 1500;

export default function LandingPage() {
  const [active, setActive] = useState(0);
  // 이미지 로딩 실패 시 해당 슬라이드는 렌더하지 않고 폴백 그라데이션이 보이도록
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  return (
    <div className="dark relative h-screen w-screen overflow-hidden text-white">
      {/* 폴백 그라데이션 (남색→보라) — 이미지 뒤에 깔리고, 로딩 실패 시 그대로 노출 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(135deg,#0b1340_0%,#1e1b4b_45%,#4c1d95_100%)]"
      />

      {/* 배경 슬라이드 스택 */}
      <div aria-hidden className="absolute inset-0">
        {SLIDES.map((slide, i) => {
          const isActive = i === active;
          if (failed[i]) return null;
          return (
            <div
              key={slide.src}
              className="absolute inset-0 transition-opacity ease-in-out"
              style={{
                opacity: isActive ? 1 : 0,
                transitionDuration: `${FADE_MS}ms`,
              }}
            >
              {/* Ken Burns는 모든 슬라이드에서 계속 동작 (alternate infinite) — 보이는 슬라이드만 페이드로 노출 */}
              <img
                src={slide.src}
                alt=""
                onError={() =>
                  setFailed((prev) => ({ ...prev, [i]: true }))
                }
                className={`h-full w-full object-cover ${slide.kb}`}
                draggable={false}
              />
            </div>
          );
        })}
      </div>

      {/* 파란색→남색 반투명 그라데이션 오버레이 (opacity 0.4) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 bg-[linear-gradient(135deg,#1e3a8a_0%,#0f172a_100%)]"
      />
      {/* 텍스트 가독성을 위한 하단 비네트 (얇게) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.45)_100%)]"
      />

      {/* 상단 바 ───────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-6 md:px-10 md:pt-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="select-none"
        >
          <span className="text-xl font-bold tracking-[0.3em] md:text-2xl">
            MOONTAE
          </span>
        </motion.div>

        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="flex items-center gap-2 md:gap-4"
        >
          <button
            type="button"
            onClick={() => showToast("준비 중인 기능입니다.")}
            aria-label="검색"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold tracking-widest text-white/95 backdrop-blur-sm transition hover:bg-white/20"
          >
            <LogIn className="h-4 w-4" />
            로그인
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-widest text-white/95 transition hover:bg-white/10"
          >
            <Menu className="h-4 w-4" />
            MENU
          </button>
        </motion.nav>
      </header>

      {/* 중앙 하단 히어로 카피 ────────────────────────────────── */}
      <main className="absolute inset-0 z-10 flex flex-col items-center justify-end px-6 pb-20 text-center md:pb-28">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="font-serif text-5xl font-light leading-tight text-white drop-shadow-lg md:text-7xl"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Welcome Home
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: "easeOut" }}
          className="mt-5 max-w-2xl text-sm text-white/85 md:text-base"
        >
          문태고등학교 커뮤니티 · 함께 나누고, 함께 성장하는 공간
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.85, ease: "easeOut" }}
          className="mt-10"
        >
          <Link
            href="/dashboard"
            className="group inline-flex items-center justify-center border border-white/90 bg-transparent px-10 py-3.5 text-xs font-semibold uppercase tracking-[0.3em] text-white transition-colors duration-300 hover:bg-white hover:text-black"
          >
            Discover More
          </Link>
        </motion.div>

        {/* 기존 로그인 진입점 — 작은 텍스트 링크 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="mt-8 flex flex-col items-center gap-2 text-xs text-white/75 md:flex-row md:gap-6"
        >
          <Link
            href="/login"
            className="underline-offset-4 transition hover:text-white hover:underline"
          >
            Google로 로그인
          </Link>
          <span aria-hidden className="hidden text-white/30 md:inline">
            ·
          </span>
          <Link
            href="/login"
            className="underline-offset-4 transition hover:text-white hover:underline"
          >
            학부모 / 졸업생 초대코드
          </Link>
        </motion.div>
      </main>

      {/* 하단 카피라이트 ───────────────────────────────────── */}
      <footer className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-4">
        <p className="text-[11px] tracking-wider text-white/60">
          © 2026 문파스 · 문태고등학교
        </p>
      </footer>

      {/* 토스트 알림 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-0 bottom-16 z-50 flex justify-center px-6"
          >
            <div className="rounded-full border border-white/20 bg-black/70 px-5 py-2.5 text-xs text-white backdrop-blur-md">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 풀스크린 메뉴 */}
      <FullscreenMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
