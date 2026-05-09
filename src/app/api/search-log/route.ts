// POST /api/search-log
//
// 클라이언트의 검색 실행 시 호출되는 검색 로그 INSERT 엔드포인트.
//   - body: { keyword: string, userId?: string }
//   - Authorization: Bearer <access_token> (선택) — 있으면 user_id 식별
//   - 길이/형식 검증, 1분 dedupe (메모리), normalize (lower + trim)
//
// 인증 정책:
//   - SUPABASE_SERVICE_ROLE_KEY 가 있으면 RLS 우회 → user_id=null 도 INSERT 가능
//   - 없으면 anon 키 + 사용자 access_token 으로 RLS('authenticated') 통과 시도
//   - 둘 다 안되면 401 반환
//
// 캐시는 process 메모리라 서버 재시작/리전마다 리셋 — 정확한 dedupe 보다
// "정상 사용자가 너무 많이 보내지 않게" 하는 정도 보호용.

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_LEN = 2;
const MAX_LEN = 60;
const DEDUPE_MS = 60 * 1000;
const DEDUPE_LIMIT = 5000;

// (user_id|ip) :: keyword → 마지막 INSERT 시각
const lastInsertedAt = new Map<string, number>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pruneCache(now: number) {
  if (lastInsertedAt.size <= DEDUPE_LIMIT) return;
  const cutoff = now - DEDUPE_MS * 2;
  for (const [k, t] of lastInsertedAt) {
    if (t < cutoff) lastInsertedAt.delete(k);
  }
}

function getEnv() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    serviceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
    anonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  };
}

export async function POST(req: NextRequest) {
  // ── 1. 입력 파싱 ────────────────────────────────────────
  let body: { keyword?: unknown; userId?: unknown } = {};
  try {
    body = (await req.json()) as { keyword?: unknown; userId?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const rawKeyword = typeof body.keyword === "string" ? body.keyword : "";
  const keyword = rawKeyword.trim().toLowerCase();
  if (keyword.length < MIN_LEN || keyword.length > MAX_LEN) {
    return NextResponse.json(
      { ok: false, error: "invalid_keyword" },
      { status: 400 },
    );
  }

  // ── 2. 인증 컨텍스트 ─────────────────────────────────────
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  let userId: string | null =
    typeof body.userId === "string" && UUID_RE.test(body.userId)
      ? body.userId
      : null;

  const env = getEnv();
  if (!env.url) {
    return NextResponse.json(
      { ok: false, error: "supabase_url_missing" },
      { status: 500 },
    );
  }

  // ── 3. Supabase 클라이언트 준비 (서비스키 우선) ───────────
  let client: SupabaseClient;
  if (env.serviceKey) {
    client = createClient(env.url, env.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // bearer 가 있으면 토큰으로 user_id 식별 보강
    if (!userId && bearer) {
      try {
        const { data } = await client.auth.getUser(bearer);
        if (data.user) userId = data.user.id;
      } catch {
        /* 토큰 검증 실패는 무시 — user_id=null 로 진행 */
      }
    }
  } else {
    if (!env.anonKey) {
      return NextResponse.json(
        { ok: false, error: "supabase_keys_missing" },
        { status: 500 },
      );
    }
    if (!bearer) {
      // 서비스키도 없고 토큰도 없으면 RLS('authenticated') 를 통과할 방법이 없음
      return NextResponse.json(
        { ok: false, error: "auth_required" },
        { status: 401 },
      );
    }
    client = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    if (!userId) {
      try {
        const { data } = await client.auth.getUser();
        if (data.user) userId = data.user.id;
      } catch {
        /* ignore */
      }
    }
  }

  // ── 4. dedupe ────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  const cacheKey = `${userId ?? ip}::${keyword}`;
  const now = Date.now();
  const last = lastInsertedAt.get(cacheKey);
  if (last && now - last < DEDUPE_MS) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  lastInsertedAt.set(cacheKey, now);
  pruneCache(now);

  // ── 5. INSERT ────────────────────────────────────────────
  const { error } = await client.from("search_logs").insert({
    keyword,
    user_id: userId,
  });

  if (error) {
    // 다음 호출에서 재시도 가능하도록 캐시 롤백
    lastInsertedAt.delete(cacheKey);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, userId });
}
