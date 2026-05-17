#!/usr/bin/env node
// ============================================================================
// 문태 미디어 — 롱폼(16:9) 자동 후보 수집기
// ----------------------------------------------------------------------------
// 실행:  npm run moontube:find-long
//
// 동작 (find-muntz-candidates.mjs 와 같은 구조, 롱폼 버전):
//  1) YouTube Data API v3 search.list 로 카테고리별 한국어 롱폼 후보 수집.
//  2) videos.list 로 일괄 상세 메타 조회.
//  3) 길이(60초 초과 ~ 20분 이하)/조회수/embeddable/madeForKids/금지 키워드 필터.
//  4) 카테고리별 quota → 합쳐서 viewCount 내림차순 상위 10개 저장.
//
// 정책 (쇼츠와의 차이):
//  - 카테고리: 진로진학 / 동기부여 / 학습법 / 학교소식 (문튜브 4종, 한국어 검색).
//  - 조회수 기준 ≥ 100,000 (롱폼은 쇼츠보다 낮춤 — 진로/학습 영상은 조회수가 적음).
//  - 길이: > 60초 & ≤ 20분 (쇼츠와 겹치지 않게 하한 60초).
//  - 출력: videoType="long", source="youtube_auto", reviewStatus="pending".
//
// 영상은 다운로드/재업로드 안 함. 공개 메타데이터만. 자동 수집물은 모두
// reviewStatus="pending" — 학생 노출 전 사람 검수 필수.
// YOUTUBE_API_KEY 는 서버 전용. NEXT_PUBLIC_ 접두사 금지.
// ============================================================================

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(__dirname, "output");
const OUTPUT_PATH = resolve(OUTPUT_DIR, "moontube-longform.json");

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
  console.error("[moontube:find-long] YOUTUBE_API_KEY 가 설정되지 않았습니다.");
  console.error("  → 프로젝트 루트 .env.local 에 추가하세요 (NEXT_PUBLIC_ 금지).");
  process.exit(1);
}

// ─── 검색어 ↔ 카테고리 (문튜브 4종, 한국어 위주) ─────────────────────────────
// 사용자 요청 코어 키워드(2026 수능 준비/고등학생 공부법/진로 탐색/내신 대비/
// 학교생활 팁)를 카테고리별 대표 쿼리로 포함 — 추가로 카테고리별 보강 쿼리.
const QUERIES = [
  // 진로진학
  { q: "2026 수능 준비", category: "진로진학" },
  { q: "진로 탐색 고등학생", category: "진로진학" },
  { q: "2028 대입 입시 설명", category: "진로진학" },
  { q: "학생부 종합전형 준비", category: "진로진학" },
  // 동기부여
  { q: "수험생 동기부여 영상", category: "동기부여" },
  { q: "공부 자극 명언 한국", category: "동기부여" },
  { q: "합격 수기 인터뷰", category: "동기부여" },
  // 학습법
  { q: "고등학생 공부법", category: "학습법" },
  { q: "내신 대비 공부법", category: "학습법" },
  { q: "효율적인 공부법", category: "학습법" },
  { q: "노트 정리법 공부", category: "학습법" },
  { q: "수학 공부법 고등", category: "학습법" },
  { q: "영어 단어 암기법", category: "학습법" },
  // 학교소식
  { q: "학교생활 팁 고등학생", category: "학교소식" },
  { q: "고등학교 학교 행사 브이로그", category: "학교소식" },
  { q: "교육부 고등학교 정책 발표", category: "학교소식" },
];

// 카테고리별 최대 노출 개수 (합 = TOP_N 근처)
const CATEGORY_QUOTA = {
  진로진학: 3,
  동기부여: 3,
  학습법: 3,
  학교소식: 2,
};

// ─── 키워드/채널 블랙리스트 (쇼츠 스크립트와 동일 정책) ──────────────────────
const BAD_WORDS_EN = [
  "prank", "dangerous", "fight", "sexy", "alcohol", "smoking",
  "gambling", "weapon", "horror", "gore", "drug",
  "model", "hot", "flex", "body", "gun", "bullet",
];
const BAD_PHRASES_EN = [
  "kid dance", "children dance", "girl dance", "viral girl",
];
const BAD_WORDS_KO = [
  "정치", "혐오", "욕설", "폭력", "선정", "술", "담배",
  "도박", "무기", "사고", "자극적", "총", "성인",
];
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

function hasKorean(...texts) {
  for (const t of texts) {
    if (typeof t === "string" && /[가-힣]/.test(t)) return true;
  }
  return false;
}

// ─── 정책 상수 ──────────────────────────────────────────────────────────────
const MIN_VIEWS = 100_000; // 롱폼은 쇼츠(1M)보다 낮춤
const MIN_DURATION_SEC = 61; // 쇼츠와 겹치지 않게 하한
const MAX_DURATION_SEC = 20 * 60; // 20분
const TOP_N = 10;
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
  // 롱폼: short(4분 미만) 제외하고 medium(4~20분) 우선. 60초~4분 구간은
  // medium 에 안 잡힐 수 있으나 duration 직접 검증으로 보강.
  url.searchParams.set("videoDuration", "medium");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("order", "viewCount");
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("regionCode", "KR");
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

function parseDurationSeconds(iso) {
  if (typeof iso !== "string") return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function annotate(c) {
  const notes = [];
  let priority = "normal";
  if (c.isKorean) {
    priority = "low";
    notes.push("한국어 콘텐츠 — 학생 친화");
  } else {
    priority = "high";
    notes.push("외국 채널 — 한국 학생 정서/언어 적합성 검토");
  }
  if (c.category === "학교소식") {
    priority = "high";
    notes.push("학교소식 — 출처 신뢰도/최신성 확인");
  }
  return {
    ...c,
    safetyNote: notes.join(" · "),
    reviewPriority: priority,
    reasonForPick: `카테고리 [${c.category}] 내 ${
      c.isKorean ? "한국 채널 우선 + " : ""
    }조회수 상위`,
  };
}

// ─── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `[moontube:find-long] 검색 시작 — 쿼리 ${QUERIES.length}개, ` +
      `업로드일 ${PUBLISHED_AFTER.slice(0, 10)} 이후, ` +
      `조회수 ≥ ${MIN_VIEWS.toLocaleString()}, ` +
      `길이 ${MIN_DURATION_SEC}~${MAX_DURATION_SEC}s`,
  );

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
  console.log(`[moontube:find-long] 중복 제거 후보 ${allIds.length}개`);
  if (allIds.length === 0) {
    await writeOutput([]);
    return;
  }

  const details = await getVideoDetails(allIds);
  console.log(`[moontube:find-long] 상세 조회 ${details.length}개`);

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
    if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) {
      dropped.duration++;
      continue;
    }
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
      youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
      title,
      channelTitle,
      publishedAt: snippet.publishedAt ?? "",
      viewCount,
      durationSeconds: durationSec,
      embeddable,
      category: idCategoryMap.get(id) ?? "진로진학",
      videoType: "long", // moontube_items.video_type — 롱폼
      authorNickname: "문태미디어",
      targetGrade: "전학년",
      description:
        "진로·학습에 도움이 되는 영상입니다. (자동 수집 — 검수 전)",
      reviewStatus: "pending",
      source: "youtube_auto",
      collectedAt,
      isKorean: hasKorean(title, channelTitle),
    });
  }

  console.log("[moontube:find-long] 필터 결과:");
  console.log(`  • 통과:            ${survivors.length}`);
  console.log(`  • 길이 범위 밖:     ${dropped.duration}`);
  console.log(`  • 조회수 부족:      ${dropped.views}`);
  console.log(`  • 임베드 불가:      ${dropped.embeddable}`);
  console.log(`  • madeForKids 제외: ${dropped.madeForKids}`);
  console.log(`  • 금지 키워드:      ${dropped.badKeyword}`);
  console.log(`  • 차단 채널:        ${dropped.badChannel}`);
  console.log(`  • 데이터 결손:      ${dropped.missing}`);

  // 카테고리별 quota — 카테고리 내 (한국어 우선, 조회수 내림차순)
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

  selected.sort((a, b) => b.viewCount - a.viewCount);
  const top = selected.slice(0, TOP_N).map((c) => {
    const annotated = annotate(c);
    // eslint-disable-next-line no-unused-vars
    const { isKorean, ...rest } = annotated;
    return rest;
  });

  console.log("[moontube:find-long] 카테고리 quota 적용 결과:");
  for (const [cat, info] of Object.entries(distribution)) {
    console.log(`  • ${cat}: ${info}`);
  }

  await writeOutput(top);
  console.log(`[moontube:find-long] ${top.length}개 저장 → ${OUTPUT_PATH}`);
}

async function writeOutput(rows) {
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(rows, null, 2), "utf8");
}

main().catch((e) => {
  console.error("[moontube:find-long] 실패:", e);
  process.exit(1);
});
