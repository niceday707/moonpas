// 공지사항 데이터 레이어 — Supabase 연동 전 mock
// 연동 시 이 파일의 배열·함수를 Supabase 쿼리로 교체하세요.

export type NoticeAudience = "전체" | "학생만" | "학부모만";

export type AttachmentType = "pdf" | "hwp" | "xlsx" | "docx" | "img" | "zip";

export type NoticeAttachment = {
  name: string;
  size: string;
  url: string;
  type: AttachmentType;
};

export type Notice = {
  id: string;
  title: string;
  /** 마크다운 문자열 */
  content: string;
  author_name: string;
  author_dept: string;
  audience: NoticeAudience;
  pinned: boolean;
  /** 로컬 읽음 여부 (Supabase 연동 시 read_receipts 테이블로 관리) */
  read: boolean;
  attachments: NoticeAttachment[];
  created_at: string;
};

// ─── seed ──────────────────────────────────────────────────────────────────────

const NOW = Date.now();
const minsAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

export let NOTICES: Notice[] = [
  {
    id: "notice-001",
    title: "2026년 1학기 중간고사 시간표 및 유의사항 안내",
    content: `## 시험 일정\n\n- **1학년**: 5월 12일(화) ~ 5월 16일(토)\n- **2학년**: 5월 12일(화) ~ 5월 16일(토)\n- **3학년**: 5월 13일(수) ~ 5월 17일(일)\n\n## 응시 유의사항\n\n1. 시험 당일 **15분 전** 입실 완료 (지각 시 입실 불가)\n2. 응시 도구: **검정 볼펜** 필수 (샤프·연필 사용 불가)\n3. 전자기기 일체 반입 금지 (스마트워치 포함)\n4. 부정행위 적발 시 해당 과목 **0점** 처리 후 학교 규정에 따라 징계\n\n## 결시자 처리\n\n공결 사유 발생 시 **시험 당일 오전 7시 30분 이전**에 담임 선생님께 연락 바랍니다. 공결 처리 여부는 담당 교무부에서 개별 안내합니다.\n\n## 문의\n\n교무부 (내선 101)`,
    author_name: "김교무",
    author_dept: "교무부",
    audience: "전체",
    pinned: true,
    read: false,
    attachments: [
      { name: "2026_1학기_중간고사_시간표.pdf", size: "248 KB", url: "#", type: "pdf" },
      { name: "시험_유의사항_안내문.hwp", size: "32 KB", url: "#", type: "hwp" },
    ],
    created_at: minsAgo(25),
  },
  {
    id: "notice-002",
    title: "2028 대입 개편 학부모 설명회 개최 안내",
    content: `## 설명회 개요\n\n2028학년도 대입 제도 개편에 따른 **학부모 대상 입시 설명회**를 개최합니다.\n\n| 항목 | 내용 |\n|------|------|\n| 일시 | 2026년 5월 20일(수) 오후 7시 |\n| 장소 | 본관 대강당 (3층) |\n| 대상 | 재학생 학부모 전원 |\n\n## 주요 내용\n\n- 2028 수능 통합형 전환 핵심 변경사항\n- 내신 5등급제 적용 방식 및 학교 대응 계획\n- 고교학점제 연계 과목 선택 전략\n- 대학별 입시 변화 및 질의응답\n\n## 사전 신청\n\n원활한 좌석 배치를 위해 **5월 18일(월)까지** 담임 선생님을 통해 참석 여부를 알려주시기 바랍니다.\n\n자료는 설명회 당일 현장 배부 및 설명회 종료 후 학교 홈페이지에 게시할 예정입니다.`,
    author_name: "박진학",
    author_dept: "진로진학부",
    audience: "학부모만",
    pinned: true,
    read: false,
    attachments: [
      { name: "2028대입_학부모설명회_사전자료.pdf", size: "1.2 MB", url: "#", type: "pdf" },
    ],
    created_at: minsAgo(180),
  },
  {
    id: "notice-003",
    title: "학생 봉사활동 신청 안내 (5월~6월)",
    content: `## 봉사활동 신청 안내\n\n5~6월 중 진행되는 **학교 인증 봉사활동** 신청을 받습니다.\n\n## 기관 목록\n\n- **지역 아동센터 학습 지원** — 매주 토요일 오후 2~5시 / 잔여 5명\n- **노인복지관 말벗 봉사** — 매주 일요일 오전 10시~12시 / 잔여 8명\n- **환경부 하천 정화** — 5월 25일(일) 1회 / 잔여 20명\n- **도서관 사서 보조** — 평일 방과 후 4~6시 / 잔여 3명\n\n## 신청 방법\n\n1. 학교 홈페이지 → 학생활동 → 봉사활동 신청\n2. 신청 마감: **5월 10일(토) 자정**\n3. 선착순 마감되므로 서둘러 신청하세요.\n\n## 주의사항\n\n- 봉사활동 확인서는 기관에서 직접 발급합니다.\n- 무단 불참 시 해당 학기 봉사활동 신청 자격 제한될 수 있습니다.`,
    author_name: "이생활",
    author_dept: "학생생활부",
    audience: "학생만",
    pinned: false,
    read: false,
    attachments: [
      { name: "봉사활동_기관_안내서.pdf", size: "156 KB", url: "#", type: "pdf" },
      { name: "봉사활동_신청서_양식.docx", size: "28 KB", url: "#", type: "docx" },
    ],
    created_at: daysAgo(1),
  },
  {
    id: "notice-004",
    title: "학부모 총회 안건 및 일정 안내",
    content: `## 1분기 학부모 총회\n\n**일시**: 2026년 5월 8일(목) 오후 6시 30분\n**장소**: 각 학급 교실 (학급별 담임 선생님과 진행)\n\n## 주요 안건\n\n1. 2025~2026학년도 학교 교육계획 보고\n2. 학급 운영 방향 안내\n3. 학교폭력 예방 교육 현황\n4. 급식 품질 개선 방안 논의\n5. 학부모 건의사항 수렴\n\n## 참석 안내\n\n- 참석 여부를 **5월 6일(화)까지** 알림장 또는 학교 앱으로 제출해 주세요.\n- 주차 공간이 협소하므로 대중교통 이용을 권장합니다.\n- 불참 시 서면 의견서 제출 가능합니다 (담임 선생님께 요청).`,
    author_name: "최학부",
    author_dept: "학생부",
    audience: "학부모만",
    pinned: false,
    read: false,
    attachments: [
      { name: "학부모총회_안건문.pdf", size: "92 KB", url: "#", type: "pdf" },
    ],
    created_at: daysAgo(2),
  },
  {
    id: "notice-005",
    title: "1분기 학업 성취도 성적표 배부 안내",
    content: `## 성적표 배부 일정\n\n1분기 학업 성취도 평가 결과를 아래와 같이 배부합니다.\n\n- **배부일**: 2026년 5월 3일(토)\n- **배부 방법**: 담임 선생님 통해 개별 봉투 배부\n- **열람 기간**: 배부일로부터 **14일 이내**에 학교 홈페이지에서 성적 이의신청 가능\n\n## 성적 해석 안내\n\n이번 학기부터 **5등급 성취평가제**가 시범 적용됩니다.\n\n- **A등급**: 상위 10% 이내\n- **B등급**: 상위 10~34%\n- **C등급**: 상위 34~66%\n- **D등급**: 상위 66~90%\n- **E등급**: 하위 10%\n\n자세한 사항은 학교 교무부로 문의하세요.`,
    author_name: "김교무",
    author_dept: "교무부",
    audience: "전체",
    pinned: false,
    read: true,
    attachments: [],
    created_at: daysAgo(3),
  },
  {
    id: "notice-006",
    title: "방과후 수학 집중 보충 수업 신청 안내",
    content: `## 수학 집중 보충 수업\n\n중간고사 대비 **수학 집중 보충 수업**을 운영합니다.\n\n## 일정\n\n- 기간: **5월 7일(수) ~ 5월 9일(금)**\n- 시간: 방과 후 **16:30 ~ 18:30** (2시간)\n- 장소: 수학실 (본관 2층 204호)\n- 담당: 한지훈 선생님\n\n## 내용\n\n- 1일차: 수열의 극한 · 함수의 극한과 연속\n- 2일차: 미분법 · 여러 가지 함수의 미분\n- 3일차: 적분법 · 정적분의 활용\n\n## 신청 방법\n\n**5월 6일(화) 정오까지** 담임 선생님께 신청서 제출\n(정원 20명, 선착순 마감)\n\n> 교재는 학교에서 무료 제공합니다.`,
    author_name: "한지훈",
    author_dept: "수학과",
    audience: "학생만",
    pinned: false,
    read: true,
    attachments: [
      { name: "수학_보충수업_신청서.hwp", size: "18 KB", url: "#", type: "hwp" },
    ],
    created_at: daysAgo(4),
  },
  {
    id: "notice-007",
    title: "5월 급식 메뉴 및 알레르기 성분 안내",
    content: `## 5월 급식 운영 안내\n\n5월 급식 메뉴 및 알레르기 성분 정보를 안내드립니다.\n\n## 주요 변경 사항\n\n- 매주 **수요일**: 학생 선호 메뉴의 날 운영 (투표 결과 반영)\n- 매주 **금요일**: 비건 선택식 추가 운영\n\n## 알레르기 유발 식품 안내\n\n개인 알레르기가 있는 학생은 **영양사 선생님께 사전 신고**하면 대체 식단을 제공받을 수 있습니다.\n\n- 상시 운영: 우유 대체음료 (두유)\n- 신청 방법: 급식실 방문 또는 학교 홈페이지 신청\n\n## 5월 특별 메뉴\n\n- **5월 5일(어린이날)**: 휴일\n- **5월 15일(스승의날)**: 특식 (갈비탕)\n- **5월 29일**: 학생의 날 특식 (피자, 치킨)`,
    author_name: "정영양",
    author_dept: "급식실",
    audience: "전체",
    pinned: false,
    read: true,
    attachments: [
      { name: "5월_급식메뉴표.pdf", size: "380 KB", url: "#", type: "pdf" },
      { name: "알레르기성분표.xlsx", size: "64 KB", url: "#", type: "xlsx" },
    ],
    created_at: daysAgo(5),
  },
  {
    id: "notice-008",
    title: "등교 시간 및 조례 일정 변경 안내 (5월 한 달)",
    content: `## 변경 개요\n\n5월 한 달간 **전국연합학력평가** 및 교내 행사 일정으로 인해 등교 시간이 일부 변경됩니다.\n\n## 변경 일정\n\n| 날짜 | 변경 내용 |\n|------|-----------|\n| 5월 7일(수) | 8:30 등교 (교직원 연수) |\n| 5월 14일(수) | 정상 등교 |\n| 5월 21일(수) | 8:00 등교 (전국연합학력평가) |\n| 5월 28일(수) | 정상 등교 |\n\n## 5월 21일 전국연합학력평가 유의사항\n\n- **3학년** 전원 참여 (1·2학년 정상 수업)\n- 시험 당일 08:00까지 입실 완료\n- 수험표 별도 발급 없음 (학생증 지참)\n\n문의: 교무부 (내선 101)`,
    author_name: "김교무",
    author_dept: "교무부",
    audience: "전체",
    pinned: false,
    read: true,
    attachments: [],
    created_at: daysAgo(7),
  },
];

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────────

export function getNoticeById(id: string): Notice | undefined {
  return NOTICES.find((n) => n.id === id);
}

export function getPinnedNotices(): Notice[] {
  return NOTICES.filter((n) => n.pinned).sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );
}

export function getRegularNotices(): Notice[] {
  return NOTICES.filter((n) => !n.pinned).sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );
}

export function getUnreadCount(): number {
  return NOTICES.filter((n) => !n.read).length;
}

export function markAsRead(id: string): void {
  const n = NOTICES.find((n) => n.id === id);
  if (n) n.read = true;
}

export function addNotice(notice: Omit<Notice, "id" | "created_at">): Notice {
  const newNotice: Notice = {
    ...notice,
    id: `notice-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  NOTICES = [newNotice, ...NOTICES];
  return newNotice;
}

export const ATTACHMENT_ICON: Record<AttachmentType, string> = {
  pdf: "📄",
  hwp: "📝",
  xlsx: "📊",
  docx: "📃",
  img: "🖼️",
  zip: "🗜️",
};

export const AUDIENCE_META: Record<
  NoticeAudience,
  { label: string; color: string }
> = {
  전체: { label: "전체", color: "#7c3aed" },
  학생만: { label: "학생", color: "#3b82f6" },
  학부모만: { label: "학부모", color: "#10b981" },
};
