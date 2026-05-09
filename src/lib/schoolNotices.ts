// 문태고 홈페이지 공지 게시판 3종 크롤링 + DB upsert.
//
//   selectNttList.do 페이지의 게시글 목록 table 을 cheerio 로 파싱한다.
//   각 게시판의 mi/bbsId 는 source 별로 고정 — 사용자가 명시한 값 사용.
//
//   파싱 규칙(사용자 지정):
//     · 게시글 목록은 table 안에 있음
//     · 각 행에서 제목 = a 태그 텍스트
//     · 링크 href 에서 nttSn 쿼리 추출
//     · 날짜 = 같은 행 td 중 YYYY.MM.DD 형식
//
//   원문 상세 URL:
//     https://moontae.hs.jne.kr/moontae_hs/na/ntt/selectNttInfo.do?mi={mi}&nttSn={nttSn}&bbsId={bbsId}

import * as cheerio from "cheerio";

export type SchoolNoticeSource = "school" | "news" | "letter";

export const SCHOOL_NOTICE_SOURCE_META: Record<
  SchoolNoticeSource,
  { label: string; emoji: string; mi: string; bbsId: string }
> = {
  school: {
    label: "학교공지",
    emoji: "🏫",
    mi: "113099",
    bbsId: "113099",
  },
  news: {
    label: "문태소식",
    emoji: "📰",
    mi: "113100",
    bbsId: "113100",
  },
  letter: {
    label: "가정통신문",
    emoji: "📬",
    mi: "113111",
    bbsId: "113111",
  },
};

export const ALL_SOURCES: SchoolNoticeSource[] = ["school", "news", "letter"];

const BASE_LIST_URL =
  "https://moontae.hs.jne.kr/moontae_hs/na/ntt/selectNttList.do";
const BASE_DETAIL_URL =
  "https://moontae.hs.jne.kr/moontae_hs/na/ntt/selectNttInfo.do";

/** 목록 페이지 URL — mi/bbsId 만 다르고 나머지 쿼리는 동일 */
export function buildListUrl(source: SchoolNoticeSource): string {
  const m = SCHOOL_NOTICE_SOURCE_META[source];
  return `${BASE_LIST_URL}?mi=${m.mi}&bbsId=${m.bbsId}`;
}

/** 원문 상세 URL — 새 탭으로 이동시킬 때 사용 */
export function buildDetailUrl(
  source: SchoolNoticeSource,
  nttSn: string,
): string {
  const m = SCHOOL_NOTICE_SOURCE_META[source];
  return `${BASE_DETAIL_URL}?mi=${m.mi}&nttSn=${nttSn}&bbsId=${m.bbsId}`;
}

// ─────────────────────────────────────────────────────────
// 파싱
// ─────────────────────────────────────────────────────────

const NTT_SN_RE = /[?&]nttSn=([0-9]+)/i;
const DATE_RE = /(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/;

export type ParsedNotice = {
  source: SchoolNoticeSource;
  title: string;
  date: string; // YYYY-MM-DD
  ntt_sn: string;
  original_url: string;
};

/**
 * cheerio 로 목록 HTML 을 파싱해 공지 배열로 변환.
 *   - table 안의 모든 row 에서 nttSn 가 추출되는 a 태그를 찾는다.
 *   - 같은 행에서 YYYY.MM.DD 패턴을 찾아 date 로 사용.
 *   - 헤더/페이징 row 등 nttSn 이 없는 행은 자동 스킵.
 *   - 동일 nttSn 이 중복되면 첫 항목만 유지(공지 고정 + 일반 노출 케이스).
 */
export function parseNoticeList(
  html: string,
  source: SchoolNoticeSource,
): ParsedNotice[] {
  const $ = cheerio.load(html);
  const out: ParsedNotice[] = [];
  const seen = new Set<string>();

  $("table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    // nttSn 가 들어 있는 a 태그를 우선 찾는다 (제목 셀)
    let nttSn: string | null = null;
    let title = "";
    $tr.find("a").each((_i, a) => {
      const href = $(a).attr("href") ?? "";
      const m = NTT_SN_RE.exec(href);
      if (m && !nttSn) {
        nttSn = m[1];
        title = $(a).text().replace(/\s+/g, " ").trim();
      }
    });
    if (!nttSn || !title) return;
    if (seen.has(nttSn)) return;

    // 날짜 — 행의 모든 td 텍스트 중 YYYY.MM.DD 패턴 찾기
    let date: string | null = null;
    $tr.find("td").each((_i, td) => {
      if (date) return;
      const txt = $(td).text();
      const dm = DATE_RE.exec(txt);
      if (dm) {
        const yy = dm[1];
        const mm = dm[2].padStart(2, "0");
        const dd = dm[3].padStart(2, "0");
        date = `${yy}-${mm}-${dd}`;
      }
    });
    // 날짜가 없으면 현재 날짜로 폴백 — 정렬 무너지지 않도록
    if (!date) {
      const now = new Date();
      const yy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      date = `${yy}-${mm}-${dd}`;
    }

    seen.add(nttSn);
    out.push({
      source,
      title,
      date,
      ntt_sn: nttSn,
      original_url: buildDetailUrl(source, nttSn),
    });
  });

  return out;
}

// ─────────────────────────────────────────────────────────
// fetch + 파싱 (서버 전용)
// ─────────────────────────────────────────────────────────

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 MoonPasCrawler/1.0",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

const FETCH_TIMEOUT_MS = 15_000;

async function fetchListHtml(source: SchoolNoticeSource): Promise<string> {
  const url = buildListUrl(source);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${source}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** source 한 종류 크롤링 + 파싱 */
export async function crawlSource(
  source: SchoolNoticeSource,
): Promise<ParsedNotice[]> {
  const html = await fetchListHtml(source);
  return parseNoticeList(html, source);
}

/** 3종 모두 병렬 크롤링. 일부 실패해도 성공한 source 결과는 반환. */
export async function crawlAllSources(): Promise<{
  results: ParsedNotice[];
  errors: { source: SchoolNoticeSource; message: string }[];
}> {
  const settled = await Promise.allSettled(ALL_SOURCES.map(crawlSource));
  const results: ParsedNotice[] = [];
  const errors: { source: SchoolNoticeSource; message: string }[] = [];
  settled.forEach((r, i) => {
    const src = ALL_SOURCES[i];
    if (r.status === "fulfilled") {
      results.push(...r.value);
    } else {
      errors.push({
        source: src,
        message:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  return { results, errors };
}
