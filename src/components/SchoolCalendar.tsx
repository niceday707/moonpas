"use client";

// 대시보드 — 학사일정 미니 캘린더
//   · 7×6 미니 그리드 + 월 네비게이션
//   · 오늘: violet 원형 배경
//   · 일요일/공휴일 빨강, 토요일 파랑
//   · 일정 있는 날짜 아래에 미니 이모지(타입별)
//   · 날짜 클릭 → 캘린더 아래에 해당 날짜 일정 리스트
//   · 선택 없으면 다가오는 일정 5개 표시

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  SCHEDULE_TYPE_EMOJI,
  SCHEDULE_TYPE_LABEL,
  SCHEDULE_TYPE_ORDER,
  SCHOOL_SCHEDULE,
  type ScheduleEvent,
  type ScheduleType,
} from "@/data/schoolSchedule";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

// ── 날짜 유틸 ───────────────────────────────────────────────
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 주어진 연/월의 7×6 = 42칸을 채우는 Date 배열 생성.
 * 첫 주는 일요일부터 시작 — 1일 이전 칸은 전월 말일로 채운다.
 */
function buildMonthMatrix(year: number, month0: number): Date[] {
  const first = new Date(year, month0, 1);
  const startDay = first.getDay(); // 0=일
  const cells: Date[] = [];
  // 시작 일요일 위치까지 이전 달 채우기
  const startDate = new Date(year, month0, 1 - startDay);
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
  }
  return cells;
}

/** YYYY-MM 키 기준으로 한 달치 일정 인덱스를 만들어 둠 (한 달 캘린더 렌더용). */
function indexByYmd(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const map = new Map<string, ScheduleEvent[]>();
  for (const e of events) {
    const arr = map.get(e.date);
    if (arr) arr.push(e);
    else map.set(e.date, [e]);
  }
  // 동일 날짜 정렬
  for (const arr of map.values()) {
    arr.sort((a, b) => SCHEDULE_TYPE_ORDER[a.type] - SCHEDULE_TYPE_ORDER[b.type]);
  }
  return map;
}

// 모듈 로드 시 한 번만 인덱싱
const EVENT_INDEX = indexByYmd(SCHOOL_SCHEDULE);

/** 셀 한 칸에 표시할 대표 이모지(중복 타입 제거 + 정렬), 최대 3개. */
function getDayEmojis(ymd: string): { type: ScheduleType; emoji: string }[] {
  const arr = EVENT_INDEX.get(ymd);
  if (!arr) return [];
  const seen = new Set<ScheduleType>();
  const out: { type: ScheduleType; emoji: string }[] = [];
  for (const e of arr) {
    if (seen.has(e.type)) continue;
    seen.add(e.type);
    out.push({ type: e.type, emoji: SCHEDULE_TYPE_EMOJI[e.type] });
  }
  return out.slice(0, 3);
}

/** 해당 날짜에 holiday 일정이 하나라도 있으면 true. (날짜 색상 빨강 처리용) */
function hasHoliday(ymd: string): boolean {
  const arr = EVENT_INDEX.get(ymd);
  if (!arr) return false;
  return arr.some((e) => e.type === "holiday");
}

/** 다가오는 일정 5개 — fromYmd 이상 날짜만 (정렬은 인덱스 사용). */
function getUpcoming(fromYmd: string, count = 5): ScheduleEvent[] {
  return SCHOOL_SCHEDULE
    .filter((e) => e.date >= fromYmd)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return SCHEDULE_TYPE_ORDER[a.type] - SCHEDULE_TYPE_ORDER[b.type];
    })
    .slice(0, count);
}

function formatListDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  const date = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEKDAY[date.getDay()]})`;
}

// ── 컴포넌트 ───────────────────────────────────────────────
export function SchoolCalendar() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => ({
    y: today.getFullYear(),
    m: today.getMonth(),
  }));
  const [selected, setSelected] = useState<string | null>(null);

  const cells = useMemo(
    () => buildMonthMatrix(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  const goPrev = () => {
    setCursor((c) => {
      const m = c.m - 1;
      return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
    });
    setSelected(null);
  };
  const goNext = () => {
    setCursor((c) => {
      const m = c.m + 1;
      return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
    });
    setSelected(null);
  };

  // 리스트 영역 — 선택 있으면 그 날짜 이벤트, 없으면 오늘 기준 다가오는 5개
  const todayYmd = toYmd(today);
  const listEvents: ScheduleEvent[] = selected
    ? EVENT_INDEX.get(selected) ?? []
    : getUpcoming(todayYmd, 5);

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#16162a]">
      {/* 헤더 */}
      <div className="flex shrink-0 items-center justify-between bg-gradient-to-br from-violet-100 via-indigo-50 to-cyan-50 px-3 py-2 dark:from-violet-500/[0.12] dark:via-indigo-500/[0.08] dark:to-cyan-500/[0.05]">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
          <h3 className="text-xs font-bold text-gray-900 dark:text-white">학사일정</h3>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-full border border-violet-300/60 bg-white/70 px-2 py-0.5 text-[9px] font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-400/30 dark:bg-white/[0.06] dark:text-violet-300 dark:hover:bg-white/[0.1]"
          >
            전체
          </button>
        )}
      </div>

      {/* 월 네비게이션 */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-2 py-1 dark:border-white/[0.05]">
        <button
          onClick={goPrev}
          aria-label="이전 달"
          className="rounded-md p-1 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.05]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">
          {cursor.y}년 {cursor.m + 1}월
        </div>
        <button
          onClick={goNext}
          aria-label="다음 달"
          className="rounded-md p-1 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.05]"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-100 px-1.5 pt-1.5 text-center dark:border-white/[0.05]">
        {WEEKDAY.map((w, i) => (
          <div
            key={w}
            className={`pb-1 text-[10px] font-bold ${
              i === 0
                ? "text-red-500"
                : i === 6
                  ? "text-blue-500"
                  : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 7×6 그리드 — AnimatePresence 로 월 전환 시 부드럽게 */}
      <div className="relative px-1.5 py-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${cursor.y}-${cursor.m}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="grid grid-cols-7 gap-0.5"
          >
            {cells.map((d, idx) => {
              const ymd = toYmd(d);
              const inMonth = d.getMonth() === cursor.m;
              const dow = d.getDay();
              const holiday = hasHoliday(ymd);
              const isToday = isSameDay(d, today);
              const isSelected = selected === ymd;
              const emojis = getDayEmojis(ymd);

              // 글자 색 결정
              const baseColor = !inMonth
                ? "text-gray-300 dark:text-gray-600"
                : holiday || dow === 0
                  ? "text-red-500"
                  : dow === 6
                    ? "text-blue-500"
                    : "text-gray-800 dark:text-gray-100";

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : ymd)}
                  className={`group relative flex aspect-square flex-col items-center justify-start rounded-md px-0.5 pt-1 transition ${
                    isSelected
                      ? "bg-violet-100 dark:bg-violet-500/20"
                      : "hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`relative z-[1] flex h-5 w-5 items-center justify-center text-[11px] font-semibold tabular-nums ${baseColor} ${
                      isToday ? "rounded-full bg-violet-600 text-white" : ""
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {/* 일정 이모지 — 최대 3개 */}
                  {emojis.length > 0 && (
                    <span className="mt-0.5 flex items-center justify-center gap-px leading-none">
                      {emojis.map((e) => (
                        <span
                          key={e.type}
                          aria-label={SCHEDULE_TYPE_LABEL[e.type]}
                          className="text-[10px] leading-none"
                          style={{ fontSize: "10px" }}
                        >
                          {e.emoji}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 범례 */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-t border-gray-100 px-2 py-1 text-[9.5px] text-gray-500 dark:border-white/[0.05] dark:text-gray-400">
        {(Object.keys(SCHEDULE_TYPE_EMOJI) as ScheduleType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-0.5">
            <span style={{ fontSize: "10px" }}>{SCHEDULE_TYPE_EMOJI[t]}</span>
            {SCHEDULE_TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      {/* 일정 리스트 */}
      <div className="border-t border-gray-100 px-3 py-2 dark:border-white/[0.05]">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
            {selected ? formatListDate(selected) : "다가오는 일정"}
          </p>
          {!selected && (
            <span className="text-[9px] text-gray-400">
              {todayYmd.replace(/-/g, ".")}
            </span>
          )}
        </div>
        {listEvents.length === 0 ? (
          <p className="py-2 text-center text-[10.5px] text-gray-400">
            등록된 일정이 없어요
          </p>
        ) : (
          <ul className="space-y-1">
            {listEvents.map((e, i) => (
              <motion.li
                key={`${e.date}-${e.title}-${i}`}
                initial={{ opacity: 0, x: -3 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-start gap-1.5"
              >
                <span className="mt-px shrink-0" style={{ fontSize: "11px" }}>
                  {SCHEDULE_TYPE_EMOJI[e.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium leading-snug text-gray-800 dark:text-gray-100">
                    {e.title}
                  </p>
                  {!selected && (
                    <p className="text-[9px] tabular-nums text-gray-400">
                      {formatListDate(e.date)}
                    </p>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
