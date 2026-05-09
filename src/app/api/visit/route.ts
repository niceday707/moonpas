// POST /api/visit
//
//   페이지 로드 시 1회 호출되는 방문 로그 INSERT 엔드포인트.
//   - body: 없음 (또는 무시)
//   - 헤더: Authorization (선택), x-forwarded-for / x-real-ip (Vercel/Proxy 환경)
//
//   visitor_hash 는 서버에서 IP + User-Agent + 환경변수 SALT 를 SHA-256 해시.
//   클라이언트 입력값을 신뢰하지 않으므로 위·변조 위험은 거의 없다.
//
//   인증 정책:
//     - SUPABASE_SERVICE_ROLE_KEY 있으면 service role 로 INSERT (권장).
//     - 없으면 anon 키로 시도 — visit_logs 의 INSERT 정책이 누구에게나 열려 있어 가능.
//
//   중복 INSERT 방지(rate-limit):
//     동일 visitor_hash 가 5분 이내에 반복 호출하면 INSERT 를 건너뛰고 ok:true(dedup) 반환.
//     Next.js 프로세스 메모리 기준 — 서버 재시작/리전 분산 시 리셋되는 best-effort.

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEDUPE_MS = 5 * 60 * 1000; // 5분
const DEDUPE_LIMIT = 10000;

const lastInsertedAt = new Map<string, number>();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getEnv() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    serviceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
    anonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
    salt: (process.env.VISITOR_HASH_SALT ?? "moonpas-visitor-v1").trim(),
  };
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "anon";
}

function hashVisitor(ip: string, ua: string, salt: string): string {
  return createHash("sha256").update(`${ip}::${ua}::${salt}`).digest("hex");
}

function pruneCache(now: number) {
  if (lastInsertedAt.size <= DEDUPE_LIMIT) return;
  const cutoff = now - DEDUPE_MS * 2;
  for (const [k, t] of lastInsertedAt) {
    if (t < cutoff) lastInsertedAt.delete(k);
  }
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  if (!env.url || (!env.serviceKey && !env.anonKey)) {
    return NextResponse.json(
      { ok: false, error: "supabase_env_missing" },
      { status: 500 },
    );
  }

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const visitorHash = hashVisitor(ip, ua, env.salt);

  // ── rate-limit (5분) ─────────────────────────────────────
  const now = Date.now();
  const last = lastInsertedAt.get(visitorHash);
  if (last && now - last < DEDUPE_MS) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  lastInsertedAt.set(visitorHash, now);
  pruneCache(now);

  // ── Supabase 클라이언트 (service role 우선) ──────────────
  const useServiceRole = !!env.serviceKey;
  const client: SupabaseClient = createClient(
    env.url,
    useServiceRole ? env.serviceKey : env.anonKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ── 로그인 유저 식별 (선택) ─────────────────────────────
  let userId: string | null = null;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (bearer) {
    try {
      const { data } = await client.auth.getUser(bearer);
      if (data.user) userId = data.user.id;
    } catch {
      /* 토큰 검증 실패는 무시 — user_id=null 로 진행 */
    }
  }
  // body.userId 폴백
  if (!userId) {
    try {
      const body = (await req.json().catch(() => null)) as
        | { userId?: unknown }
        | null;
      if (body && typeof body.userId === "string" && UUID_RE.test(body.userId)) {
        userId = body.userId;
      }
    } catch {
      /* ignore */
    }
  }

  // ── INSERT ───────────────────────────────────────────────
  const { error } = await client
    .from("visit_logs")
    .insert({ user_id: userId, visitor_hash: visitorHash });

  if (error) {
    // 다음 호출에서 재시도 가능하도록 rate-limit 캐시 롤백
    lastInsertedAt.delete(visitorHash);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
