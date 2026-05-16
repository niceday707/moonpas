#!/usr/bin/env node
// ============================================================================
// 문츠(Muntz) 자동 후보 수집기 (v2 — 카테고리 quota + 한국 가중치 + 채널 필터)
// ----------------------------------------------------------------------------
// 실행:  npm run muntz:find
//
// 동작:
//  1) YouTube Data API v3 search.list 로 카테고리별 인기 쇼츠 후보를 모은다.
//  2) videos.list 로 일괄 상세 메타 조회.
//  3) 길이/조회수/embeddable/madeForKids/금지 키워드/채널 블랙리스트 필터.
//  4) 카테고리별로 그룹화 → 각 카테고리 내 (한국어 우선, 조회수 내림차순) 정렬 →
//     quota 만큼 추출 → 합쳐서 viewCount 내림차순 상위 20개 저장.
//
// 정책:
//  - 영상은 다운로드/재업로드/자체 저장 안 함. 공개 메타데이터만.
//  - 자동 수집 결과는 모두 reviewStatus="pending" — 학생 노출 전 검수 필수.
//  - YOUTUBE_API_KEY 는 서버 전용. NEXT_PUBLIC_ 접두사 사용 금지.
//
// v2 변경점(2026-05-16):
//  - 단어 경계 매칭(영어) + 채널명 블랙리스트 추가
//  - 댄스 검색어 축소 + 과학/마술/스포츠/동물/예술/음식 검색어 강화
//  - 카테고리 quota 도입 (조회수 단순 내림차순 → 카테고리 다양성 확보)
//  - 한국어 채널/제목 가중치
//  - 출력에 safetyNote, reviewPriority, reasonForPick 필드 추가
// ============================================================================

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(__dirname, "output");
const OUTPUT_PATH = resolve(OUTPUT_DIR, "muntz-candidates.json");

// ─── .env.local 로딩 ────────────────────────────────────────────────────────
async function loadEnvLocal() {
  const envPath = resolve(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

await loadEnvLocal();

const API_KEY = (process.env.YOUTUBE_API_KEY ?? "").trim();
if (!API_KEY) {
  console.error("[muntz:find] YOUTUBE_API_KEY 가 설정되지 않았습니다.");
  console.error("  → 프로젝트 루트 .env.local 에 추가하세요 (NEXT_PUBLIC_ 금지).");
  process.exit(1);
}

// ─── 검색어 ↔ 카테고리 매핑 (v2: 다양성 강화) ───────────────────────────────
// 댄스/음악 비중을 줄이고, 시각 위주 안전 카테고리(과학·신기/마술·착시/스포츠/
// 동물/예술·제작/음식·디저트)를 강화. 한국어 검색어 6개 포함.
const QUERIES = [
  // 과학·신기
  { q: "amazing science shorts", category: "과학·신기" },
  { q: "physics experiment shorts", category: "과학·신기" },
  { q: "한국 과학 쇼츠", category: "과학·신기" },
  { q: "신기한 실험 쇼츠", category: "과학·신기" },
  // 마술·착시
  { q: "optical illusion shorts", category: "마술·착시" },
  { q: "magic trick shorts", category: "마술·착시" },
  { q: "착시 쇼츠", category: "마술·착시" },
  // 스포츠
  { q: "ping pong trick shots shorts", category: "스포츠" },
  { q: "basketball trick shots shorts", category: "스포츠" },
  { q: "스포츠 묘기 쇼츠", category: "스포츠" },
  // 동물
  { q: "cute animal shorts", category: "동물" },
  { q: "동물 쇼츠", category: "동물" },
  // 예술·제작
  { q: "satisfying art shorts", category: "예술·제작" },
  { q: "drawing process shorts", category: "예술·제작" },
  { q: "그림 과정 쇼츠", category: "예술·제작" },
  // 음식·디저트
  { q: "street food shorts", category: "음식·디저트" },
  { q: "korean street food shorts", category: "음식·디저트" },
  { q: "디저트 쇼츠", category: "음식·디저트" },
  // 음악·댄스 (1개로 축소)
  { q: "kpop challenge shorts korea", category: "음악·댄스" },
];

// 카테고리별 최대 노출 개수 (학교공감 quota 는 두되 현재 검색어 없음 — 후속 보강용)
const CATEGORY_QUOTA = {
  스포츠: 4,
  "과학·신기": 4,
  "마술·착시": 4,
  동물: 3,
  "예술·제작": 3,
  "음식·디저트": 3,
  "음악·댄스": 3,
  학교공감: 3,
};

// ─── 키워드/채널 블랙리스트 ──────────────────────────────────────────────────
// 영어 단일 단어 — \b 단어 경계로 매칭 (예: "hot" 이 "shot" 에 오탐 안 되게)
const BAD_WORDS_EN = [
  "prank", "dangerous", "fight", "sexy", "alcohol", "smoking",
  "gambling", "weapon", "horror", "gore", "drug",
  "model", "hot", "flex", "flexibility", "body",
  "goli", "gun", "bullet",
];

// 영어 다중 단어 표현 — substring 매칭
const BAD_PHRASES_EN = [
  "kid dance", "children dance", "girl dance", "viral girl",
];

// 한국어 — substring 매칭
const BAD_WORDS_KO = [
  "정치", "혐오", "욕설", "폭력", "선정", "술", "담배",
  "도박", "무기", "사고", "자극", "총",
];

// 채널명 차단 표현
const BAD_CHANNEL_TOKENS = [
  "model", "dance girl", "kid dance", "hot", "official model",
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BAD_WORDS_EN_RE = new RegExp(
  `\\b(?:${BAD_WORDS_EN.map(escapeRegExp).join("|")})\\b`,
  "i",
);
const BAD_PHRASES_EN_RE = new RegExp(
  `(?:${BAD_PHRASES_EN.map(escapeRegExp).join("|")})`,
  "i",
);

function containsBadKeyword(text) {
  if (!text) return false;
  if (BAD_WORDS_EN_RE.test(text)) return true;
  if (BAD_PHRASES_EN_RE.test(text)) return true;
  for (const kw of BAD_WORDS_KO) {
    if (text.includes(kw)) return true;
  }
  return false;
}

function isBadChannel(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  for (const token of BAD_CHANNEL_TOKENS) {
    if (token.includes(" ")) {
      if (lower.includes(token)) return true;
    } else {
      const re = new RegExp(`\\b${escapeRegExp(token)}\\b`, "i");
      if (re.test(lower)) return true;
    }
  }
  return false;
}

/** 한글 음절(가-힣) 포함 여부 — 채널/제목 어느 한쪽이라도 있으면 true */
function hasKorean(...texts) {
  for (const t of texts) {
    if (typeof t === "string" && /[가-힣]/.test(t)) return true;
  }
  return false;
}

// ─── 정책 상수 ──────────────────────────────────────────────────────────────
const MIN_VIEWS = 1_000_000;
const MAX_DURATION_SEC = 60;
const TOP_N = 20;
const SEARCH_PAGE_SIZE = 50;
const PUBLISHED_AFTER = new Date(
  Date.UTC(new Date().getUTCFullYear(), 0, 1),
).toISOString();

// ─── YouTube API ───────────────────────────────────────────────────────────
async function searchVideoIds(q) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoDuration", "short");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("order", "viewCount");
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("publishedAfter", PUBLISHED_AFTER);
  url.searchParams.set("maxResults", String(SEARCH_PAGE_SIZE));
  url.searchParams.set("q", q);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`search.list HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.items ?? [])
    .map((it) => it.id?.videoId)
    .filter((v) => typeof v === "string" && v.length === 11);
}

async function getVideoDetails(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("part", "snippet,statistics,contentDetails,status");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("maxResults", "50");
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`videos.list HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    out.push(...(json.items ?? []));
  }
  return out;
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────
function parseDurationSeconds(iso) {
  if (typeof iso !== "string") return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** 카테고리·국적 기반으로 검수 우선순위와 안내 문구를 부여 */
function annotate(c) {
  const cat = c.category;
  const isK = c.isKorean;
  const notes = [];
  let priority = "normal";

  if (cat === "음악·댄스") {
    priority = "high";
    notes.push("댄스/음악 — 복장·동작 톤 한 번 더 확인");
  } else if (cat === "학교공감") {
    if (isK) {
      priority = "normal";
      notes.push("한국 학교 콘텐츠");
    } else {
      priority = "high";
      notes.push("외국 학교 코미디 — 한국 정서 차이 검토");
    }
  } else {
    // 과학·신기 / 마술·착시 / 스포츠 / 동물 / 예술·제작 / 음식·디저트
    if (isK) {
      priority = "low";
      notes.push("한국어 콘텐츠 — 학생 친화");
    } else {
      priority = "normal";
      notes.push("외국 채널이지만 시각 위주 — 텍스트 의존 낮음");
    }
  }

  const reasonForPick = `카테고리 [${cat}] 내 ${
    isK ? "한국 채널 우선 + " : ""
  }조회수 상위`;

  return {
    ...c,
    safetyNote: notes.join(" · "),
    reviewPriority: priority,
    reasonForPick,
  };
}

// ─── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `[muntz:find v2] 검색 시작 — 쿼리 ${QUERIES.length}개, ` +
      `업로드일 ${PUBLISHED_AFTER.slice(0, 10)} 이후, ` +
      `조회수 ≥ ${MIN_VIEWS.toLocaleString()}, 길이 ≤ ${MAX_DURATION_SEC}s`,
  );

  // 1) 검색 — videoId → 카테고리 매핑 (첫 등장 카테고리 유지)
  const idCategoryMap = new Map();
  for (const { q, category } of QUERIES) {
    try {
      const ids = await searchVideoIds(q);
      let added = 0;
      for (const id of ids) {
        if (!idCategoryMap.has(id)) {
          idCategoryMap.set(id, category);
          added++;
        }
      }
      console.log(`  • "${q}" → 조회 ${ids.length}, 신규 ${added}`);
    } catch (e) {
      console.error(`  ! "${q}" 실패: ${e.message}`);
    }
  }

  const allIds = [...idCategoryMap.keys()];
  console.log(`[muntz:find v2] 중복 제거 후보 ${allIds.length}개`);

  if (allIds.length === 0) {
    await writeOutput([]);
    return;
  }

  // 2) 상세 메타
  const details = await getVideoDetails(allIds);
  console.log(`[muntz:find v2] 상세 조회 ${details.length}개`);

  // 3) 필터링 + 한국어 가중치 플래그
  const collectedAt = new Date().toISOString();
  const dropped = {
    duration: 0,
    views: 0,
    embeddable: 0,
    madeForKids: 0,
    badKeyword: 0,
    badChannel: 0,
    missing: 0,
  };
  const survivors = [];

  for (const v of details) {
    const id = v.id;
    const snippet = v.snippet ?? {};
    const stats = v.statistics ?? {};
    const contentDetails = v.contentDetails ?? {};
    const status = v.status ?? {};

    const title = snippet.title ?? "";
    const description = snippet.description ?? "";
    const channelTitle = snippet.channelTitle ?? "";
    const viewCount = Number(stats.viewCount ?? 0);
    const durationSec = parseDurationSeconds(contentDetails.duration);
    const embeddable = status.embeddable === true;
    const madeForKids = status.madeForKids === true;

    if (durationSec === null) { dropped.missing++; continue; }
    if (durationSec > MAX_DURATION_SEC) { dropped.duration++; continue; }
    if (viewCount < MIN_VIEWS) { dropped.views++; continue; }
    if (!embeddable) { dropped.embeddable++; continue; }
    if (madeForKids) { dropped.madeForKids++; continue; }
    if (isBadChannel(channelTitle)) { dropped.badChannel++; continue; }
    if (
      containsBadKeyword(title) ||
      containsBadKeyword(description) ||
      containsBadKeyword(channelTitle)
    ) {
      dropped.badKeyword++;
      continue;
    }

    survivors.push({
      youtubeId: id,
      youtubeUrl: `https://www.youtube.com/shorts/${id}`,
      title,
      channelTitle,
      publishedAt: snippet.publishedAt ?? "",
      viewCount,
      durationSeconds: durationSec,
      embeddable,
      category: idCategoryMap.get(id) ?? "기타",
      authorNickname: "문태미디어",
      targetGrade: "전학년",
      description: "쉬는 시간에 가볍게 볼 수 있는 짧은 영상입니다.",
      reviewStatus: "pending",
      source: "youtube_auto",
      collectedAt,
      // 내부 플래그 — 출력 직전 제거.
      isKorean: hasKorean(title, channelTitle),
    });
  }

  console.log("[muntz:find v2] 필터 결과:");
  console.log(`  • 통과:            ${survivors.length}`);
  console.log(`  • 길이 초과:        ${dropped.duration}`);
  console.log(`  • 조회수 부족:      ${dropped.views}`);
  console.log(`  • 임베드 불가:      ${dropped.embeddable}`);
  console.log(`  • madeForKids 제외: ${dropped.madeForKids}`);
  console.log(`  • 금지 키워드:      ${dropped.badKeyword}`);
  console.log(`  • 차단 채널:        ${dropped.badChannel}`);
  console.log(`  • 데이터 결손:      ${dropped.missing}`);

  // 4) 카테고리별 quota 적용 — 카테고리 내 (한국어 우선, 조회수 내림차순) 정렬
  const byCategory = new Map();
  for (const c of survivors) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category).push(c);
  }

  const selected = [];
  const distribution = {};
  for (const [cat, arr] of byCategory) {
    arr.sort((a, b) => {
      if (a.isKorean !== b.isKorean) return a.isKorean ? -1 : 1;
      return b.viewCount - a.viewCount;
    });
    const quota = CATEGORY_QUOTA[cat] ?? 0;
    const picked = arr.slice(0, quota);
    selected.push(...picked);
    distribution[cat] = `${picked.length}/${quota} (후보 ${arr.length})`;
  }

  // 5) 최종 정렬 (조회수 내림차순) → 상위 N → 메타 annotate → 내부 플래그 제거
  selected.sort((a, b) => b.viewCount - a.viewCount);
  const top = selected.slice(0, TOP_N).map((c) => {
    const annotated = annotate(c);
    // 출력 JSON 에는 isKorean 노출하지 않음.
    // eslint-disable-next-line no-unused-vars
    const { isKorean, ...rest } = annotated;
    return rest;
  });

  console.log("[muntz:find v2] 카테고리 quota 적용 결과:");
  for (const [cat, info] of Object.entries(distribution)) {
    console.log(`  • ${cat}: ${info}`);
  }

  await writeOutput(top);
  console.log(`[muntz:find v2] ${top.length}개 저장 → ${OUTPUT_PATH}`);
}

async function writeOutput(rows) {
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(rows, null, 2), "utf8");
}

main().catch((e) => {
  console.error("[muntz:find v2] 실패:", e);
  process.exit(1);
});
