"use client";

// 대시보드 좌측 사이드바용 미니 위젯 — "다음 시험"
// ---------------------------------------------------------------
// 미래 시험 중 가장 가까운 3개를 리스트로 노출. 시험 타입별 색상 점 + 제목 + D-day 뱃지.
// 클릭하면 /exam-schedule 페이지로 이동.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
import { examSchedule2026, type ExamType } from "@/data/examSchedule2026";
import { cn } from "@/lib/utils";

const TYPE_DOT: Record<ExamType, string> = {
  모의고사: "bg-blue-500",
  모의평가: "bg-red-500",
  내신: "bg-green-500",
  수능: "bg-yellow-500",
  영어듣기: "bg-purple-500",
};

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function ExamWidget() {
  // SSR/hydration mismatch 방지 — today 는 마운트 후에 계산
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
  }, []);

  // 오늘 이후로 끝나지 않은 시험 중 가까운 3개
  const upcoming = today
    ? examSchedule2026
        .filter((e) => {
          const end = ymdToDate(e.dateEnd ?? e.date);
          return daysBetween(today, end) >= 0;
        })
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(0, 3)
    : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#16162a]">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-white/[0.05]">
        <div className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400">
          <ClipboardList className="h-4 w-4" />
          📝 다음 시험
        </div>
        <Link
          href="/exam-schedule"
          className="text-[11px] text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
        >
          더보기 <ChevronRight className="inline h-3 w-3" />
        </Link>
      </div>

      {today === null ? (
        // 첫 페인트 자리잡이용 스켈레톤 (3행)
        <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-2 px-4 py-2.5">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-white/[0.06]" />
              <span className="h-3 flex-1 animate-pulse rounded bg-gray-200 dark:bg-white/[0.06]" />
              <span className="h-3 w-10 animate-pulse rounded bg-gray-200 dark:bg-white/[0.06]" />
            </li>
          ))}
        </ul>
      ) : upcoming.length === 0 ? (
        <div className="px-4 py-5 text-center text-[11px] text-gray-400">
          올해 시험 일정이 모두 종료되었어요
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-white/[0.04]">
          {upcoming.map((e) => {
            const start = ymdToDate(e.date);
            const end = ymdToDate(e.dateEnd ?? e.date);
            const dStart = daysBetween(today, start);
            const dEnd = daysBetween(today, end);
            const isDDay = dStart <= 0 && dEnd >= 0;
            return (
              <li key={e.id}>
                <Link
                  href="/exam-schedule"
                  className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      TYPE_DOT[e.type],
                    )}
                    aria-hidden
                  />
                  <span className="line-clamp-1 flex-1 text-xs text-gray-700 dark:text-gray-200">
                    {e.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums",
                      isDDay
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                    )}
                  >
                    {isDDay ? "D-DAY" : `D-${dStart}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-gray-100 px-4 py-2 dark:border-white/[0.05]">
        <Link
          href="/exam-schedule"
          className="block text-center text-[11px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          전체 일정 보기 →
        </Link>
      </div>
    </div>
  );
}
