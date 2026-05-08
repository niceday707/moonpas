"use client";

// 대시보드 — 오늘의 급식 카드
//  · /api/meal 호출, 중식/석식 탭 전환, 날짜 네비게이션
//  · 주말/데이터 없음/로딩 상태 분기, 알레르기 번호 뱃지

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Flame, Calendar } from "lucide-react";

// NEIS 알레르기 번호 → 라벨 (1~19)
const ALLERGY_LABEL: Record<number, string> = {
  1: "난류", 2: "우유", 3: "메밀", 4: "땅콩", 5: "대두",
  6: "밀", 7: "고등어", 8: "게", 9: "새우", 10: "돼지고기",
  11: "복숭아", 12: "토마토", 13: "아황산류", 14: "호두", 15: "닭고기",
  16: "쇠고기", 17: "오징어", 18: "조개류", 19: "잣",
};

type MenuItem = { name: string; allergens: number[] };
type MealBlock = { menus: MenuItem[]; kcal: number | null } | null;
type ApiResponse = { date: string; lunch: MealBlock; dinner: MealBlock };

type MealKey = "lunch" | "dinner";

// ── 날짜 유틸 ──────────────────────────────────────────────
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatDateLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function addDays(d: Date, delta: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + delta);
  return n;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── 컴포넌트 ──────────────────────────────────────────────
export function MealCard() {
  const [date, setDate] = useState<Date>(() => new Date());
  const [tab, setTab] = useState<MealKey>("lunch");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  const today = useMemo(() => new Date(), []);
  const weekend = isWeekend(date);

  // fetch
  useEffect(() => {
    if (weekend) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/meal?date=${toYmd(date)}`)
      .then(async (r) => {
        // 500 이어도 body 의 error 메시지를 읽어 사용자에게 노출
        const text = await r.text();
        try {
          const json = JSON.parse(text) as ApiResponse & { error?: string };
          if (cancelled) return;
          if (json.error) {
            setError(json.error);
            setData(null);
            return;
          }
          setData(json);
        } catch {
          if (cancelled) return;
          setError(`응답 파싱 실패 (HTTP ${r.status})`);
          setData(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "급식 정보를 불러오지 못했어요");
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, weekend]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setDate((d) => addDays(d, -1));
  }, []);
  const goNext = useCallback(() => {
    setDirection(1);
    setDate((d) => addDays(d, 1));
  }, []);
  const goToday = useCallback(() => {
    setDirection(1);
    setDate(new Date());
  }, []);

  const block: MealBlock = data ? data[tab] : null;
  const hasMenu = !!block && block.menus.length > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#16162a]">
      {/* 상단 컬러 그라데이션 헤더 */}
      <div className="relative bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50 px-4 py-3 dark:from-orange-500/[0.12] dark:via-amber-500/[0.08] dark:to-yellow-500/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍱</span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">오늘의 급식</h3>
              <p className="text-[10px] text-gray-500 dark:text-white/50">문태고등학교</p>
            </div>
          </div>
          {!isSameDay(date, today) && (
            <button
              onClick={goToday}
              className="rounded-full border border-amber-300/60 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-400/30 dark:bg-white/[0.06] dark:text-amber-300 dark:hover:bg-white/[0.1]"
            >
              오늘
            </button>
          )}
        </div>
      </div>

      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-white/[0.05]">
        <button
          onClick={goPrev}
          aria-label="어제"
          className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.05]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
          <Calendar className="h-3.5 w-3.5 text-violet-500" />
          {formatDateLabel(date)}
        </div>
        <button
          onClick={goNext}
          aria-label="내일"
          className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.05]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 중식/석식 탭 — 주말/데이터 없을 땐 숨김 */}
      {!weekend && (
        <div className="flex border-b border-gray-100 dark:border-white/[0.05]">
          {(["lunch", "dinner"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative flex-1 py-2.5 text-xs font-semibold transition ${
                tab === k
                  ? "text-violet-600 dark:text-violet-300"
                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
            >
              {k === "lunch" ? "🍚 중식" : "🌙 석식"}
              {tab === k && (
                <motion.span
                  layoutId="meal-tab-underline"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-violet-500"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* 본문 */}
      <div className="relative min-h-[180px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${toYmd(date)}-${tab}-${weekend ? "w" : "d"}`}
            initial={{ opacity: 0, x: direction * 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="px-4 py-4"
          >
            {weekend ? (
              <EmptyState emoji="🌤️" title="주말에는 급식이 없어요" subtitle="평일에 다시 만나요" />
            ) : loading ? (
              <SkeletonMenu />
            ) : error ? (
              <EmptyState emoji="⚠️" title={error} subtitle="잠시 후 다시 시도해주세요" />
            ) : !hasMenu ? (
              <EmptyState
                emoji="📭"
                title="급식 정보가 아직 등록되지 않았습니다"
                subtitle="조금 뒤에 다시 확인해보세요"
              />
            ) : (
              <ul className="space-y-2">
                {block!.menus.map((m, i) => (
                  <motion.li
                    key={`${m.name}-${i}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="flex items-center gap-2"
                  >
                    <span className="h-1 w-1 shrink-0 rounded-full bg-violet-400 dark:bg-violet-500" />
                    <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">
                      {m.name}
                    </span>
                    {m.allergens.length > 0 && (
                      <span className="flex flex-wrap items-center justify-end gap-1">
                        {m.allergens.map((n) => (
                          <span
                            key={n}
                            title={ALLERGY_LABEL[n] ?? `알레르기 ${n}`}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
                          >
                            {n}
                          </span>
                        ))}
                      </span>
                    )}
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 칼로리 푸터 */}
      {!weekend && hasMenu && block!.kcal != null && (
        <div className="flex items-center justify-end gap-1 border-t border-gray-100 px-4 py-2 dark:border-white/[0.05]">
          <Flame className="h-3 w-3 text-orange-500" />
          <span className="text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
            {block!.kcal!.toFixed(1)} kcal
          </span>
        </div>
      )}
    </div>
  );
}

// ── 보조 컴포넌트 ─────────────────────────────────────────
function EmptyState({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <span className="mb-2 text-3xl">{emoji}</span>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {subtitle && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}

function SkeletonMenu() {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="h-1 w-1 shrink-0 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
          <span
            className="h-3 animate-pulse rounded bg-gray-200 dark:bg-white/[0.06]"
            style={{ width: `${50 + ((i * 13) % 35)}%` }}
          />
        </li>
      ))}
    </ul>
  );
}

