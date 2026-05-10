"use client";

// 시간표 조회 페이지
// ---------------------------------------------------------------
// 1) 학년 선택 (1·2·3) → 반 선택 (1~7) → 주간 시간표 표
// 2) timetable.subject 가 classroom_map.subject_keyword 로 시작하면
//    이동수업으로 간주 → 셀에 강의실 배지 표시 + bg-amber-50
// 3) 점심시간 구분선, 오늘 요일 하이라이트, 모바일 좌우 스크롤
// 4) 하단 아코디언: 해당 학년의 선택과목 이동 안내 (classroom_map 전체)

import { Fragment, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ── 타입 ─────────────────────────────────────────────────
type TimetableRow = {
  id: number;
  year: number;
  class: number;
  day: string; // "월" | "화" | "수" | "목" | "금"
  period: number;
  start_time: string | null;
  subject: string;
  teacher: string | null;
  semester: string;
};

type ClassroomMapRow = {
  id: number;
  subject_keyword: string;
  classroom: string;
  teacher: string | null;
  grade: number;
  semester: string;
};

// ── 상수 ─────────────────────────────────────────────────
const SEMESTER = "2026-1학기";
const DAYS = ["월", "화", "수", "목", "금"] as const;
type Day = (typeof DAYS)[number];

// 교시별 시작 시각 (DB에 NULL 인 경우 fallback)
const PERIOD_START_TIME: Record<number, string> = {
  1: "08:50",
  2: "09:50",
  3: "10:50",
  4: "11:50",
  5: "13:40",
  6: "14:40",
  7: "15:40",
};

const YEARS = [1, 2, 3] as const;
const CLASSES = [1, 2, 3, 4, 5, 6, 7] as const;

// 오늘 요일 → DAYS 인덱스 매핑 (토/일은 null)
function getTodayDay(): Day | null {
  const d = new Date().getDay(); // 0=일,1=월,...
  if (d >= 1 && d <= 5) return DAYS[d - 1];
  return null;
}

// ── 페이지 ───────────────────────────────────────────────
export default function TimetablePage() {
  const [year, setYear] = useState<number | null>(null);
  const [klass, setKlass] = useState<number | null>(null);

  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [maps, setMaps] = useState<ClassroomMapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accordionOpen, setAccordionOpen] = useState(false);

  // 오늘 요일 — SSR/CSR hydration mismatch 방지를 위해 마운트 후 세팅
  const [todayDay, setTodayDay] = useState<Day | null>(null);
  useEffect(() => {
    setTodayDay(getTodayDay());
  }, []);

  // 학년만 바뀌면 반 선택 초기화
  useEffect(() => {
    setKlass(null);
  }, [year]);

  // 학년 + 반 변경 시 시간표 + 강의실 맵 fetch
  useEffect(() => {
    if (year === null || klass === null) {
      setRows([]);
      setMaps([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [tt, cm] = await Promise.all([
          supabase
            .from("timetable")
            .select("*")
            .eq("year", year)
            .eq("class", klass)
            .eq("semester", SEMESTER)
            .order("period"),
          supabase
            .from("classroom_map")
            .select("*")
            .eq("grade", year)
            .eq("semester", SEMESTER),
        ]);

        if (cancelled) return;
        if (tt.error) throw tt.error;
        if (cm.error) throw cm.error;

        setRows((tt.data ?? []) as TimetableRow[]);
        setMaps((cm.data ?? []) as ClassroomMapRow[]);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error ? e.message : "시간표를 불러오지 못했습니다.";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, klass]);

  // (day, period) → row 빠른 조회용 맵
  const cellMap = useMemo(() => {
    const m = new Map<string, TimetableRow>();
    for (const r of rows) m.set(`${r.day}|${r.period}`, r);
    return m;
  }, [rows]);

  // 등장한 모든 교시 — 보통 1~7 이지만, DB에 다르게 들어와도 안전하게.
  const periods = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) set.add(r.period);
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [1, 2, 3, 4, 5, 6, 7];
  }, [rows]);

  // subject → classroom 매칭 (startsWith)
  function matchClassroom(subject: string): ClassroomMapRow | null {
    // 더 긴 키워드를 우선 매칭하도록 정렬
    const sorted = [...maps].sort(
      (a, b) => b.subject_keyword.length - a.subject_keyword.length,
    );
    for (const m of sorted) {
      if (subject.startsWith(m.subject_keyword)) return m;
    }
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-screen-md px-4 py-6 md:px-6"
    >
      {/* ── 헤더 ── */}
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
          🗓️ 시간표
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {SEMESTER} 학년·반별 주간 시간표
        </p>
      </div>

      {/* ── 학년 선택 ── */}
      <section className="mb-4">
        <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
          학년
        </p>
        <div className="flex flex-wrap gap-2">
          {YEARS.map((y) => {
            const active = year === y;
            return (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]",
                )}
              >
                {y}학년
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 반 선택 ── */}
      <AnimatePresence initial={false}>
        {year !== null && (
          <motion.section
            key="class-picker"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mb-4"
          >
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              반
            </p>
            <div className="flex flex-wrap gap-2">
              {CLASSES.map((c) => {
                const active = klass === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setKlass(c)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]",
                    )}
                  >
                    {c}반
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── 본문 ── */}
      {year === null ? (
        <EmptyHint text="학년을 먼저 선택해 주세요 👆" />
      ) : klass === null ? (
        <EmptyHint text="반을 선택하면 시간표가 표시돼요" />
      ) : loading ? (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-10 text-center text-sm text-gray-400 dark:border-white/[0.06] dark:bg-[#16162a]">
          시간표를 불러오는 중…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-10 text-center text-sm text-gray-400 dark:border-white/[0.06] dark:bg-[#16162a]">
          등록된 시간표가 없습니다.
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
            📅 {year}학년 {klass}반 시간표
          </h2>
          <TimetableGrid
            periods={periods}
            cellMap={cellMap}
            todayDay={todayDay}
            matchClassroom={matchClassroom}
          />

          {/* 선택과목 이동 안내 아코디언 */}
          <ClassroomAccordion
            year={year}
            maps={maps}
            open={accordionOpen}
            onToggle={() => setAccordionOpen((v) => !v)}
          />
        </>
      )}
    </motion.div>
  );
}

// ── 안내 박스 ────────────────────────────────────────────
function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400 dark:border-white/[0.08] dark:bg-[#16162a]">
      {text}
    </div>
  );
}

// ── 시간표 그리드 ────────────────────────────────────────
function TimetableGrid({
  periods,
  cellMap,
  todayDay,
  matchClassroom,
}: {
  periods: number[];
  cellMap: Map<string, TimetableRow>;
  todayDay: Day | null;
  matchClassroom: (subject: string) => ClassroomMapRow | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#16162a]">
      <table className="w-full min-w-[560px] border-collapse text-center text-xs sm:text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/[0.03]">
            <th className="w-14 border-b border-gray-100 px-1 py-2 text-[11px] font-semibold text-gray-500 dark:border-white/[0.06] dark:text-gray-400 sm:w-20">
              교시
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                className={cn(
                  "border-b border-gray-100 px-1 py-2 text-[11px] font-semibold text-gray-600 dark:border-white/[0.06] dark:text-gray-300 sm:text-xs",
                  todayDay === d &&
                    "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300",
                )}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => {
            const startTime =
              cellMap.get(`월|${p}`)?.start_time ?? PERIOD_START_TIME[p] ?? "";

            // 4교시 다음 (5교시 직전) 점심시간 구분선
            const showLunch = p === 5 && periods.includes(4);

            return (
              <Fragment key={p}>
                {showLunch && (
                  <tr>
                    <td
                      colSpan={DAYS.length + 1}
                      className="border-y border-amber-200 bg-amber-50 px-2 py-1.5 text-center text-[11px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      🍚 점심시간 (12:40~13:40)
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="border-t border-gray-100 px-1 py-2 align-middle text-[11px] font-semibold text-gray-700 dark:border-white/[0.06] dark:text-gray-200">
                    <div>{p}교시</div>
                    {startTime && (
                      <div className="mt-0.5 text-[10px] font-normal text-gray-400 dark:text-gray-500">
                        {startTime}
                      </div>
                    )}
                  </td>
                  {DAYS.map((d) => {
                    const row = cellMap.get(`${d}|${p}`);
                    const isToday = todayDay === d;
                    if (!row) {
                      return (
                        <td
                          key={d}
                          className={cn(
                            "border-t border-gray-100 px-1 py-2 align-middle text-gray-300 dark:border-white/[0.06] dark:text-gray-600",
                            isToday &&
                              "bg-purple-50/60 dark:bg-purple-500/[0.06]",
                          )}
                        >
                          —
                        </td>
                      );
                    }
                    const cm = matchClassroom(row.subject);
                    return (
                      <td
                        key={d}
                        className={cn(
                          "border-t border-gray-100 px-1 py-2 align-middle dark:border-white/[0.06]",
                          isToday &&
                            !cm &&
                            "bg-purple-50/60 dark:bg-purple-500/[0.06]",
                          cm && "bg-amber-50 dark:bg-amber-500/[0.08]",
                        )}
                      >
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {row.subject}
                        </div>
                        {row.teacher && (
                          <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 sm:text-[11px]">
                            {row.teacher}
                          </div>
                        )}
                        {cm && (
                          <div className="mt-1 inline-block rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                            📍 {cm.classroom}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 선택과목 이동 안내 아코디언 ─────────────────────────
function ClassroomAccordion({
  year,
  maps,
  open,
  onToggle,
}: {
  year: number;
  maps: ClassroomMapRow[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-white/[0.06] dark:bg-[#16162a]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <MapPin className="h-4 w-4 text-amber-500" />
          선택과목 이동 안내
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-t border-gray-100 dark:border-white/[0.06]"
          >
            <div className="px-4 py-3">
              {year === 1 || maps.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {year === 1
                    ? "1학년은 모든 수업이 각 반 교실에서 진행됩니다 😊"
                    : "등록된 이동수업 정보가 없습니다."}
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-white/[0.06]">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                      <tr>
                        <th className="w-24 px-3 py-2 text-left">과목</th>
                        <th className="px-3 py-2 text-left">강의실</th>
                        <th className="w-24 px-3 py-2 text-left">담당교사</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                      {maps
                        .slice()
                        .sort((a, b) =>
                          a.subject_keyword.localeCompare(
                            b.subject_keyword,
                            "ko",
                          ),
                        )
                        .map((m) => (
                          <tr key={m.id}>
                            <td className="px-3 py-2 align-top text-xs font-semibold text-gray-700 dark:text-gray-200">
                              {m.subject_keyword}
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-gray-600 dark:text-gray-300">
                              {m.classroom}
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-gray-500 dark:text-gray-400">
                              {m.teacher ?? "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
