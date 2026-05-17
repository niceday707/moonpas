// ============================================================================
// 문태 미디어(MoonTube) — 통합 타입/상수/유틸 + Supabase fallback 데이터
// ----------------------------------------------------------------------------
// 롱폼(16:9)·쇼츠(9:16)를 하나의 MoontubeItem 으로 다룬다. DB(moontube_items)
// 스키마와 1:1 대응. 영상 자체는 저장하지 않고 youtube_id + 메타데이터만 보관.
//
// · 롱폼 카테고리 = 문튜브 4종(진로진학/동기부여/학습법/학교소식)
// · 쇼츠 카테고리 = 문츠 6종(스포츠/과학·신기/마술·착시/동물/예술·제작/음식·디저트)
//   category 컬럼은 TEXT 라 두 체계를 그대로 담는다.
//
// ⚠️ FALLBACK 은 Supabase 조회가 비었거나 실패했을 때만 쓰는 데모용. 실데이터가
//    쌓이면 비워도 된다. fallback 항목의 인터랙션(좋아요/댓글)은 로컬 더미로만
//    동작한다(실 row 가 없어 DB 에 못 붙음) — page 가 분기 처리.
// ============================================================================

import {
  YOUTUBE_VIDEOS,
  YOUTUBE_CATEGORIES,
  CATEGORY_COLOR as LONG_CATEGORY_COLOR,
  type YoutubeCategory,
} from "@/lib/youtube-data";
import {
  MUNTZ_ITEMS_FALLBACK,
  MUNTZ_CATEGORIES,
  CATEGORY_COLOR as SHORT_CATEGORY_COLOR,
  type MuntzCategory,
} from "@/lib/muntz-data";

export type { YoutubeCategory, MuntzCategory };
export { YOUTUBE_CATEGORIES, MUNTZ_CATEGORIES };

/** 영상 유형 — DB video_type 컬럼과 동일 */
export type MoontubeVideoType = "short" | "long";

/** 검수 상태 — DB review_status 컬럼과 동일 */
export type MoontubeReviewStatus =
  | "visible"
  | "pending"
  | "hidden"
  | "auto_approved"
  | "rejected";

/** 등록 출처 */
export type MoontubeSource = "manual" | "youtube_auto";

/** 통합 영상 모델 — moontube_items row 와 1:1 (카운트 포함) */
export type MoontubeItem = {
  /** DB 의 uuid. fallback 은 합성 id("fallback-...") */
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  /** 문파스에서 이 링크를 올린 사람 닉네임 */
  authorNickname: string;
  videoType: MoontubeVideoType;
  /** 롱폼이면 YoutubeCategory, 쇼츠면 MuntzCategory 문자열 */
  category: string;
  /** 대상 학년 라벨("전 학년"/"1학년"...) */
  targetGrade: string;
  description: string;
  safetyNote?: string;
  source: MoontubeSource;
  reviewStatus: MoontubeReviewStatus;
  likeCount: number;
  saveCount: number;
  viewCount: number;
  commentCount: number;
  createdBy: string | null;
  createdAt: string;
  /** 유튜브 원본 업로드 시각(ISO8601). 없으면 카드/상세에서 상대 시간 표기를 숨긴다. */
  publishedAt?: string;
  /** Supabase 가 아니라 fallback(mock) 에서 온 항목인지 — 인터랙션 분기용 */
  isFallback?: boolean;
};

/**
 * 통합 카테고리 — 롱폼/쇼츠 동일하게 사용.
 * 영상 등록 모달과 필터 칩에서 모두 사용한다.
 * "직접입력" 은 등록 모달에서만 노출되는 가상 옵션(텍스트 입력 모드 전환용).
 */
export const MOONTUBE_CATEGORIES: string[] = [
  "진로진학",
  "동기부여",
  "학습법",
  "학교소식",
  "스포츠",
  "과학·신기",
  "마술·착시",
  "동물",
  "예술·제작",
  "음식·디저트",
  "음악",
  "먹방",
];

/** 등록 모달에서 "직접입력" 선택 시 사용할 라벨 */
export const MOONTUBE_CATEGORY_CUSTOM = "직접입력";

/** 통합 카테고리 외 추가 색상 — 기존 롱폼/쇼츠 팔레트에 없던 항목만 정의 */
const EXTRA_CATEGORY_COLOR: Record<string, string> = {
  음악: "#8b5cf6", // 바이올렛
  먹방: "#ef4444", // 레드
};

/** 카테고리 → 강조색 (롱폼/쇼츠 팔레트 통합). 매치 안 되면 메인 보라. */
export function moontubeCategoryColor(cat: string): string {
  if (cat === "전체") return "#7c3aed";
  if ((YOUTUBE_CATEGORIES as readonly string[]).includes(cat)) {
    return LONG_CATEGORY_COLOR[cat as YoutubeCategory];
  }
  if ((MUNTZ_CATEGORIES as readonly string[]).includes(cat)) {
    return SHORT_CATEGORY_COLOR[cat as MuntzCategory];
  }
  if (EXTRA_CATEGORY_COLOR[cat]) return EXTRA_CATEGORY_COLOR[cat];
  return "#7c3aed";
}

/** 통합 카테고리 칩 순서 — 전체 + 통합 카테고리 */
export const MOONTUBE_TABS: string[] = ["전체", ...MOONTUBE_CATEGORIES];

// ─── 유튜브 유틸 ─────────────────────────────────────────────────────────────

/** 유튜브 링크/ID 에서 11자리 영상 ID 추출. 실패 시 null. */
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

/**
 * URL 형태로 영상 유형 자동 감지.
 *  · ".../shorts/..." 가 들어 있으면 'short'
 *  · 그 외(watch/youtu.be/embed/ID 직접)는 'long'
 */
export function detectVideoType(input: string): MoontubeVideoType {
  return /\/shorts\//i.test(input) ? "short" : "long";
}

/** 표준 유튜브 URL — 유형별 경로. */
export function youtubeUrlFor(id: string, type: MoontubeVideoType): string {
  return type === "short"
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;
}

/** 썸네일 URL (img.youtube.com) — 등록 시 컬럼에 저장. */
export function youtubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/**
 * 유튜브식 조회수 한국어 축약 — 카드/상세뷰/쇼츠 메타에서 사용.
 *  · 1만 미만:    "9,876"        (천 단위 콤마)
 *  · 1만~9.9만:   "9.8만"        (소수점 1자리)
 *  · 10만~999만:  "43만", "431만" (정수)
 *  · 1000만 이상: "1,200만"      (정수 + 콤마)
 * 좋아요/저장 등 자체 카운트 표기에는 기존 formatCount("1.2천"/"2.3만")를 그대로 쓴다.
 */
export function formatViewCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 10000) return n.toLocaleString("ko-KR");
  if (n < 100000) {
    const v = (n / 10000).toFixed(1).replace(/\.0$/, "");
    return `${v}만`;
  }
  if (n < 10_000_000) return `${Math.floor(n / 10000)}만`;
  return `${Math.floor(n / 10000).toLocaleString("ko-KR")}만`;
}

/**
 * 유튜브식 상대 시간 표시 — "N분/시간/일/주/개월/년 전".
 * 미래 시각(시계 어긋남)은 "방금 전" 으로 처리. 빈/잘못된 값은 빈 문자열.
 * 호출 측은 빈 문자열일 때 표기를 숨길 것.
 */
export function formatRelativeDate(input: string | null | undefined): string {
  if (!input) return "";
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "방금 전";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  if (day < 30) return `${Math.floor(day / 7)}주 전`;
  if (day < 365) return `${Math.floor(day / 30)}개월 전`;
  return `${Math.floor(day / 365)}년 전`;
}

/**
 * 임베드 URL — youtube-nocookie + 트래킹/관련영상 최소화.
 * 쇼츠도 일반 embed 경로에서 정상 재생된다.
 */
export function moontubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

/** UI 라벨("전 학년"/"1학년"...) ↔ 키 변환 (muntz 와 동일 규칙) */
export const TARGET_GRADE_LABEL: Record<string, string> = {
  all: "전 학년",
  "1": "1학년",
  "2": "2학년",
  "3": "3학년",
};

export function normalizeGradeLabel(
  label: string | null | undefined,
): string {
  if (!label) return "전 학년";
  const t = label.trim();
  if (t === "전학년" || t === "전 학년" || t === "all") return "전 학년";
  if (t === "1학년" || t === "1") return "1학년";
  if (t === "2학년" || t === "2") return "2학년";
  if (t === "3학년" || t === "3") return "3학년";
  return "전 학년";
}

// ─── Supabase fallback (조회 실패/빈 결과 시 데모용) ────────────────────────
// 롱폼: 기존 YOUTUBE_VIDEOS(정적 큐레이션) → MoontubeItem 변환.
// 쇼츠: 기존 MUNTZ_ITEMS_FALLBACK 재사용.
// 모두 isFallback:true — page 가 인터랙션을 로컬 더미로 처리한다.

let fallbackCache: MoontubeItem[] | null = null;

export function getMoontubeFallback(): MoontubeItem[] {
  if (fallbackCache) return fallbackCache;

  const longs: MoontubeItem[] = YOUTUBE_VIDEOS.map((v, i) => ({
    id: `fallback-long-${i}-${v.id}`,
    youtubeId: v.id,
    youtubeUrl: youtubeUrlFor(v.id, "long"),
    title: v.title,
    // 실제 유튜브 채널명이 있으면 그걸, 없으면 브랜드명으로 폴백
    channelTitle: v.channelTitle ?? "문튜브",
    thumbnailUrl: youtubeThumbnailUrl(v.id),
    authorNickname: "문태미디어",
    videoType: "long",
    category: v.category,
    targetGrade: "전 학년",
    description: "",
    source: "manual",
    reviewStatus: "visible",
    likeCount: 0,
    saveCount: 0,
    // 유튜브 실제 조회수(있으면) — 큐레이션 시점 누적값. 없으면 0(=숨김 가능).
    viewCount: v.viewCount ?? 0,
    commentCount: 0,
    createdBy: null,
    createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    publishedAt: v.publishedAt,
    isFallback: true,
  }));

  const shorts: MoontubeItem[] = MUNTZ_ITEMS_FALLBACK.map((s, i) => ({
    id: `fallback-short-${i}-${s.youtubeId}`,
    youtubeId: s.youtubeId,
    youtubeUrl:
      s.youtubeUrl ?? youtubeUrlFor(s.youtubeId, "short"),
    title: s.title,
    channelTitle: s.channelTitle,
    thumbnailUrl: youtubeThumbnailUrl(s.youtubeId),
    authorNickname: s.authorNickname,
    videoType: "short",
    category: s.category,
    targetGrade: TARGET_GRADE_LABEL[s.targetGrade] ?? "전 학년",
    description: s.description ?? "",
    safetyNote: s.safetyNote,
    source: "youtube_auto",
    reviewStatus: "visible",
    likeCount: 0,
    saveCount: 0,
    viewCount: s.viewCount ?? 0,
    commentCount: 0,
    createdBy: null,
    createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    publishedAt: s.publishedAt,
    isFallback: true,
  }));

  fallbackCache = [...longs, ...shorts];
  return fallbackCache;
}
