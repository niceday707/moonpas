// NEIS Open API 급식 정보 프록시
// - 환경변수 NEIS_API_KEY 필요 (Vercel Settings → Environment Variables 에 등록)
// - 교육청코드 Q10 (전라남도교육청), 학교코드 Q100000215 (문태고)
// - GET /api/meal?date=YYYYMMDD  →  { date, lunch, dinner } | { error }
// - 캐시: 1시간 단위 revalidate

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
type ApiResponse = {
  date: string;
  lunch: MealBlock;
  dinner: MealBlock;
};

// NEIS 응답 row — 필요한 필드만
type NeisRow = {
  MLSV_YMD?: string;
  MMEAL_SC_CODE?: string;
  MMEAL_SC_NM?: string;
  DDISH_NM?: string;
  CAL_INFO?: string;
};

// "백미밥 <br/>닭갈비찌개 (5.6.13.16) <br/>볶음김치 (9.13)" → MenuItem[]
function parseDishes(raw: string): MenuItem[] {
  if (!raw) return [];
  return raw
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      // 끝쪽의 (1.2.3) 알레르기 캡처
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

// "612.3 Kcal" → 612.3
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayYmd();

  if (!isValidDate(date)) {
    return NextResponse.json(
      { error: "date 파라미터는 YYYYMMDD 형식이어야 합니다." },
      { status: 400 },
    );
  }

  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) {
    // 개발 환경에서도 카드가 깨지지 않도록 빈 데이터로 응답하되, 콘솔에 명시적 안내.
    console.warn(
      "[/api/meal] NEIS_API_KEY 환경변수가 설정되지 않았습니다. " +
        "Vercel → Settings → Environment Variables 에 NEIS_API_KEY 를 추가하세요.",
    );
    const empty: ApiResponse = { date, lunch: null, dinner: null };
    return NextResponse.json(empty, { status: 200 });
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

  try {
    const upstream = await fetch(`${NEIS_URL}?${params.toString()}`, {
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `NEIS upstream ${upstream.status}` },
        { status: 502 },
      );
    }

    const json = (await upstream.json()) as Record<string, unknown>;

    // 데이터 없음 케이스 — NEIS 는 mealServiceDietInfo 키 자체가 없음
    if (!json.mealServiceDietInfo) {
      const empty: ApiResponse = { date, lunch: null, dinner: null };
      return NextResponse.json(empty, { status: 200 });
    }

    // 두 번째 원소의 row 가 실제 데이터
    const wrapper = json.mealServiceDietInfo as Array<{ row?: NeisRow[] }>;
    const rows: NeisRow[] = wrapper.flatMap((w) => w.row ?? []);

    const out: ApiResponse = { date, lunch: null, dinner: null };
    for (const r of rows) {
      const key = MEAL_CODE_MAP[r.MMEAL_SC_CODE ?? ""];
      if (!key) continue;
      out[key] = {
        menus: parseDishes(r.DDISH_NM ?? ""),
        kcal: parseKcal(r.CAL_INFO),
      };
    }

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[/api/meal] fetch 실패", err);
    return NextResponse.json({ error: "급식 정보를 불러오지 못했습니다." }, { status: 502 });
  }
}
