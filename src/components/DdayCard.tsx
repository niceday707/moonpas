"use client";

// 대시보드 — 수능 D-Day 카드
//  · 다가오는 수능까지 남은 일수, 응원 메시지 랜덤 노출
//  · 그라데이션 + 절제된 sparkle/glow 효과 (보라→파랑 톤)

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

// 매년 학년도 → 수능 시행일 (대학수학능력시험 — 11월 셋째주 목요일)
const SUNEUNG_DATES: Array<{ year: number; date: Date; label: string }> = [
  { year: 2025, date: new Date(2025, 10, 13), label: "2025학년도 대학수학능력시험" },
  { year: 2026, date: new Date(2026, 10, 19), label: "2026학년도 대학수학능력시험" },
  { year: 2027, date: new Date(2027, 10, 18), label: "2027학년도 대학수학능력시험" },
  { year: 2028, date: new Date(2028, 10, 16), label: "2028학년도 대학수학능력시험" },
];

const ENCOURAGE = [
  "오늘도 한 걸음 더! 💪",
  "꾸준함이 실력이 됩니다 📚",
  "너의 노력은 빛날 거야 ✨",
  "포기하지 마, 할 수 있어! 🔥",
  "목표를 향해 달려가자 🏃",
  "지금 이 순간이 미래의 너를 만든다 🌟",
  "한 문제씩, 한 페이지씩 📖",
  "흔들려도 괜찮아, 다시 일어나면 돼 🌱",
] as const;

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatLongDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

function diffInDays(target: Date, base: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  return Math.round((t - b) / ms);
}

function pickNextSuneung(now: Date) {
  const future = SUNEUNG_DATES.find((s) => diffInDays(s.date, now) >= 0);
  return future ?? SUNEUNG_DATES[SUNEUNG_DATES.length - 1];
}

export function DdayCard() {
  // SSR/CSR 일관성을 위해 마운트 후에만 날짜 계산
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
  }, []);

  const target = useMemo(() => (today ? pickNextSuneung(today) : null), [today]);
  const dday = useMemo(() => (today && target ? diffInDays(target.date, today) : null), [today, target]);

  // 매번 마운트마다 응원 메시지 랜덤
  const message = useMemo(() => {
    if (!today) return ENCOURAGE[0];
    return ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
  }, [today]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 shadow-lg shadow-violet-500/10 dark:border-white/[0.08]">
      {/* 그라데이션 배경 */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #4c1d95 0%, #6d28d9 35%, #2563eb 75%, #0891b2 100%)",
        }}
      />
      {/* 부드러운 라디얼 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 80% 0%, rgba(255,255,255,0.18) 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 0% 100%, rgba(6,182,212,0.25) 0%, transparent 70%)",
        }}
      />

      {/* 절제된 sparkle 점들 */}
      <Sparkleset />

      {/* 콘텐츠 */}
      <div className="relative z-10 px-5 py-5 text-white">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/70">
          <Sparkles className="h-3 w-3" />
          수능 D-DAY
        </div>

        <div className="flex items-end gap-2">
          <span className="text-[10px] font-semibold leading-none text-white/80">D</span>
          <span className="font-extrabold leading-none tabular-nums tracking-tight" style={{ fontSize: "clamp(2.5rem, 7vw, 3.5rem)" }}>
            {dday == null ? "—" : dday > 0 ? `-${dday}` : dday === 0 ? "-DAY" : `+${Math.abs(dday)}`}
          </span>
        </div>

        {target && (
          <>
            <p className="mt-2 text-sm font-semibold text-white/95">{target.label}</p>
            <p className="text-[11px] text-white/70">{formatLongDate(target.date)}</p>
          </>
        )}

        <motion.div
          key={message}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
        >
          {message}
        </motion.div>
      </div>
    </div>
  );
}

// 11개의 sparkle — 위치/크기/지연 고정 (랜덤은 SSR mismatch 위험)
const SPARKLES = [
  { top: "12%", left: "18%", size: 2, delay: 0 },
  { top: "28%", left: "82%", size: 3, delay: 0.7 },
  { top: "70%", left: "12%", size: 2, delay: 1.4 },
  { top: "55%", left: "92%", size: 2, delay: 0.4 },
  { top: "88%", left: "65%", size: 3, delay: 1.1 },
  { top: "20%", left: "55%", size: 2, delay: 1.8 },
  { top: "42%", left: "30%", size: 2, delay: 2.3 },
  { top: "78%", left: "40%", size: 2, delay: 0.9 },
  { top: "8%", left: "92%", size: 2, delay: 1.6 },
  { top: "60%", left: "60%", size: 2, delay: 2.0 },
  { top: "35%", left: "8%", size: 2, delay: 0.2 },
] as const;

function Sparkleset() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size }}
          animate={{ opacity: [0.15, 0.9, 0.15], scale: [1, 1.4, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
