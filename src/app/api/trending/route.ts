// GET /api/trending — 실시간 검색어 TOP 10
//   - public.get_trending_keywords RPC 호출 (최근 6시간 vs 직전 6시간)
//   - count vs prev_count 로 trend (up/down/same/new) 계산
//   - 결과가 10개 미만이면 디폴트 키워드로 채워서 항상 10개 반환 (UI 빈자리 방지)
//   - s-maxage=300 → CDN 5분 캐시 (DB 부하 분산)
//
// SUPABASE_SERVICE_ROLE_KEY 가 있으면 그것을 우선 사용 (RLS 우회 보장).
// 없으면 ANON 키로도 동작 — RPC 가 SECURITY DEFINER + GRANT TO anon 이므로 OK.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 300;
export const dynamic = "force-dynamic"; // RPC 결과는 시간 의존이라 빌드 타임 정적화 금지

type Trend = "up" | "down" | "same" | "new";

type TrendingItem = {
  rank: number;
  keyword: string;
  trend: Trend;
};

type RpcRow = {
  rank: number | string;
  keyword: string;
  count: number | string;
  prev_count: number | string;
};

// RPC 결과가 비어 있을 때 채워넣는 디폴트 키워드 (기존 하드코딩 그대로 이식)
const FALLBACK_KEYWORDS = [
  "중간고사",
  "체육대회",
  "급식 메뉴",
  "2028 대입",
  "수행평가",
  "야자 신청",
  "수학 30번",
  "물리학 공부법",
  "학부모 총회",
  "문튜브",
];

function computeTrend(count: number, prev: number): Trend {
  if (prev === 0) return "new";
  if (count > prev) return "up";
  if (count < prev) return "down";
  return "same";
}

function getServerClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const key = serviceKey || anonKey;
  if (!url || !key) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  let liveItems: TrendingItem[] = [];

  try {
    const supabase = getServerClient();
    const { data, error } = await supabase.rpc("get_trending_keywords");

    if (error) {
      console.warn("[/api/trending] RPC 에러", error.message);
    } else if (Array.isArray(data)) {
      liveItems = (data as RpcRow[]).map((row, idx) => {
        const count = Number(row.count);
        const prev = Number(row.prev_count);
        return {
          rank: Number(row.rank) || idx + 1,
          keyword: row.keyword,
          trend: computeTrend(count, prev),
        };
      });
    }
  } catch (err) {
    console.warn("[/api/trending] 예외", err);
  }

  // 실제 검색 키워드와 디폴트가 겹치지 않도록 set 으로 중복 제거
  const usedKeywords = new Set(liveItems.map((it) => it.keyword.toLowerCase()));
  const filled: TrendingItem[] = [...liveItems];

  for (const fk of FALLBACK_KEYWORDS) {
    if (filled.length >= 10) break;
    if (usedKeywords.has(fk.toLowerCase())) continue;
    filled.push({
      rank: filled.length + 1,
      keyword: fk,
      trend: "same",
    });
  }

  // rank 재정렬 — 부족분 채워 넣은 뒤 1..N 으로 보정
  const items: TrendingItem[] = filled.slice(0, 10).map((it, i) => ({
    rank: i + 1,
    keyword: it.keyword,
    trend: it.trend,
  }));

  return NextResponse.json(
    { items },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
