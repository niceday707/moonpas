// /api/school-notices
//
//   GET                       : 저장된 school_notices 목록 반환 (?source=school|news|letter, ?limit=30)
//   GET ?sync=true            : 3종 게시판 크롤링 → DB upsert (Vercel Cron + 수동 동기화 모두 사용)
//   GET ?sync=true&debug=true : 동기화 + 응답에 raw HTML 앞 5000자 + 서버 콘솔 로그
//
//   Vercel Cron 은 GET 메서드만 지원하므로 vercel.json 의 crons.path 를
//   "/api/school-notices?sync=true" 로 두고 동일 핸들러를 사용한다.
//   매일 KST 17:00 (UTC 08:00) 에 자동 호출.
//
//   동기화 안전장치:
//     · 30초 in-memory dedupe — 짧은 시간 내 중복 호출 시 503 으로 즉시 반환
//     · 3종 모두 크롤링 실패 시 DB 미수정 → 기존 데이터 보존
//     · UNIQUE(source, ntt_sn) 충돌은 ignoreDuplicates 로 무시
//
//   Cache-Control:
//     · 조회는 s-maxage=300 (5분) — 크롤링이 매일 1회라 5분 캐시면 충분
//     · 동기화는 캐시 비활성

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_SOURCES,
  crawlAllSources,
  type SchoolNoticeSource,
} from "@/lib/schoolNotices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SOURCES = new Set<string>(ALL_SOURCES);

function getEnv() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    serviceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
    anonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  };
}

// 동시 동기화 방지 — 마지막 sync 시각 (process 메모리)
const SYNC_DEDUPE_MS = 30_000;
let lastSyncAt = 0;

/** 조회용 클라이언트 — anon 키 (RLS SELECT 허용) */
function getReadClient(): SupabaseClient {
  const env = getEnv();
  const key = env.serviceKey || env.anonKey;
  if (!env.url || !key) throw new Error("supabase_env_missing");
  return createClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 쓰기용 클라이언트 — service role 필수 (RLS INSERT 차단되어 있음) */
function getWriteClient(): SupabaseClient {
  const env = getEnv();
  if (!env.url || !env.serviceKey) {
    throw new Error("service_role_required");
  }
  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────
// GET — 조회 또는 ?sync=true 동기화
// ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sync = url.searchParams.get("sync") === "true";
  const debug = url.searchParams.get("debug") === "true";
  const counts = url.searchParams.get("counts") === "true";

  if (sync) {
    return await syncAndRespond({ debug });
  }

  if (counts) {
    return await getCountsAndRespond();
  }

  // 일반 조회
  const sourceParam = url.searchParams.get("source");
  const source =
    sourceParam && VALID_SOURCES.has(sourceParam)
      ? (sourceParam as SchoolNoticeSource)
      : null;
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit")) || 30),
  );

  let client: SupabaseClient;
  try {
    client = getReadClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  let query = client
    .from("school_notices")
    .select("id, source, title, date, original_url, ntt_sn, created_at")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, items: [] },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, items: data ?? [] },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

// ─────────────────────────────────────────────────────────
// ?counts=true — source 별 게시글 수 반환 (TopBar 메가메뉴용)
// ─────────────────────────────────────────────────────────

async function getCountsAndRespond(): Promise<NextResponse> {
  let client: SupabaseClient;
  try {
    client = getReadClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  const { data, error } = await client
    .from("school_notices")
    .select("source, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const counts: Record<string, number> = {};
  // source 별 최신 created_at — TopBar NEW 뱃지(24h 이내) 판정용
  const latest: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ source: string; created_at: string }>) {
    counts[row.source] = (counts[row.source] ?? 0) + 1;
    // order desc 이므로 source 별 첫 등장이 최신값.
    if (latest[row.source] === undefined) {
      latest[row.source] = row.created_at;
    }
  }

  return NextResponse.json(
    { ok: true, counts, latest },
    {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    },
  );
}

// ─────────────────────────────────────────────────────────
// 공통 동기화 — 4종 크롤링 + upsert
// ─────────────────────────────────────────────────────────

async function syncAndRespond({
  debug,
}: { debug: boolean }): Promise<NextResponse> {
  // 30초 in-memory dedupe — cron + 수동 호출이 겹치면 두 번째는 즉시 거절.
  // 단 debug 모드에서는 트러블슈팅 흐름을 막지 않도록 dedupe 우회.
  const now = Date.now();
  if (!debug && now - lastSyncAt < SYNC_DEDUPE_MS) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        retry_after_ms: SYNC_DEDUPE_MS - (now - lastSyncAt),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  lastSyncAt = now;

  let client: SupabaseClient;
  try {
    client = getWriteClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error ? e.message : "service_role_required",
      },
      { status: 500 },
    );
  }

  const { results, errors, rawHtmls } = await crawlAllSources();

  // debug 모드 — 서버 로그에 각 source 의 HTML 앞 5000자 출력
  if (debug) {
    for (const r of rawHtmls) {
      console.log(
        `[/api/school-notices?debug] ${r.source} ${r.url} length=${r.html.length}`,
      );
      console.log(r.html.slice(0, 5000));
      console.log(`--- end of ${r.source} ---`);
    }
    if (errors.length > 0) {
      console.log(
        `[/api/school-notices?debug] errors: ${JSON.stringify(errors, null, 2)}`,
      );
    }
  }

  // 응답에 항상 errors / 디버그 시 raw_samples 포함시키는 헬퍼
  const debugPayload = debug
    ? {
        raw_samples: rawHtmls.map((r) => ({
          source: r.source,
          url: r.url,
          length: r.html.length,
          head: r.html.slice(0, 5000),
        })),
      }
    : {};

  // 크롤링이 모두 실패(또는 0건 파싱)하면 DB 미수정 → 기존 데이터 유지.
  if (results.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "all_sources_failed",
        errors,
        inserted: 0,
        ...debugPayload,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  // (source, ntt_sn) UNIQUE 충돌 시 무시 — 같은 글이 중복 저장되지 않게.
  const rows = results.map((r) => ({
    source: r.source,
    title: r.title,
    date: r.date,
    original_url: r.original_url,
    ntt_sn: r.ntt_sn,
  }));

  const { data, error } = await client
    .from("school_notices")
    .upsert(rows, {
      onConflict: "source,ntt_sn",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        crawled: results.length,
        inserted: 0,
        errors,
        ...debugPayload,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      crawled: results.length,
      inserted: data?.length ?? 0,
      errors,
      ...debugPayload,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
