"use client";

// 본인 생일 당일 1회 — confetti + 중앙 오버레이.
// localStorage 키로 하루 한 번만 트리거.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

type Props = {
  birthMonth: number | null;
  birthDay: number | null;
};

function getKstYmd(): { y: number; m: number; d: number } {
  const kst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  return { y: kst.getFullYear(), m: kst.getMonth() + 1, d: kst.getDate() };
}

function fireConfetti() {
  // 좌·우 비스듬히 두 차례 — 자연스러운 폭발 형태
  const duration = 2200;
  const end = Date.now() + duration;

  const colors = ["#ec4899", "#f97316", "#facc15", "#a855f7", "#06b6d4"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function BirthdayCelebration({ birthMonth, birthDay }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (birthMonth === null || birthDay === null) return;
    const { y, m, d } = getKstYmd();
    if (m !== birthMonth || d !== birthDay) return;

    const key = `birthday_celebrated_${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(key)) return;

    localStorage.setItem(key, "1");
    setShow(true);
    fireConfetti();

    // 2초 후 페이드아웃 시작
    const t = window.setTimeout(() => setShow(false), 2000);
    return () => window.clearTimeout(t);
  }, [birthMonth, birthDay]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
        >
          <div className="rounded-3xl bg-gradient-to-br from-pink-500 via-rose-400 to-yellow-400 px-8 py-6 text-center text-white shadow-[0_20px_60px_rgba(244,114,182,0.45)]">
            <p className="text-3xl font-extrabold tracking-tight md:text-4xl">
              🎂 생일 축하합니다! 🎉
            </p>
            <p className="mt-1 text-sm opacity-90">
              오늘 하루 행복으로 가득하길!
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
