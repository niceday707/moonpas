// 문태고등학교 2026~2027 학사일정 데이터
//
// 각 항목은 { date, title, type } 형태이며, 날짜는 'YYYY-MM-DD'.
// type 분류:
//   · holiday    — 공휴일·재량휴업·대체휴일 (달력에서 빨간색 처리, 🏖️)
//   · exam       — 학력평가·중간/기말고사·수능 (💀)
//   · event      — 학교 행사·캠프·체험학습 (🔥)
//   · school     — 방과후·개학/방학·등교일·점검·훈련 (📌)
//   · competition— 교내 경시·대회 (⚡)

export type ScheduleType =
  | "holiday"
  | "exam"
  | "event"
  | "school"
  | "competition";

export interface ScheduleEvent {
  date: string; // YYYY-MM-DD
  title: string;
  type: ScheduleType;
}

export const SCHEDULE_TYPE_EMOJI: Record<ScheduleType, string> = {
  holiday: "🏖️",
  exam: "💀",
  event: "🔥",
  school: "📌",
  competition: "⚡",
};

export const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  holiday: "휴일",
  exam: "시험",
  event: "행사",
  school: "학교",
  competition: "대회",
};

// 정렬 우선순위 — 같은 날짜에 여러 일정이 있을 때 리스트에 노출되는 순서.
// (휴일 > 시험 > 대회 > 행사 > 학교 일반 일정)
export const SCHEDULE_TYPE_ORDER: Record<ScheduleType, number> = {
  holiday: 0,
  exam: 1,
  competition: 2,
  event: 3,
  school: 4,
};

export const SCHOOL_SCHEDULE: ScheduleEvent[] = [
  // ── 2026년 3월 ─────────────────────────────────────────
  { date: "2026-03-01", title: "삼일절 3.1절행사1학년", type: "holiday" },
  { date: "2026-03-02", title: "대체휴일", type: "holiday" },
  { date: "2026-03-03", title: "개학 입학식", type: "school" },
  { date: "2026-03-09", title: "학생자치회 구성", type: "school" },
  { date: "2026-03-16", title: "방과후학교 시작 1차", type: "school" },
  { date: "2026-03-16", title: "학생자치회 임명장 수여", type: "event" },
  { date: "2026-03-18", title: "민방위 기관 공습대비훈련", type: "school" },
  { date: "2026-03-19", title: "1학기 학교설명회", type: "event" },
  { date: "2026-03-21", title: "학생자치회 리더십 캠프", type: "event" },
  { date: "2026-03-24", title: "전국연합학력평가 1,2,3학년", type: "exam" },
  { date: "2026-03-26", title: "세종반 운영 설명회", type: "event" },

  // ── 2026년 4월 ─────────────────────────────────────────
  { date: "2026-04-07", title: "영어듣기능력평가 1학년", type: "exam" },
  { date: "2026-04-08", title: "영어듣기능력평가 2학년", type: "exam" },
  { date: "2026-04-09", title: "영어듣기능력평가 3학년", type: "exam" },
  { date: "2026-04-16", title: "세월호 추모", type: "event" },
  { date: "2026-04-17", title: "방과후학교 종료 1차", type: "school" },
  { date: "2026-04-28", title: "중간고사", type: "exam" },
  { date: "2026-04-29", title: "중간고사", type: "exam" },
  { date: "2026-04-30", title: "중간고사", type: "exam" },

  // ── 2026년 5월 ─────────────────────────────────────────
  { date: "2026-05-01", title: "근로자의 날", type: "holiday" },
  { date: "2026-05-04", title: "방과후학교 시작 2차", type: "school" },
  { date: "2026-05-05", title: "어린이날", type: "holiday" },
  { date: "2026-05-07", title: "전국연합학력평가 3학년", type: "exam" },
  { date: "2026-05-08", title: "체험학습 3학년", type: "event" },
  { date: "2026-05-11", title: "재량휴업일", type: "holiday" },
  { date: "2026-05-12", title: "개교기념일 문태체육한마당", type: "event" },
  { date: "2026-05-13", title: "문태체육한마당", type: "event" },
  { date: "2026-05-21", title: "학부모 수업나눔의 날", type: "event" },
  { date: "2026-05-24", title: "석가탄신일", type: "holiday" },
  { date: "2026-05-25", title: "대체휴일", type: "holiday" },
  { date: "2026-05-27", title: "영어표현력 경시대회 2학년", type: "competition" },
  { date: "2026-05-29", title: "통합사회 융합탐구캠프", type: "event" },
  { date: "2026-05-30", title: "통합사회 융합탐구캠프", type: "event" },

  // ── 2026년 6월 ─────────────────────────────────────────
  { date: "2026-06-03", title: "지방선거", type: "holiday" },
  { date: "2026-06-04", title: "전국연합학력평가 1,2학년 수능모의평가 3학년", type: "exam" },
  { date: "2026-06-06", title: "현충일", type: "holiday" },
  { date: "2026-06-08", title: "세종반 학업설계", type: "school" },
  { date: "2026-06-09", title: "세종반 학업설계", type: "school" },
  { date: "2026-06-10", title: "영어표현력 경시대회 1학년", type: "competition" },
  { date: "2026-06-11", title: "문예창작 대회", type: "competition" },
  { date: "2026-06-17", title: "알고리즘 코딩 대회", type: "competition" },
  { date: "2026-06-19", title: "방과후학교 종료 2차", type: "school" },
  { date: "2026-06-30", title: "기말고사", type: "exam" },

  // ── 2026년 7월 ─────────────────────────────────────────
  { date: "2026-07-01", title: "기말고사", type: "exam" },
  { date: "2026-07-02", title: "기말고사", type: "exam" },
  { date: "2026-07-03", title: "기말고사", type: "exam" },
  { date: "2026-07-08", title: "전국연합학력평가 3학년", type: "exam" },
  { date: "2026-07-10", title: "과학정보 융합탐구캠프 3학년", type: "event" },
  { date: "2026-07-11", title: "과학정보 융합탐구캠프 3학년", type: "event" },
  { date: "2026-07-13", title: "학생회장 선거", type: "event" },
  { date: "2026-07-13", title: "학교자율교육과정", type: "school" },
  { date: "2026-07-14", title: "학교자율교육과정", type: "school" },
  { date: "2026-07-15", title: "문태GoDream 캠프", type: "event" },
  { date: "2026-07-17", title: "제헌절", type: "holiday" },
  { date: "2026-07-20", title: "하계방학식", type: "school" },
  { date: "2026-07-21", title: "방과후학교 시작 (하계방학)", type: "school" },
  { date: "2026-07-24", title: "학교생활기록부 마감 1학기", type: "school" },
  { date: "2026-07-31", title: "방과후학교 종료 (하계방학)", type: "school" },

  // ── 2026년 8월 ─────────────────────────────────────────
  { date: "2026-08-15", title: "광복절", type: "holiday" },
  { date: "2026-08-17", title: "대체휴일", type: "holiday" },
  { date: "2026-08-18", title: "개학 2학기 시작", type: "school" },
  { date: "2026-08-20", title: "민방위 전국 공습대비훈련", type: "school" },
  { date: "2026-08-24", title: "학생자치회 구성", type: "school" },
  { date: "2026-08-27", title: "방과후학교 시작 1차", type: "school" },
  { date: "2026-08-31", title: "학생부 나이스 마감 1학기", type: "school" },

  // ── 2026년 9월 ─────────────────────────────────────────
  { date: "2026-09-02", title: "전국연합학력평가 1,2학년 수능모의평가 3학년", type: "exam" },
  { date: "2026-09-05", title: "학생자치회 리더십 캠프", type: "event" },
  { date: "2026-09-08", title: "영어듣기능력평가 1학년", type: "exam" },
  { date: "2026-09-09", title: "영어듣기능력평가 2학년", type: "exam" },
  { date: "2026-09-10", title: "영어듣기능력평가 3학년", type: "exam" },
  { date: "2026-09-25", title: "추석", type: "holiday" },
  { date: "2026-09-29", title: "방과후학교 종료 1차", type: "school" },

  // ── 2026년 10월 ────────────────────────────────────────
  { date: "2026-10-02", title: "한글날 계기교육", type: "school" },
  { date: "2026-10-03", title: "개천절", type: "holiday" },
  { date: "2026-10-05", title: "대체휴일", type: "holiday" },
  { date: "2026-10-06", title: "중간고사", type: "exam" },
  { date: "2026-10-07", title: "중간고사", type: "exam" },
  { date: "2026-10-08", title: "중간고사", type: "exam" },
  { date: "2026-10-09", title: "한글날", type: "holiday" },
  { date: "2026-10-12", title: "방과후학교 시작 2차", type: "school" },
  { date: "2026-10-14", title: "수련회 1학년 / 수학여행 2학년", type: "event" },
  { date: "2026-10-15", title: "수련회 1학년 / 수학여행 2학년", type: "event" },
  { date: "2026-10-16", title: "수련회 1학년 / 수학여행 2학년", type: "event" },
  { date: "2026-10-20", title: "전국연합학력평가 1,2,3학년", type: "exam" },
  { date: "2026-10-23", title: "과학정보 융합탐구캠프 2학년", type: "event" },
  { date: "2026-10-24", title: "과학정보 융합탐구캠프 2학년", type: "event" },

  // ── 2026년 11월 ────────────────────────────────────────
  { date: "2026-11-04", title: "문태 비경쟁 독서토론 한마당", type: "event" },
  { date: "2026-11-05", title: "J-FINAL 모의고사", type: "exam" },
  { date: "2026-11-18", title: "사이버보안 진단의 날", type: "school" },
  { date: "2026-11-19", title: "대학수학능력시험", type: "exam" },
  { date: "2026-11-25", title: "민방위 기관 화재대비훈련", type: "school" },
  { date: "2026-11-30", title: "방과후학교 종료 2차", type: "school" },

  // ── 2026년 12월 ────────────────────────────────────────
  { date: "2026-12-04", title: "안전점검의 날", type: "school" },
  { date: "2026-12-08", title: "기말고사 1,2학년", type: "exam" },
  { date: "2026-12-09", title: "기말고사 1,2학년", type: "exam" },
  { date: "2026-12-10", title: "기말고사 1,2학년", type: "exam" },
  { date: "2026-12-11", title: "기말고사 1,2학년", type: "exam" },
  { date: "2026-12-18", title: "AI·SW 아이디어톤 1학년", type: "event" },
  { date: "2026-12-19", title: "AI·SW 아이디어톤 1학년", type: "event" },
  { date: "2026-12-22", title: "수학체험전 동아리활동발표회", type: "event" },
  { date: "2026-12-23", title: "학교자율교육과정", type: "school" },
  { date: "2026-12-24", title: "학교자율교육과정", type: "school" },
  { date: "2026-12-25", title: "성탄절", type: "holiday" },

  // ── 2027년 1월 ─────────────────────────────────────────
  { date: "2027-01-01", title: "신정", type: "holiday" },
  { date: "2027-01-05", title: "날개축제 동계방학식", type: "event" },
  { date: "2027-01-06", title: "3학년 등교일", type: "school" },
  { date: "2027-01-07", title: "제76회 졸업식", type: "event" },

  // ── 2027년 2월 ─────────────────────────────────────────
  { date: "2027-02-01", title: "1,2학년 등교일", type: "school" },
  { date: "2027-02-02", title: "1,2학년 등교일", type: "school" },
  { date: "2027-02-07", title: "설날", type: "holiday" },
  { date: "2027-02-09", title: "대체휴일", type: "holiday" },
  { date: "2027-02-17", title: "학교생활기록부 마감 2학기", type: "school" },
  { date: "2027-02-26", title: "신입생 오리엔테이션", type: "event" },
];

// ── 조회 헬퍼 ────────────────────────────────────────────

/** 'YYYY-MM-DD' 키 기준으로 해당 날짜의 일정 배열을 반환 (정렬 적용). */
export function getEventsByDate(date: string): ScheduleEvent[] {
  return SCHOOL_SCHEDULE
    .filter((e) => e.date === date)
    .sort(
      (a, b) => SCHEDULE_TYPE_ORDER[a.type] - SCHEDULE_TYPE_ORDER[b.type],
    );
}

/** 기준 날짜(YYYY-MM-DD) 이후로 다가오는 일정 N개를 반환. */
export function getUpcomingEvents(
  fromYmd: string,
  count: number,
): ScheduleEvent[] {
  return SCHOOL_SCHEDULE
    .filter((e) => e.date >= fromYmd)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return SCHEDULE_TYPE_ORDER[a.type] - SCHEDULE_TYPE_ORDER[b.type];
    })
    .slice(0, count);
}
