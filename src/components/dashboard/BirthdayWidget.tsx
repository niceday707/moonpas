"use client";

// 좌측 사이드바 — 4일치 생일자 위젯 (D-2, D-1, 오늘, D+1)
//   · profiles + birthday_registry 통합 조회
//   · 당일 생일자는 핑크 배경 + 볼드로 강조
//   · 비어 있으면 안내 문구
//   · 하단 "전체 보기 →" 링크 → /birthday

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  fetchBirthdaysOnDays,
  getKstDayRange,
  type BirthdayPerson,
} from "@/lib/birthdays";
import { cn } from "@/lib/utils";

// D-2(모레) → D-1(내일) → 오늘 → D+1(어제) 순서로 위→아래 표시.
// delta 양수 = 미래(다가올 생일), 음수 = 과거(이미 지난 생일).
const DELTAS = [2, 1, 0, -1];

const LABEL_BY_DELTA: Record<number, string> = {
  [-1]: "D+1",
  [0]: "오늘",
  [1]: "D-1",
  [2]: "D-2",
};

type WindowEntry = { delta: number; month: number; day: number };

export function BirthdayWidget() {
  const [people, setPeople] = useState<BirthdayPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const days = getKstDayRange(DELTAS);
    fetchBirthdaysOnDays(days)
      .then((list) => {
        if (!active) return;
        setPeople(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 사람을 delta 순으로 정렬: D-2 → D-1 → 오늘 → D+1
  const days: WindowEntry[] = getKstDayRange(DELTAS).map((d, i) => ({
    delta: DELTAS[i],
    month: d.month,
    day: d.day,
  }));

  const sorted = [...people].sort((a, b) => {
    const aIdx = days.findIndex(
      (d) => d.month === a.birth_month && d.day === a.birth_day,
    );
    const bIdx = days.findIndex(
      (d) => d.month === b.birth_month && d.day === b.birth_day,
    );
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.displayName.localeCompare(b.displayName);
  });

  const deltaForPerson = (p: BirthdayPerson): number | null => {
    const e = days.find(
      (d) => d.month === p.birth_month && d.day === p.birth_day,
    );
    return e ? e.delta : null;
  };

  return (
    <section className="rounded-xl border border-pink-200/60 bg-gradient-to-br from-pink-50 to-yellow-50 p-4 shadow-sm dark:border-pink-500/20 dark:from-pink-500/[0.08] dark:to-yellow-500/[0.05]">
      <header className="mb-2.5 flex items-center gap-1.5">
        <Cake className="h-4 w-4 text-pink-500" />
        <h2 className="text-sm font-bold text-pink-700 dark:text-pink-200">
          🎂 오늘의 생일
        </h2>
      </header>

      {loading ? (
        <ul className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-9 animate-pulse rounded-lg bg-pink-200/40 dark:bg-pink-500/10"
              aria-hidden
            />
          ))}
        </ul>
      ) : sorted.length === 0 ? (
        <p className="rounded-lg bg-white/50 px-3 py-3 text-center text-[12px] text-pink-700/70 dark:bg-white/[0.04] dark:text-pink-200/70">
          이번 주변에 생일인 친구가 없어요 🎂
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sorted.map((p) => {
            const delta = deltaForPerson(p);
            const label = delta != null ? LABEL_BY_DELTA[delta] : "";
            const isToday = delta === 0;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5",
                  isToday
                    ? "bg-pink-500/15 dark:bg-pink-500/20"
                    : "hover:bg-white/60 dark:hover:bg-white/[0.04]",
                )}
              >
                <UserAvatar
                  nickname={p.displayName}
                  role={p.role}
                  avatarUrl={p.avatar_url}
                  size="xs"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[12px]",
                    isToday
                      ? "font-extrabold text-pink-700 dark:text-pink-100"
                      : "font-semibold text-foreground/80",
                  )}
                >
                  {p.displayName}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    isToday
                      ? "bg-pink-500 text-white"
                      : "bg-foreground/10 text-foreground/65",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/birthday"
        className="mt-3 block text-right text-[11px] font-semibold text-pink-600 transition hover:text-pink-700 dark:text-pink-300 dark:hover:text-pink-200"
      >
        전체 보기 →
      </Link>
    </section>
  );
}
