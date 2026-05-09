// 문태고 홈페이지 공지 게시판 3종 크롤링 + DB upsert.
//
//   selectNttList.do 페이지의 게시글 목록 table 을 cheerio 로 파싱한다.
//   각 게시판의 mi/bbsId 는 source 별로 고정 — 사용자가 명시한 값 사용.
//
//   실제 HTML 구조 (2026.05 기준 확인):
//     <div class="bbs_ListA">
//       <table id="myTable">
//         <tbody>
//           <tr>
//             <td class="modNone">671</td>             ← 번호 또는 "공지" 뱃지
//             <td class="bbs_tit">
//               <a href="javascript:" data-id="1801043214" class="nttInfoBtn">
//                 제목 텍스트
//               </a>
//             </td>
//             <td>... 작성자 ...</td>
//             <td><em class="mTit">등록일</em> 2026.04.28</td>
//             <td><em class="mTit">조회수</em> 285</td>
//           </tr>
//           ...
//
//   ★ 핵심: nttSn 은 <a href> 가 아니라 <a class="nttInfoBtn" data-id="..."> 의
//     data-id 속성에 있다. 클릭 시 JS 가 form submit 으로 상세 페이지로 이동.
//
//   원문 상세 URL 패턴:
//     /moontae_hs/na/ntt/selectNttInfo.do?mi={mi}&nttSn={nttSn}&bbsId={bbsId}

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

const NTT_SN_HREF_RE = /[?&]nttSn=([0-9]+)/i;
const NTT_SN_ONCLICK_RE = /\bnttSn\s*[:=,]?\s*['"]?([0-9]+)/i;
const DIGITS_ONLY_RE = /^\d+$/;
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
 *   1) <a class="nttInfoBtn" data-id="..."> 의 data-id 를 우선 사용 (현재 구조)
 *   2) <a href> 에 nttSn 쿼리가 있으면 폴백 (구버전 대비)
 *   3) <a onclick> 에 nttSn 토큰이 있으면 폴백
 *   4) 날짜는 같은 행의 td 에서 YYYY.MM.DD 패턴 매칭
 *   5) 동일 nttSn 이 두 번 나오면 첫 항목만 유지
 *      ('공지' 고정 + 일반 노출 케이스에서 정렬 안정성을 위해)
 */
export function parseNoticeList(
  html: string,
  source: SchoolNoticeSource,
): ParsedNotice[] {
  const $ = cheerio.load(html);
  const out: ParsedNotice[] = [];
  const seen = new Set<string>();

  // 1차: id="myTable" 우선, 폴백으로 일반 table
  const $rows = $("table#myTable tbody tr, .bbs_ListA table tbody tr").length
    ? $("table#myTable tbody tr, .bbs_ListA table tbody tr")
    : $("table tbody tr");

  $rows.each((_, tr) => {
    const $tr = $(tr);
    let nttSn: string | null = null;
    let title = "";

    // (1) data-id 속성을 가진 a 태그
    $tr.find("a[data-id], a.nttInfoBtn").each((_i, a) => {
      if (nttSn) return;
      const dataId = $(a).attr("data-id") ?? "";
      if (dataId && DIGITS_ONLY_RE.test(dataId)) {
        nttSn = dataId;
        title = $(a).text().replace(/\s+/g, " ").trim();
      }
    });

    // (2) href 에 nttSn 쿼리 — 구버전 폴백
    if (!nttSn) {
      $tr.find("a").each((_i, a) => {
        if (nttSn) return;
        const href = $(a).attr("href") ?? "";
        const m = NTT_SN_HREF_RE.exec(href);
        if (m) {
          nttSn = m[1];
          title = $(a).text().replace(/\s+/g, " ").trim();
        }
      });
    }

    // (3) onclick 안의 nttSn 토큰
    if (!nttSn) {
      $tr.find("a").each((_i, a) => {
        if (nttSn) return;
        const onclick = $(a).attr("onclick") ?? "";
        const m = NTT_SN_ONCLICK_RE.exec(onclick);
        if (m) {
          nttSn = m[1];
          title = $(a).text().replace(/\s+/g, " ").trim();
        }
      });
    }

    if (!nttSn || !title) return;
    if (seen.has(nttSn)) return;

    // 날짜 — 같은 행의 td 에서 YYYY.MM.DD 패턴 (등록일 셀)
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
    if (!date) {
      // 날짜가 없으면 오늘 날짜로 폴백 — 정렬 안정성
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
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
};

const FETCH_TIMEOUT_MS = 15_000;

async function fetchListHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status} ${res.statusText.trim() || "(no statusText)"} — ${url}`,
      );
    }
    return await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`timeout ${FETCH_TIMEOUT_MS}ms — ${url}`);
    }
    if (e instanceof Error) {
      // URL 이 메시지에 이미 포함되어 있지 않으면 추가
      throw e.message.includes(url) ? e : new Error(`${e.message} — ${url}`);
    }
    throw new Error(`${String(e)} — ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

/** source 한 종류 크롤링 + 파싱 — raw HTML 도 함께 반환 (debug 용) */
export async function crawlSource(source: SchoolNoticeSource): Promise<{
  html: string;
  parsed: ParsedNotice[];
  url: string;
}> {
  const url = buildListUrl(source);
  const html = await fetchListHtml(url);
  const parsed = parseNoticeList(html, source);
  return { html, parsed, url };
}

export type CrawlError = {
  source: SchoolNoticeSource;
  url: string;
  message: string;
};

export type CrawlAllResult = {
  results: ParsedNotice[];
  errors: CrawlError[];
  rawHtmls: { source: SchoolNoticeSource; url: string; html: string }[];
};

/**
 * 3종 모두 병렬 크롤링.
 *   - 일부 실패해도 성공한 source 결과는 반환.
 *   - fetch 는 성공했지만 파싱이 0건이면 그것도 errors 에 기록 (selector drift 감지)
 *   - rawHtmls 는 debug 모드에서 응답에 포함시키기 위해 항상 반환
 */
export async function crawlAllSources(): Promise<CrawlAllResult> {
  const settled = await Promise.allSettled(ALL_SOURCES.map(crawlSource));
  const results: ParsedNotice[] = [];
  const errors: CrawlError[] = [];
  const rawHtmls: CrawlAllResult["rawHtmls"] = [];

  settled.forEach((r, i) => {
    const source = ALL_SOURCES[i];
    const url = buildListUrl(source);
    if (r.status === "fulfilled") {
      rawHtmls.push({ source, url, html: r.value.html });
      if (r.value.parsed.length === 0) {
        errors.push({
          source,
          url,
          message: `parsed 0 rows (HTML length=${r.value.html.length}) — selectors may have drifted at ${url}`,
        });
      } else {
        results.push(...r.value.parsed);
      }
    } else {
      // rejected 의 reason 은 위에서 던진 Error 라 url 이 메시지에 이미 포함됨
      const message =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({
        source,
        url,
        message: message.includes(url) ? message : `${message} — ${url}`,
      });
    }
  });

  return { results, errors, rawHtmls };
}
