// GET /api/trending — 실시간 검색어 TOP 10
//
//   1) public.get_trending_keywords_v2 RPC 우선 호출
//      (검색 로그 + 게시글 제목 토큰의 view_count 가중 합산, 24h 윈도우)
//   2) v2 가 없으면 v1 (get_trending_keywords) 으로 폴백 — 6h 검색로그만
//   3) 최종 결과가 10개 미만이면 사용자 지정 fallback 키워드로 채움
//
//   응답 형식:
//     items: Array<{
//       rank: number;        // 1..10
//       keyword: string;
//       count: number;       // 가중치 합 (UI 노출용 정수 반올림)
//       isNew: boolean;      // 직전 윈도우에 없던 키워드면 true
//       change: "up"|"down"|"same"|"new";
//     }>
//
//   Cache: s-maxage=30, stale-while-revalidate=60
//   클라이언트는 60s 간격으로 refetch — 그 사이는 CDN 캐시 응답을 받게 됨.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 30;
export const dynamic = "force-dynamic"; // RPC 결과는 시간 의존 — 빌드타임 정적화 금지

type Change = "up" | "down" | "same" | "new";

type TrendingItem = {
  rank: number;
  keyword: string;
  count: number;
  isNew: boolean;
  change: Change;
};

type RpcRow = {
  rank: number | string;
  keyword: string;
  count: number | string;
  prev_count: number | string;
};

// 사용자 지정 — 데이터가 0건일 때 카드를 비워두지 않도록 항상 10개를 채움.
const FALLBACK_KEYWORDS = [
  "체육한마당",
  "문튜브",
  "생기부 세특",
  "급식 꿀조합",
  "야자 빠지는 법",
  "수행평가 일정",
  "문태 축제",
  "점심시간 맛집",
  "대입 수시 전략",
  "쉬는시간 노래추천",
];

function computeChange(curr: number, prev: number): Change {
  if (prev <= 0 && curr > 0) return "new";
  if (curr > prev) return "up";
  if (curr < prev) return "down";
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

    // v2 우선 — 실패하면 v1 으로 폴백 (마이그레이션 미적용 환경 보호)
    let rows: RpcRow[] | null = null;
    const v2 = await supabase.rpc("get_trending_keywords_v2");
    if (!v2.error && Array.isArray(v2.data)) {
      rows = v2.data as RpcRow[];
    } else {
      if (v2.error) {
        console.warn("[/api/trending] v2 RPC 에러", v2.error.message);
      }
      const v1 = await supabase.rpc("get_trending_keywords");
      if (v1.error) {
        console.warn("[/api/trending] v1 RPC 에러", v1.error.message);
      } else if (Array.isArray(v1.data)) {
        rows = v1.data as RpcRow[];
      }
    }

    if (rows) {
      liveItems = rows.map((row, idx) => {
        const count = Number(row.count) || 0;
        const prev = Number(row.prev_count) || 0;
        return {
          rank: Number(row.rank) || idx + 1,
          keyword: row.keyword,
          count: Math.max(1, Math.round(count)), // UI 표시용 정수
          isNew: prev <= 0 && count > 0,
          change: computeChange(count, prev),
        };
      });
    }
  } catch (err) {
    console.warn("[/api/trending] 예외", err);
  }

  // ── 부족분을 fallback 으로 채워 항상 10개 반환 ───────────
  const used = new Set(liveItems.map((it) => it.keyword.toLowerCase()));
  const filled: TrendingItem[] = [...liveItems];

  for (const fk of FALLBACK_KEYWORDS) {
    if (filled.length >= 10) break;
    if (used.has(fk.toLowerCase())) continue;
    filled.push({
      rank: filled.length + 1,
      keyword: fk,
      count: 0,
      isNew: false,
      change: "same",
    });
  }

  // rank 재부여 (1..10)
  const items: TrendingItem[] = filled.slice(0, 10).map((it, i) => ({
    ...it,
    rank: i + 1,
  }));

  return NextResponse.json(
    { items },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
