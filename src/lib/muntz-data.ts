// ============================================================================
// 문츠(Muntz) — 1분 세로형 쇼츠 큐레이션 데이터
// ----------------------------------------------------------------------------
// 문튜브(MoonTube)와 별개 기능. 문튜브는 16:9 큐레이션 영상,
// 문츠는 9:16 세로 쇼츠. 추후 Supabase 로 옮길 때 동일한 타입을
// 그대로 테이블 컬럼으로 매핑하면 됨.
//
// 정책:
//  - 영상은 서버에 저장하지 않는다. 공식 iframe embed 만 사용.
//  - youtubeId 는 11자리 영상 ID. shorts URL/일반 URL 모두 embed 경로에서 동작.
//  - authorNickname 은 영상 제작자가 아니라 "문파스에 이 링크를 올린 사람" 의 닉네임.
//
// ⚠️ TODO(검수): 아래 MUNTZ_ITEMS 는 scripts/find-muntz-candidates.mjs (v2) 가
//    수집한 후보 중 자동 필터링(reviewPriority!=high · 음악/댄스 제외 ·
//    채널 중복 제거 · 우선 카테고리 한정)을 통과한 영상이다.
//    하지만 영상 내용은 사람이 최종 검수하는 것이 원칙. 학생 노출 전에
//    각 영상을 직접 재생해 보고 부적절한 부분이 없는지 확인할 것.
//    문제 영상은 youtubeUrl/channelTitle/safetyNote 를 단서로 즉시 제거 가능.
// ============================================================================

/** 문츠 카테고리 — 카드 우상단/필터 칩에서 사용 */
export type MuntzCategory =
  | "스포츠"
  | "과학·신기"
  | "마술·착시"
  | "동물"
  | "예술·제작"
  | "음식·디저트";

export const MUNTZ_CATEGORIES: MuntzCategory[] = [
  "스포츠",
  "과학·신기",
  "마술·착시",
  "동물",
  "예술·제작",
  "음식·디저트",
];

/** 카테고리별 강조색 — 문튜브 팔레트와 동일 톤. */
export const CATEGORY_COLOR: Record<MuntzCategory, string> = {
  스포츠: "#06b6d4", // 시안
  "과학·신기": "#7c3aed", // 보라
  "마술·착시": "#ec4899", // 핑크
  동물: "#f59e0b", // 앰버
  "예술·제작": "#10b981", // 민트
  "음식·디저트": "#ef4444", // 레드
};

/** 대상 학년 — 'all' 은 학년 무관 */
export type TargetGrade = "all" | "1" | "2" | "3";

export const TARGET_GRADE_LABEL: Record<TargetGrade, string> = {
  all: "전 학년",
  "1": "1학년",
  "2": "2학년",
  "3": "3학년",
};

/** 자동 수집 후보의 검수 단계 — pending: 사람 검수 전, approved: 노출 OK */
export type MuntzReviewStatus = "pending" | "approved" | "rejected";

export type MuntzItem = {
  /** 안정적인 고유 키 — 같은 youtubeId 를 여러 게시물이 공유할 수 있음 */
  id: string;
  /** 11자리 유튜브 영상 ID (Shorts URL 또는 일반 영상 모두 가능) */
  youtubeId: string;
  /** 카드/페이지 표시 제목 */
  title: string;
  /** 문파스 커뮤니티에서 이 쇼츠를 올린 작성자 닉네임 (@ 제외) */
  authorNickname: string;
  /** 카테고리 */
  category: MuntzCategory;
  /** 대상 학년 */
  targetGrade: TargetGrade;
  /** 한 줄 설명 */
  description: string;
  // ─── 자동 수집 메타데이터 (문제 발생 시 즉시 제거하기 위한 단서) ──────────
  /** 원본 유튜브 URL — 사람 검수/문제 영상 빠른 식별용 */
  youtubeUrl?: string;
  /** 영상 업로드 채널 이름 — 채널 통째로 차단할 때 사용 */
  channelTitle?: string;
  /** 자동 수집기가 남긴 안전성 메모 (학생 노출 전 확인) */
  safetyNote?: string;
  /** 검수 상태 — 기본 pending. UI 노출은 모두 한 번 사람 검수 후 approved 권장 */
  reviewStatus?: MuntzReviewStatus;
  /** 유튜브 실제 조회수 — 없으면 카드/풀스크린에서 조회수 표기를 숨긴다. */
  viewCount?: number;
  /** 유튜브 원본 업로드 시각(ISO8601) — 없으면 "N개월 전" 등 상대 시간 표기를 숨긴다. */
  publishedAt?: string;
};

// ─── 자동 수집 후보 → 화이트리스트 (Supabase fallback) ────────────────────
// 출처: scripts/output/muntz-candidates.json (2026-05-16 수집)
// 필터: reviewPriority != high · 음악/댄스 제외 · 같은 채널 최대 1개 ·
//      우선 카테고리(스포츠/과학·신기/마술·착시/동물/예술·제작/음식·디저트)만.
// ⚠️ 모두 reviewStatus: "pending" — 학생 노출 전 사람이 실제로 재생해 봐야 함.
//    부적절한 영상은 해당 객체만 통째로 삭제하면 즉시 피드에서 사라진다.
//
// 사용처: Supabase 조회 실패 시 빈 화면 대신 보여줄 fallback.
//        실데이터 운영이 시작되면 이 배열은 비울 수 있다.
export const MUNTZ_ITEMS_FALLBACK: MuntzItem[] = [
  {
    id: "muntz-Ri7g1IY8Upw",
    youtubeId: "Ri7g1IY8Upw",
    youtubeUrl: "https://www.youtube.com/shorts/Ri7g1IY8Upw",
    title: "Ping Pong Trick Shots!🎉",
    channelTitle: "TAIKISLIFE / タイキライフ",
    authorNickname: "문태미디어",
    category: "스포츠",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "외국 채널이지만 시각 위주 — 텍스트 의존 낮음",
    reviewStatus: "pending",
  },
  {
    id: "muntz-1D_uYCgkcIk",
    youtubeId: "1D_uYCgkcIk",
    youtubeUrl: "https://www.youtube.com/shorts/1D_uYCgkcIk",
    title: "Kids to Old, head drawing #howtodraw #art #drawing #artist #shorts",
    channelTitle: "Palette Portfolio",
    authorNickname: "문태미디어",
    category: "예술·제작",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "외국 채널이지만 시각 위주 — 텍스트 의존 낮음",
    reviewStatus: "pending",
  },
  {
    id: "muntz-jb_kemuM0iM",
    youtubeId: "jb_kemuM0iM",
    youtubeUrl: "https://www.youtube.com/shorts/jb_kemuM0iM",
    title: "bro did it AGAIN 😂",
    channelTitle: "Dude Perfect",
    authorNickname: "문태미디어",
    category: "스포츠",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "외국 채널이지만 시각 위주 — 텍스트 의존 낮음",
    reviewStatus: "pending",
  },
  {
    id: "muntz-cBMc4eL_byc",
    youtubeId: "cBMc4eL_byc",
    youtubeUrl: "https://www.youtube.com/shorts/cBMc4eL_byc",
    title: "These Magnets are 100x Stronger Than You Think 🧲😱",
    channelTitle: "Learn Through Tunes",
    authorNickname: "문태미디어",
    category: "과학·신기",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "외국 채널이지만 시각 위주 — 텍스트 의존 낮음",
    reviewStatus: "pending",
  },
  {
    id: "muntz-yVSlL9gUU3A",
    youtubeId: "yVSlL9gUU3A",
    youtubeUrl: "https://www.youtube.com/shorts/yVSlL9gUU3A",
    title: "Tractor Turns Like This?! 🤯 Physics Explained 🚜 #shorts",
    channelTitle: "VYAS EDIFICATION",
    authorNickname: "문태미디어",
    category: "과학·신기",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "외국 채널이지만 시각 위주 — 텍스트 의존 낮음",
    reviewStatus: "pending",
  },
  {
    id: "muntz-GoGxrFx4fg4",
    youtubeId: "GoGxrFx4fg4",
    youtubeUrl: "https://www.youtube.com/shorts/GoGxrFx4fg4",
    title: "experiment",
    channelTitle: "Sarthak Sachdeva Too",
    authorNickname: "문태미디어",
    category: "과학·신기",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "외국 채널이지만 시각 위주 — 텍스트 의존 낮음",
    reviewStatus: "pending",
  },
  {
    id: "muntz-szw0Mw-trYI",
    youtubeId: "szw0Mw-trYI",
    youtubeUrl: "https://www.youtube.com/shorts/szw0Mw-trYI",
    title: "물에 젖은 동물 TOP5 | 햄스터 토끼 닭 웃긴 반응 모음",
    channelTitle: "또세상",
    authorNickname: "문태미디어",
    category: "동물",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "한국어 콘텐츠 — 학생 친화",
    reviewStatus: "pending",
  },
  {
    id: "muntz-sS950B7txKA",
    youtubeId: "sS950B7txKA",
    youtubeUrl: "https://www.youtube.com/shorts/sS950B7txKA",
    title: "모찌 푸딩 연어 레이스 #강아지레이스 #간식대결 #동물쇼츠",
    channelTitle: "animood_daily",
    authorNickname: "문태미디어",
    category: "동물",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "한국어 콘텐츠 — 학생 친화",
    reviewStatus: "pending",
  },
  {
    id: "muntz-C5Jd0t1DJus",
    youtubeId: "C5Jd0t1DJus",
    youtubeUrl: "https://www.youtube.com/shorts/C5Jd0t1DJus",
    title: "2000번 때리는 디저트 만들기에 성공할 수 있을까?",
    channelTitle: "문금이연구소",
    authorNickname: "문태미디어",
    category: "음식·디저트",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "한국어 콘텐츠 — 학생 친화",
    reviewStatus: "pending",
  },
  {
    id: "muntz-PLdtdamcOgY",
    youtubeId: "PLdtdamcOgY",
    youtubeUrl: "https://www.youtube.com/shorts/PLdtdamcOgY",
    title: "99%가 속는 착시   #shorts",
    channelTitle: "Worker's Feed",
    authorNickname: "문태미디어",
    category: "마술·착시",
    targetGrade: "all",
    description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
    safetyNote: "한국어 콘텐츠 — 학생 친화",
    reviewStatus: "pending",
  },
];

// ─── 유틸 ───────────────────────────────────────────────────────────────────

/**
 * 문츠 임베드 URL — 쇼츠도 일반 embed 경로 사용 가능.
 * youtube-nocookie 도메인 + 트래킹/관련영상 최소화 옵션.
 */
export function muntzEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

/**
 * 유튜브 링크/ID 에서 11자리 영상 ID 를 추출.
 * 지원 형식:
 *   - https://www.youtube.com/shorts/{id}
 *   - https://www.youtube.com/watch?v={id} (& 추가 파라미터 포함)
 *   - https://youtu.be/{id}
 *   - https://www.youtube.com/embed/{id}
 *   - 11자리 ID 직접 입력
 * 실패 시 null.
 */
export function extractYoutubeId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
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

/** UI 라벨("전 학년" / "1학년" ...) → TargetGrade 키. 매치 안 되면 "all". */
export function gradeLabelToKey(label: string | null | undefined): TargetGrade {
  if (!label) return "all";
  const trimmed = label.trim();
  // "전학년" / "전 학년" 양쪽 허용
  if (trimmed === "전학년" || trimmed === "전 학년" || trimmed === "all")
    return "all";
  if (trimmed === "1학년" || trimmed === "1") return "1";
  if (trimmed === "2학년" || trimmed === "2") return "2";
  if (trimmed === "3학년" || trimmed === "3") return "3";
  return "all";
}
