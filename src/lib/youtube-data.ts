// ============================================================================
// 문튜브(MoonTube) — 큐레이션된 유튜브 영상 데이터
// ============================================================================
// 이 파일만 수정하면 대시보드/문튜브 페이지의 영상이 한꺼번에 갱신됩니다.
// 영상 ID 는 유튜브 URL 에서 v= 뒤의 11자리 문자열입니다.
//   예) https://www.youtube.com/watch?v=dQw4w9WgXcQ  →  "dQw4w9WgXcQ"
//
// ⚠️ 이 배열은 Supabase 가 비었을 때 쓰는 fallback 데이터다.
//    scripts/find-moontube-longform.mjs 가 수집한
//    scripts/output/moontube-longform.json 을 수동 검수 후 옮긴 결과.

/** 문튜브 카테고리 */
export type YoutubeCategory =
  | "진로진학"
  | "동기부여"
  | "학습법"
  | "학교소식";

export const YOUTUBE_CATEGORIES: YoutubeCategory[] = [
  "진로진학",
  "동기부여",
  "학습법",
  "학교소식",
];

/** 카테고리별 강조색 (글래스 카드 안에서 배지/하이라이트로 사용) */
export const CATEGORY_COLOR: Record<YoutubeCategory, string> = {
  진로진학: "#7c3aed", // 보라 (메인 액센트)
  동기부여: "#06b6d4", // 시안 (서브 액센트)
  학습법: "#10b981", // 민트 (성공)
  학교소식: "#f59e0b", // 앰버 (경고)
};

export type YoutubeVideo = {
  /** 11자리 유튜브 영상 ID */
  id: string;
  /** 카드/페이지에 표시되는 제목 */
  title: string;
  /** 카테고리 */
  category: YoutubeCategory;
  /** 원본 유튜브 채널 이름 (없으면 fallback 변환 시 "문튜브" 로 표기) */
  channelTitle?: string;
  /** 유튜브 실제 조회수 — 큐레이션 시점의 누적값. 없으면 표시 시 0 으로 폴백. */
  viewCount?: number;
  /** 유튜브 원본 업로드 시각(ISO8601) — "N개월 전" 등 상대 시간 표시에 사용. */
  publishedAt?: string;
};

// ─── 대시보드 미리보기 영상 (3~4개) ─────────────────────────────────────────
// "오늘의 문파스" 화면 하단 문튜브 섹션에 노출.
// /moontube 전체 페이지보다 상위 인기/우선순위 영상만 골라 보여준다.

export const DASHBOARD_YOUTUBE_VIDEOS: YoutubeVideo[] = [
  {
    id: "Z0URCXVC7CQ",
    title:
      "여정쌤이 말도 안 된다고 극찬한 비학군지 ‘수능 만점’ 받은 비결은? [합격생기부]",
    category: "진로진학",
    channelTitle: "유니브클래스",
    viewCount: 166469,
    publishedAt: "2026-01-02T09:15:04Z",
  },
  {
    id: "oed26o5D60E",
    title:
      "“천재의 두뇌 만들 수 있습니다” 3일만에 40배 뇌 업그레이드 하는 5가지 방법(뇌과학적 공부법)",
    category: "동기부여",
    channelTitle: "한눈에 심리학",
    viewCount: 834966,
    publishedAt: "2026-02-27T03:05:41Z",
  },
  {
    id: "vVxeymCv1vs",
    title:
      "평범하던 저도 이 공부법으로 의사가 됐습니다. 390만 명이 선택한 공부법, 7년만의 개정판",
    category: "학습법",
    channelTitle: "이상욱의 진료실 밖 처방전",
    viewCount: 303962,
    publishedAt: "2026-01-24T08:01:07Z",
  },
  {
    id: "-yjGHHt1Jm8",
    title: "미국 고등학교 첫 등교 (하자마자 썸남이랑 풋볼 보러 감)",
    category: "학교소식",
    channelTitle: "지사루",
    viewCount: 4315266,
    publishedAt: "2026-02-10T22:11:07Z",
  },
];

// ─── 문튜브 전체 페이지 영상 ────────────────────────────────────────────────
// /moontube 라우트의 롱폼 fallback. Supabase 가 비었을 때만 노출된다.
// 출처: scripts/output/moontube-longform.json (2026-05-16 수집).
// 모든 영상은 한국어 콘텐츠 · 학생 친화 기준으로 자동 수집된 뒤 선별됨.

export const YOUTUBE_VIDEOS: YoutubeVideo[] = [
  // 진로진학 — 합격/입시 가이드
  {
    id: "Z0URCXVC7CQ",
    title:
      "여정쌤이 말도 안 된다고 극찬한 비학군지 ‘수능 만점’ 받은 비결은? [합격생기부]",
    category: "진로진학",
    channelTitle: "유니브클래스",
    viewCount: 166469,
    publishedAt: "2026-01-02T09:15:04Z",
  },
  {
    id: "quQnAhmg8j0",
    title:
      "'3년 버립니다' 이런 고등학교 절대 보내지 마세요 내신 5등급제 유리한 고등학교 선택법 (이시용 대표 2부)",
    category: "진로진학",
    channelTitle: "데일리어썸 DAILY AWESOME",
    viewCount: 164848,
    publishedAt: "2026-01-13T09:01:20Z",
  },
  {
    id: "FIIh4avD9HA",
    title: "학교 9시간 낭비하면 끝입니다 | 현역 정시 가이드",
    category: "진로진학",
    channelTitle: "수능수석 아크미",
    viewCount: 157988,
    publishedAt: "2026-03-02T08:16:11Z",
  },
  // 동기부여 — 뇌과학/심리
  {
    id: "oed26o5D60E",
    title:
      "“천재의 두뇌 만들 수 있습니다” 3일만에 40배 뇌 업그레이드 하는 5가지 방법(뇌과학적 공부법)",
    category: "동기부여",
    channelTitle: "한눈에 심리학",
    viewCount: 834966,
    publishedAt: "2026-02-27T03:05:41Z",
  },
  // 학습법 — 과목별/원칙
  {
    id: "vVxeymCv1vs",
    title:
      "평범하던 저도 이 공부법으로 의사가 됐습니다. 390만 명이 선택한 공부법, 7년만의 개정판",
    category: "학습법",
    channelTitle: "이상욱의 진료실 밖 처방전",
    viewCount: 303962,
    publishedAt: "2026-01-24T08:01:07Z",
  },
  {
    id: "3Hw5ci-0isk",
    title: "제73화 고등 수학, 왜 1학년 때 다 포기할까? 연산과 기초의 중요성",
    category: "학습법",
    channelTitle: "수학통역사_조안호",
    viewCount: 141953,
    publishedAt: "2026-01-05T00:45:00Z",
  },
  {
    id: "BVmjU9e1UXU",
    title:
      "🚨야, 너도 전교 1등 할 수 있어 | 과목별 공부법 | 문제집 추천 | 10 09 08 | 예비고1 | 고등학교 꿀팁 | 전교 1등",
    category: "학습법",
    channelTitle: "윤둥이",
    viewCount: 132302,
    publishedAt: "2026-01-30T19:26:16Z",
  },
  // 학교소식 — 학교 일상/브이로그
  {
    id: "-yjGHHt1Jm8",
    title: "미국 고등학교 첫 등교 (하자마자 썸남이랑 풋볼 보러 감)",
    category: "학교소식",
    channelTitle: "지사루",
    viewCount: 4315266,
    publishedAt: "2026-02-10T22:11:07Z",
  },
  {
    id: "szjXsuUugcY",
    title: "고2 남녀공학 체육대회 브이로그 | grwm ",
    category: "학교소식",
    channelTitle: "연우",
    viewCount: 514011,
    publishedAt: "2026-01-10T09:50:46Z",
  },
];

// ─── 유틸 ───────────────────────────────────────────────────────────────────

/** 임베드 URL 생성 — 모달성 트래킹/관련영상 최소화 옵션 포함 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

/** 유튜브 URL 또는 ID 문자열에서 11자리 영상 ID 추출 (실패 시 null) */
export function parseYoutubeId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  // 이미 11자리 ID 만 입력된 경우
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
  // youtu.be / watch?v= / shorts / embed 등 다양한 형태에서 추출
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = v.match(re);
    if (m) return m[1];
  }
  return null;
}
