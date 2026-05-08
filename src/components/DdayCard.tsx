"use client";

// 대시보드 — 수능 D-Day 카드
//  · 다가오는 다음 수능까지 남은 일수, 매일 바뀌는 명언, 글래스 + 그라데이션 + 파티클
//  · 100일 이하면 빨간 톤으로 강조
//  · 날짜 계산은 동기적으로 — useState 초기값을 즉시 채움 (null 깜빡임 방지)

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// 학년도별 수능 시행일 — 매년 11월 셋째주 목요일 기준
const SUNEUNG_DATES: Array<{ year: number; date: Date; label: string }> = [
  { year: 2025, date: new Date(2025, 10, 13), label: "2025학년도 대학수학능력시험" },
  { year: 2026, date: new Date(2026, 10, 19), label: "2026학년도 대학수학능력시험" },
  { year: 2027, date: new Date(2027, 10, 18), label: "2027학년도 대학수학능력시험" },
  { year: 2028, date: new Date(2028, 10, 16), label: "2028학년도 대학수학능력시험" },
  { year: 2029, date: new Date(2029, 10, 15), label: "2029학년도 대학수학능력시험" },
];

// 30+ 동기부여 명언 — 한국어 + 해외 위인 실제 인용
const QUOTES: Array<{ text: string; author: string }> = [
  { text: "천 리 길도 한 걸음부터.", author: "노자" },
  { text: "노력은 배신하지 않는다.", author: "이소룡" },
  { text: "오늘 할 수 있는 일을 내일로 미루지 마라.", author: "벤자민 프랭클린" },
  { text: "작은 기회로부터 종종 위대한 업적이 시작된다.", author: "데모스테네스" },
  { text: "끊임없이 노력하는 것, 그것이 천재다.", author: "아이작 뉴턴" },
  { text: "독서는 다만 지식의 재료를 공급할 뿐이며, 그것을 자기 것으로 만드는 것은 사색의 힘이다.", author: "존 로크" },
  { text: "배움에는 왕도가 없다.", author: "유클리드" },
  { text: "내일은 내일의 태양이 뜬다.", author: "스칼렛 오하라" },
  { text: "나는 천천히 가는 사람이지만 결코 뒤로 가지는 않는다.", author: "에이브러햄 링컨" },
  { text: "아직 시간이 있다고 생각하는 것이 시간을 잃게 만든다.", author: "프란츠 카프카" },
  { text: "성공의 비결은 단 한 가지, 잘할 수 있는 일에 광적으로 집중하는 것이다.", author: "톰 모나건" },
  { text: "할 수 있다고 믿든 할 수 없다고 믿든, 믿는 대로 될 것이다.", author: "헨리 포드" },
  { text: "시작이 반이다.", author: "아리스토텔레스" },
  { text: "공부는 미래에게 보내는 가장 확실한 편지다.", author: "정약용" },
  { text: "하루라도 책을 읽지 않으면 입안에 가시가 돋는다.", author: "안중근" },
  { text: "꿈을 향해 자신 있게 걸어가라. 상상해온 삶을 살기 위해 노력하라.", author: "헨리 데이비드 소로" },
  { text: "위대한 일을 하는 유일한 방법은 자신이 하는 일을 사랑하는 것이다.", author: "스티브 잡스" },
  { text: "교육의 뿌리는 쓰지만 그 열매는 달다.", author: "아리스토텔레스" },
  { text: "지식에 투자하는 것이 가장 이익이 큰 투자다.", author: "벤자민 프랭클린" },
  { text: "공부의 목적은 끝없이 배우는 것이 아니라 배운 것을 행하는 것이다.", author: "공자" },
  { text: "어제와 똑같이 살면서 다른 미래를 기대하는 것은 정신병의 초기 증세다.", author: "알베르트 아인슈타인" },
  { text: "낭비한 시간에 대한 후회는 더 큰 시간의 낭비다.", author: "메이슨 쿨리" },
  { text: "할 수 있는 일에 집중하라. 할 수 없는 일에 매달리지 말라.", author: "스티븐 호킹" },
  { text: "스스로 돕는 자를 하늘이 돕는다.", author: "벤자민 프랭클린" },
  { text: "한 권의 책을 읽음으로써 자기의 삶에서 새 시대를 본 사람이 너무도 많다.", author: "헨리 데이비드 소로" },
  { text: "나에게 6시간 동안 나무를 베라고 한다면 4시간을 도끼날을 가는 데 쓸 것이다.", author: "에이브러햄 링컨" },
  { text: "오늘의 나는 어제의 내가 만든 것이고, 내일의 나는 오늘의 내가 만든다.", author: "정약용" },
  { text: "백성을 가르치지 않고 죄를 묻는 것은 백성을 그물질하는 것과 같다.", author: "세종대왕" },
  { text: "나는 낙심하지 않는다. 잘못된 시도 하나하나가 또 다른 전진이기 때문이다.", author: "토머스 에디슨" },
  { text: "성공이란 실패에서 실패로 옮겨가면서도 열정을 잃지 않는 능력이다.", author: "윈스턴 처칠" },
  { text: "용기란 두려움에 대한 저항이고 두려움의 정복이지, 두려움의 부재가 아니다.", author: "마크 트웨인" },
  { text: "기회는 준비된 자에게 찾아온다.", author: "루이 파스퇴르" },
  { text: "꿈은 머리로 생각하는 것이 아니라 가슴으로 느끼는 것이고, 손으로 적고 발로 실천하는 것이다.", author: "안창호" },
  { text: "나는 한 번도 노력 없이 위대한 결과를 얻은 사람을 본 적이 없다.", author: "벤자민 프랭클린" },
  { text: "오늘 흘린 땀은 내일의 보석이 된다.", author: "에디슨" },
];

// ── 유틸 ──────────────────────────────────────────────────
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
  return (
    SUNEUNG_DATES.find((s) => diffInDays(s.date, now) >= 0) ??
    SUNEUNG_DATES[SUNEUNG_DATES.length - 1]
  );
}

// 날짜 기반 해시 — 같은 날에는 같은 명언 (서버/클라 동일)
function quoteForDate(d: Date): { text: string; author: string } {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const seed = y * 372 + m * 31 + day; // 충돌 적은 단순 해시
  return QUOTES[seed % QUOTES.length];
}

function computeInfo(now: Date) {
  const target = pickNextSuneung(now);
  const dday = diffInDays(target.date, now);
  const quote = quoteForDate(now);
  return { target, dday, quote };
}

// ── 컴포넌트 ──────────────────────────────────────────────
export function DdayCard() {
  // 동기 초기값 — 첫 렌더부터 숫자가 나오도록 (이전 useState(null) 깜빡임 버그 수정)
  const [info, setInfo] = useState(() => computeInfo(new Date()));

  // 마운트 후 한번 + 1시간 간격 갱신 (자정 넘어가는 케이스)
  useEffect(() => {
    setInfo(computeInfo(new Date()));
    const id = setInterval(() => setInfo(computeInfo(new Date())), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const { target, dday, quote } = info;
  const urgent = dday <= 100 && dday >= 0;

  // 그라데이션 / 글로우 — 100일 이하면 빨간 톤
  const bgGradient = urgent
    ? "linear-gradient(135deg, #4c1d95 0%, #6d28d9 25%, #be185d 65%, #dc2626 100%)"
    : "linear-gradient(135deg, #4c1d95 0%, #6d28d9 35%, #2563eb 75%, #0891b2 100%)";
  const glow = urgent
    ? "radial-gradient(ellipse 60% 50% at 80% 0%, rgba(255,255,255,0.2) 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 0% 100%, rgba(239,68,68,0.4) 0%, transparent 70%)"
    : "radial-gradient(ellipse 60% 50% at 80% 0%, rgba(255,255,255,0.18) 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 0% 100%, rgba(6,182,212,0.25) 0%, transparent 70%)";

  // D-Day 표시 문자열 — D 와 숫자가 한 폰트로 자연스럽게
  const ddayText =
    dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : `D+${Math.abs(dday)}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border shadow-lg ${
        urgent
          ? "border-red-400/30 shadow-red-500/20"
          : "border-violet-500/20 shadow-violet-500/10"
      } dark:border-white/[0.08]`}
    >
      {/* 그라데이션 배경 */}
      <div aria-hidden className="absolute inset-0" style={{ background: bgGradient }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glow }} />

      {/* 글래스 오버레이 — 매우 옅은 흰 텍스처로 깊이감 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 backdrop-blur-[2px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.15) 100%)",
        }}
      />

      {/* 파티클 — 반짝이 + 별똥별 */}
      <Sparkleset />
      <ShootingStars />

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col gap-3 px-5 py-5 text-white" suppressHydrationWarning>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85 backdrop-blur-sm">
            ✦ 수능 D-DAY
          </span>
          {urgent && (
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="rounded-full bg-red-500/30 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-red-300/50"
            >
              D-100 이내!
            </motion.span>
          )}
        </div>

        {/* 큰 D-숫자 — D 와 숫자 한 폰트로 통일 */}
        <div className="flex items-baseline gap-2">
          <span
            className="font-black leading-none tabular-nums tracking-tight"
            style={{ fontSize: "clamp(3rem, 9vw, 4.75rem)" }}
            suppressHydrationWarning
          >
            {ddayText}
          </span>
        </div>

        <div className="-mt-1">
          <p className="text-sm font-semibold text-white/95">{target.label}</p>
          <p className="text-[11px] text-white/70">{formatLongDate(target.date)}</p>
        </div>

        {/* 명언 카드 — 글래스 박스, 따옴표 스타일 */}
        <motion.div
          key={quote.text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="mt-1 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 backdrop-blur-md"
        >
          <p className="text-[12px] italic leading-relaxed text-white/95">
            <span className="mr-1 text-base text-white/50">“</span>
            {quote.text}
            <span className="ml-1 text-base text-white/50">”</span>
          </p>
          <p className="mt-1 text-right text-[10px] font-semibold tracking-wide text-white/70">
            — {quote.author}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ── 반짝이 11개 (위치/지연 고정 — SSR 일관성) ──────────────
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
          animate={{ opacity: [0.15, 0.95, 0.15], scale: [1, 1.5, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── 별똥별 3개 — 비스듬히 흐르는 라인 ─────────────────────
const SHOOTING = [
  { top: "18%", delay: 0, duration: 6 },
  { top: "48%", delay: 2.5, duration: 7 },
  { top: "72%", delay: 4.5, duration: 5.5 },
] as const;

function ShootingStars() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {SHOOTING.map((s, i) => (
        <motion.span
          key={i}
          className="absolute h-px w-24 origin-left"
          style={{
            top: s.top,
            left: "-20%",
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)",
            transform: "rotate(-20deg)",
          }}
          animate={{ x: ["0vw", "120vw"], opacity: [0, 1, 0] }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            delay: s.delay,
            repeatDelay: 4,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
