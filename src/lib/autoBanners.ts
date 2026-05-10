// src/lib/autoBanners.ts
// 학사일정 기반 자동 배너 생성 — DB 불필요, 코드에서 동적 생성

import { SCHOOL_SCHEDULE, type ScheduleEvent } from '@/data/schoolSchedule';

export interface AutoBanner {
  id: string;
  title: string;
  description: string;
  link: string | null;
  image_url: null;
  banner_type: 'auto_exam' | 'auto_event';
  gradient: string;
  emoji: string;
  dday: number;
}

// ─── D-day 계산 (KST 기준) ───
function getDday(today: Date, targetDateStr: string): number {
  const target = new Date(targetDateStr + 'T00:00:00+09:00');
  const todayKST = new Date(
    today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  );
  todayKST.setHours(0, 0, 0, 0);
  return Math.ceil(
    (target.getTime() - todayKST.getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ─── 오늘 날짜 문자열 (KST) ───
function getTodayStr(today: Date): string {
  const kst = new Date(
    today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  );
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── 시험 D-day 배너 ───
function getExamBanner(today: Date): AutoBanner | null {
  const todayStr = getTodayStr(today);

  // 오늘 이후 시험 중 가장 가까운 것
  const upcoming = SCHOOL_SCHEDULE
    .filter((e) => e.type === 'exam' && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) return null;

  const nearest = upcoming[0];
  const dday = getDday(today, nearest.date);

  // 30일 이내만 배너로 표시
  if (dday > 30) return null;

  // D-day 긴급도에 따라 비주얼 변경
  let gradient: string;
  let emoji: string;

  if (dday === 0) {
    gradient = 'from-red-600 via-orange-500 to-yellow-500';
    emoji = '🔥';
  } else if (dday <= 3) {
    gradient = 'from-red-600 via-rose-600 to-orange-500';
    emoji = '🔥';
  } else if (dday <= 7) {
    gradient = 'from-purple-700 via-violet-600 to-fuchsia-500';
    emoji = '⚡';
  } else if (dday <= 14) {
    gradient = 'from-indigo-700 via-purple-700 to-violet-600';
    emoji = '💀';
  } else {
    gradient = 'from-slate-800 via-indigo-900 to-purple-900';
    emoji = '✏️';
  }

  return {
    id: `auto_exam_${nearest.date}`,
    title: dday === 0 ? '시험 당일!' : `D-${dday}`,
    description: nearest.title,
    link: '/exam-schedule',
    image_url: null,
    banner_type: 'auto_exam',
    gradient,
    emoji,
    dday,
  };
}

// ─── 학교 행사 배너 ───
function getEventBanner(today: Date): AutoBanner | null {
  const todayStr = getTodayStr(today);

  // 오늘 이후 행사 중 가장 가까운 것 (event + competition)
  const upcoming = SCHOOL_SCHEDULE
    .filter(
      (e) =>
        (e.type === 'event' || e.type === 'competition') &&
        e.date >= todayStr
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) return null;

  const nearest = upcoming[0];
  const dday = getDday(today, nearest.date);

  // 7일 이내만 배너로 표시
  if (dday > 7) return null;

  const gradient =
    nearest.type === 'competition'
      ? 'from-amber-500 via-orange-500 to-red-500'
      : 'from-emerald-500 via-teal-500 to-cyan-500';

  const emoji = nearest.type === 'competition' ? '⚡' : '🎉';

  return {
    id: `auto_event_${nearest.date}`,
    title: dday === 0 ? '오늘!' : `D-${dday}`,
    description: nearest.title,
    link: '/schedule',
    image_url: null,
    banner_type: 'auto_event',
    gradient,
    emoji,
    dday,
  };
}

// ─── 메인 함수: 모든 자동 배너 수집 ───
export function getAutoBanners(): AutoBanner[] {
  const today = new Date();
  const banners: AutoBanner[] = [];

  const examBanner = getExamBanner(today);
  if (examBanner) banners.push(examBanner);

  const eventBanner = getEventBanner(today);
  if (eventBanner) banners.push(eventBanner);

  return banners;
}
