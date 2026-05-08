// NEIS Open API 급식 정보 프록시
// - 환경변수 NEIS_API_KEY 필요 (Vercel Settings → Environment Variables 에 등록)
// - 교육청 Q10 (전라남도교육청), 학교 Q100000215 (문태고)
// - GET /api/meal?date=YYYYMMDD          → { date, lunch, dinner, error?, meta? }
// - GET /api/meal?date=YYYYMMDD&debug=1  → 캐시 우회 + meta 항상 포함
// - 키 누락/NEIS 에러 시 status 500 + 명시적 error 메시지
// - 매 호출 콘솔에 마스킹된 URL + NEIS 응답 본문 로깅

import { NextResponse } from "next/server";

export const revalidate = 3600;

const ATPT_OFCDC_SC_CODE = "Q10";
const SD_SCHUL_CODE = "Q100000215";
const NEIS_URL = "https://open.neis.go.kr/hub/mealServiceDietInfo";

// 식사구분 코드 (NEIS): 1=조식 2=중식 3=석식
type MealKey = "lunch" | "dinner";
const MEAL_CODE_MAP: Record<string, MealKey> = { "2": "lunch", "3": "dinner" };

type MenuItem = { name: string; allergens: number[] };
type MealBlock = { menus: MenuItem[]; kcal: number | null } | null;
type DebugMeta = {
  hasApiKey: boolean;
  apiKeyHint: string | null;
  upstreamStatus: number | null;
  upstreamUrl: string | null;
  resultCode: string | null;
  resultMessage: string | null;
  rowCount: number;
  date: string;
};
type ApiResponse = {
  date: string;
  lunch: MealBlock;
  dinner: MealBlock;
  error?: string;
  meta?: DebugMeta;
};

type NeisRow = {
  MLSV_YMD?: string;
  MMEAL_SC_CODE?: string;
  MMEAL_SC_NM?: string;
  DDISH_NM?: string;
  CAL_INFO?: string;
};

function parseDishes(raw: string): MenuItem[] {
  if (!raw) return [];
  return raw
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*\(([\d.\s,]+)\)\s*$/);
      if (!m) return { name: line, allergens: [] as number[] };
      const name = m[1].trim();
      const allergens = m[2]
        .split(/[.,\s]+/)
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0);
      return { name, allergens };
    });
}

function parseKcal(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/[\d.]+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function isValidDate(d: string): boolean {
  return /^\d{8}$/.test(d);
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// 키의 처음 4자리만 노출 (전체 키는 절대 로그에 남기지 않음)
function maskKey(key: string): string {
  if (key.length <= 4) return "*".repeat(key.length);
  return `${key.slice(0, 4)}${"*".repeat(Math.max(0, key.length - 4))} (len=${key.length})`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayYmd();
  const debug = url.searchParams.get("debug") === "1";

  if (!isValidDate(date)) {
    return NextResponse.json(
      { error: "date 파라미터는 YYYYMMDD 형식이어야 합니다." },
      { status: 400 },
    );
  }

  const apiKey = process.env.NEIS_API_KEY;
  const meta: DebugMeta = {
    hasApiKey: !!apiKey,
    apiKeyHint: apiKey ? maskKey(apiKey) : null,
    upstreamStatus: null,
    upstreamUrl: null,
    resultCode: null,
    resultMessage: null,
    rowCount: 0,
    date,
  };

  // (a) 키 미설정 시 — 명시적 500 에러 반환 (이전엔 200+빈데이터로 조용히 넘겼음)
  if (!apiKey) {
    const msg =
      "NEIS_API_KEY 환경변수가 설정되지 않았습니다. " +
      "Vercel → Settings → Environment Variables 에 NEIS_API_KEY 를 추가한 뒤 " +
      "Deployments 탭에서 최신 배포를 'Redeploy' 해야 적용됩니다. " +
      "환경변수는 NEXT_PUBLIC_ 접두사 없이 서버사이드 전용으로 사용됩니다.";
    console.error("[/api/meal]", msg);
    return NextResponse.json(
      {
        date,
        lunch: null,
        dinner: null,
        error: msg,
        meta,
      } satisfies ApiResponse,
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    KEY: apiKey,
    Type: "json",
    pIndex: "1",
    pSize: "10",
    ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE,
    MLSV_YMD: date,
  });

  // (b) 호출 URL 로그 — 키는 마스킹
  const maskedUrl = `${NEIS_URL}?KEY=${maskKey(apiKey)}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${date}`;
  meta.upstreamUrl = maskedUrl;
  console.log("[/api/meal] NEIS 호출", { url: maskedUrl, date });

  try {
    const upstream = await fetch(`${NEIS_URL}?${params.toString()}`, {
      next: debug ? undefined : { revalidate: 3600 },
      cache: debug ? "no-store" : undefined,
    });
    meta.upstreamStatus = upstream.status;

    // (c) 응답 본문 전체 로그 — 1500자까지 잘라서
    const rawText = await upstream.text();
    console.log("[/api/meal] NEIS 응답", {
      status: upstream.status,
      length: rawText.length,
      body: rawText.slice(0, 1500),
    });

    if (!upstream.ok) {
      // (d) HTTP 에러 — 구체적 에러 메시지 JSON
      return NextResponse.json(
        {
          date,
          lunch: null,
          dinner: null,
          error: `NEIS upstream HTTP ${upstream.status}: ${rawText.slice(0, 200)}`,
          meta,
        } satisfies ApiResponse,
        { status: 500 },
      );
    }

    // JSON 파싱 시도
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch (parseErr) {
      console.error("[/api/meal] NEIS 응답 JSON 파싱 실패", parseErr);
      return NextResponse.json(
        {
          date,
          lunch: null,
          dinner: null,
          error: `NEIS 응답이 JSON 이 아닙니다: ${rawText.slice(0, 200)}`,
          meta,
        } satisfies ApiResponse,
        { status: 500 },
      );
    }

    // NEIS 에러/정보 응답: { RESULT: { CODE, MESSAGE } }
    if (json.RESULT && !json.mealServiceDietInfo) {
      const result = json.RESULT as { CODE?: string; MESSAGE?: string };
      meta.resultCode = result.CODE ?? null;
      meta.resultMessage = result.MESSAGE ?? null;

      // INFO-200 = "데이터 없음" 정상 (주말/방학/등록전) — 200 으로 응답
      if (result.CODE === "INFO-200") {
        console.log("[/api/meal] NEIS INFO-200 (데이터 없음)", { date });
        return NextResponse.json(
          {
            date,
            lunch: null,
            dinner: null,
            ...(debug ? { meta } : {}),
          } satisfies ApiResponse,
          { status: 200 },
        );
      }

      // 그 외는 에러
      console.error("[/api/meal] NEIS RESULT 에러", {
        code: result.CODE,
        message: result.MESSAGE,
        keyHint: meta.apiKeyHint,
        date,
      });
      return NextResponse.json(
        {
          date,
          lunch: null,
          dinner: null,
          error: `NEIS ${result.CODE}: ${result.MESSAGE ?? "알 수 없는 오류"}`,
          meta,
        } satisfies ApiResponse,
        { status: 500 },
      );
    }

    if (!json.mealServiceDietInfo) {
      console.warn("[/api/meal] mealServiceDietInfo 키 없음", {
        keys: Object.keys(json),
        date,
      });
      return NextResponse.json(
        {
          date,
          lunch: null,
          dinner: null,
          error: "NEIS 응답에 데이터 키가 없습니다.",
          meta,
        } satisfies ApiResponse,
        { status: 500 },
      );
    }

    // 정상 데이터 추출
    const wrapper = json.mealServiceDietInfo as Array<{ row?: NeisRow[] }>;
    const rows: NeisRow[] = wrapper.flatMap((w) => w.row ?? []);
    meta.rowCount = rows.length;

    const out: ApiResponse = { date, lunch: null, dinner: null };
    for (const r of rows) {
      const key = MEAL_CODE_MAP[r.MMEAL_SC_CODE ?? ""];
      if (!key) continue;
      out[key] = {
        menus: parseDishes(r.DDISH_NM ?? ""),
        kcal: parseKcal(r.CAL_INFO),
      };
    }

    console.log("[/api/meal] 파싱 완료", {
      date,
      rowCount: rows.length,
      lunchMenus: out.lunch?.menus.length ?? 0,
      dinnerMenus: out.dinner?.menus.length ?? 0,
    });

    if (debug) out.meta = meta;
    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[/api/meal] fetch 예외", { err, keyHint: meta.apiKeyHint, date });
    return NextResponse.json(
      {
        date,
        lunch: null,
        dinner: null,
        error: err instanceof Error ? err.message : "알 수 없는 fetch 에러",
        meta,
      } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
