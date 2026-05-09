// GET /api/visit/today
//
//   오늘 KST 자정부터 지금까지의 DISTINCT visitor_hash 카운트를 반환.
//   - 응답: { count: number }
//   - Cache-Control: s-maxage=60, stale-while-revalidate=120
//     (CDN 1분 캐시 — 클라이언트가 5분마다 refetch 하므로 대부분 캐시 히트)
//
//   집계는 RPC count_distinct_visitors_today() 가 KST 자정 기준으로 처리.
//   (014 마이그레이션 참고)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 시간 의존 — 빌드타임 정적화 금지
export const revalidate = 60;

function getServerClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const key = serviceKey || anonKey; // RPC 는 anon 도 EXECUTE 권한 있음
  if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  let count = 0;

  try {
    const supabase = getServerClient();
    const { data, error } = await supabase.rpc(
      "count_distinct_visitors_today",
    );
    if (error) {
      console.warn("[/api/visit/today] RPC 에러", error.message);
    } else {
      // RPC 는 INTEGER 단일값을 반환 — 환경에 따라 number / string 으로 올 수 있음
      count = Number(data) || 0;
    }
  } catch (err) {
    console.warn("[/api/visit/today] 예외", err);
  }

  return NextResponse.json(
    { count },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
