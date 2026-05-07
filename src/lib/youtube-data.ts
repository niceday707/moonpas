// ============================================================================
// 문튜브(MoonTube) — 큐레이션된 유튜브 영상 데이터
// ============================================================================
// 이 파일만 수정하면 대시보드/문튜브 페이지의 영상이 한꺼번에 갱신됩니다.
// 영상 ID 는 유튜브 URL 에서 v= 뒤의 11자리 문자열입니다.
//   예) https://www.youtube.com/watch?v=dQw4w9WgXcQ  →  "dQw4w9WgXcQ"
// 추후 Supabase 로 옮길 때 동일한 타입 그대로 테이블 컬럼으로 매핑하면 됩니다.

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
};

// ─── 대시보드 미리보기 영상 (3~4개) ─────────────────────────────────────────
// "오늘의 문파스" 화면 하단 문튜브 섹션에 노출됩니다.
// 영상 ID(dQw4w9WgXcQ) 는 더미 — 실제 영상으로 교체하세요.

export const DASHBOARD_YOUTUBE_VIDEOS: YoutubeVideo[] = [
  {
    id: "dQw4w9WgXcQ",
    title: "2028 대입 완벽 정리 - 달라지는 수능과 내신",
    category: "진로진학",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "서울대 합격생이 말하는 고등학교 공부법",
    category: "동기부여",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "2028 수능 통합형, 어떻게 준비할까?",
    category: "진로진학",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "내신 5등급제 완벽 분석",
    category: "진로진학",
  },
];

// ─── 문튜브 전체 페이지 영상 (8~10개) ───────────────────────────────────────
// /youtube 라우트에서 카테고리 탭과 함께 노출됩니다.

export const YOUTUBE_VIDEOS: YoutubeVideo[] = [
  {
    id: "dQw4w9WgXcQ",
    title: "2028 대입 완벽 정리 - 달라지는 수능과 내신",
    category: "진로진학",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "2028 수능 통합형, 어떻게 준비할까?",
    category: "진로진학",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "내신 5등급제 완벽 분석",
    category: "진로진학",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "서울대 합격생이 말하는 고등학교 공부법",
    category: "동기부여",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "포기하고 싶을 때 보는 영상 - 수험생 멘탈 관리",
    category: "동기부여",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "꿈을 향해 달려가는 너에게 - 졸업생 인터뷰",
    category: "동기부여",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "효율 200% 끌어올리는 노트 정리법",
    category: "학습법",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "수학 1등급의 오답노트 활용 비법",
    category: "학습법",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "영어 단어 빠르게 외우는 5가지 방법",
    category: "학습법",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "2026 문태고 체육대회 하이라이트",
    category: "학교소식",
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
