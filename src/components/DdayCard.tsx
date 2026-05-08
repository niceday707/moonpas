"use client";

// 대시보드 — D-Day 카드 (관리자가 dday_events 에 등록한 이벤트 표시)
//   · 글래스모피즘 + 학교 로고 워터마크 (우하단)
//   · 여러 이벤트면 자동 슬라이드 + 탭 인디케이터
//   · 이벤트 없으면 안내 메시지
//   · 지난 이벤트는 D+N 으로 표시
//   · 30+ 명언, 날짜 해시로 매일 다른 문구

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { listActiveDdayEvents, type DdayEvent } from "@/lib/dday-events";

// 30+ 동기부여 명언
const QUOTES: Array<{ text: string; author: string }> = [
  { text: "천 리 길도 한 걸음부터.", author: "노자" },
  { text: "노력은 배신하지 않는다.", author: "이소룡" },
  { text: "오늘 할 수 있는 일을 내일로 미루지 마라.", author: "벤자민 프랭클린" },
  { text: "작은 기회로부터 종종 위대한 업적이 시작된다.", author: "데모스테네스" },
  { text: "끊임없이 노력하는 것, 그것이 천재다.", author: "아이작 뉴턴" },
  { text: "독서는 지식의 재료를 공급할 뿐이며, 그것을 자기 것으로 만드는 것은 사색이다.", author: "존 로크" },
  { text: "배움에는 왕도가 없다.", author: "유클리드" },
  { text: "내일은 내일의 태양이 뜬다.", author: "스칼렛 오하라" },
  { text: "나는 천천히 가는 사람이지만 결코 뒤로 가지는 않는다.", author: "에이브러햄 링컨" },
  { text: "아직 시간이 있다고 생각하는 것이 시간을 잃게 만든다.", author: "프란츠 카프카" },
  { text: "성공의 비결은 잘할 수 있는 일에 광적으로 집중하는 것이다.", author: "톰 모나건" },
  { text: "할 수 있다고 믿든 없다고 믿든, 믿는 대로 될 것이다.", author: "헨리 포드" },
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
  { text: "한 권의 책으로 자기 삶의 새 시대를 본 사람이 너무도 많다.", author: "헨리 데이비드 소로" },
  { text: "6시간 동안 나무를 베라고 한다면 4시간을 도끼날 가는 데 쓸 것이다.", author: "에이브러햄 링컨" },
  { text: "오늘의 나는 어제의 내가, 내일의 나는 오늘의 내가 만든다.", author: "정약용" },
  { text: "백성을 가르치지 않고 죄를 묻는 것은 백성을 그물질하는 것과 같다.", author: "세종대왕" },
  { text: "나는 낙심하지 않는다. 잘못된 시도 하나하나가 또 다른 전진이다.", author: "토머스 에디슨" },
  { text: "성공이란 실패에서 실패로 옮겨가면서도 열정을 잃지 않는 능력이다.", author: "윈스턴 처칠" },
  { text: "용기란 두려움의 부재가 아니라 두려움에 대한 저항이다.", author: "마크 트웨인" },
  { text: "기회는 준비된 자에게 찾아온다.", author: "루이 파스퇴르" },
  { text: "꿈은 가슴으로 느끼고, 손으로 적고, 발로 실천하는 것이다.", author: "안창호" },
  { text: "노력 없이 위대한 결과를 얻은 사람을 본 적이 없다.", author: "벤자민 프랭클린" },
  { text: "오늘 흘린 땀은 내일의 보석이 된다.", author: "에디슨" },
];

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

const SLIDE_INTERVAL_MS = 5000;

function parseYmd(yyyymmdd: string): Date | null {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatLongDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY[date.getDay()]})`;
}

function diffInDays(target: Date, base: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  return Math.round((t - b) / ms);
}

function quoteForDate(d: Date): { text: string; author: string } {
  const seed = d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
  return QUOTES[seed % QUOTES.length];
}

// ── 컴포넌트 ──────────────────────────────────────────────
export function DdayCard() {
  const [events, setEvents] = useState<DdayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(() => new Date());
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  // 활성 이벤트 로드
  useEffect(() => {
    let cancelled = false;
    listActiveDdayEvents()
      .then((data) => {
        if (cancelled) return;
        setEvents(data);
        setCurrent(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 1시간마다 now 갱신 (D-Day 숫자 업데이트)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // 자동 슬라이드
  useEffect(() => {
    if (paused || events.length <= 1) return;
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % events.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, events.length]);

  const quote = useMemo(() => quoteForDate(now), [now]);

  // ── 비어있을 때 ──
  if (!loading && events.length === 0) {
    return (
      <div className="relative flex h-[200px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.18)] sm:h-[220px]">
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 py-3.5 text-center text-white">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.06] text-white/50">
            <CalendarDays className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-white/80">
            등록된 D-Day 이벤트가 없습니다.
          </p>
          <p className="text-[11px] text-white/50">
            관리자가 이벤트를 추가하면 여기에 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  const event = events[current];
  const targetDate = event ? parseYmd(event.target_date) : null;
  const dday = event && targetDate ? diffInDays(targetDate, now) : 0;
  const urgent = dday <= 100 && dday >= 0;
  const past = dday < 0;
  const ddayText = dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : `D+${Math.abs(dday)}`;

  return (
    <div
      className="relative flex h-[200px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.18)] sm:h-[220px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* 학교 로고 워터마크 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-6 h-[160px] w-[160px] select-none object-contain opacity-[0.07] sm:h-[180px] sm:w-[180px]"
        style={{ filter: "brightness(0) invert(1)" }}
      />

      {/* 라디얼 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 100% 0%, rgba(251,191,36,0.05) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative z-10 flex h-full flex-col justify-between px-4 py-3.5 text-white sm:px-5 sm:py-4"
        suppressHydrationWarning
      >
        {/* 상단 — 라벨 + 칩 */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/75">
            ✦ D-DAY
          </span>
          {urgent && (
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-200 ring-1 ring-rose-400/40"
            >
              D-100 이내
            </motion.span>
          )}
          {past && (
            <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/55 ring-1 ring-white/10">
              종료된 이벤트
            </span>
          )}
        </div>

        {/* 중단 — D-숫자 + 제목/날짜 (이벤트 전환 애니메이션) */}
        <div className="min-h-0 flex-1 py-2">
          <AnimatePresence mode="wait">
            {event && targetDate && (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col justify-end"
              >
                <div
                  className={
                    "font-black leading-none tabular-nums tracking-tight " +
                    (past
                      ? "text-white/70"
                      : urgent
                        ? "text-rose-300"
                        : "text-white")
                  }
                  style={{ fontSize: "clamp(2.25rem, 6vw, 3rem)" }}
                  suppressHydrationWarning
                >
                  {ddayText}
                </div>
                <p className="mt-1.5 truncate text-[12px] font-semibold text-white/85">
                  {event.title}
                </p>
                <p className="text-[10px] text-white/50">
                  {formatLongDate(targetDate)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 하단 — 탭 인디케이터(여러 개일 때) + 명언 */}
        <div className="space-y-1.5">
          {events.length > 1 && (
            <div className="flex items-center justify-center gap-1">
              {events.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`${e.title} 이벤트 보기`}
                  className={
                    "h-1 rounded-full transition-all " +
                    (i === current
                      ? "w-5 bg-white/80"
                      : "w-1.5 bg-white/25 hover:bg-white/45")
                  }
                />
              ))}
            </div>
          )}
          <motion.div
            key={quote.text}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="border-t border-white/[0.08] pt-2"
          >
            <p className="line-clamp-2 text-[10.5px] italic leading-relaxed text-white/65">
              <span className="mr-0.5 text-white/40">&ldquo;</span>
              {quote.text}
              <span className="ml-0.5 text-white/40">&rdquo;</span>
            </p>
            <p className="mt-0.5 text-right text-[9px] font-semibold tracking-wide text-white/40">
              — {quote.author}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
