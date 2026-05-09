// POST /api/notifications/create
//
//   알림 INSERT 전용 서버 엔드포인트.
//   service_role key 로 RLS 를 완전히 우회해서 INSERT 한다.
//
//   인증: Authorization: Bearer <JWT>
//     → serviceClient.auth.getUser(token) 으로 JWT 직접 검증.
//       (global.headers 방식은 서버에서 세션 없이 무시될 수 있어 명시 전달 필수)
//
//   요청 (JSON):
//     { rows: NotifRow[] }
//
//   보안:
//     - actor_id 가 있으면 JWT uid 와 일치해야 함 (impersonation 방지)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type NotifRow = {
  user_id: string;
  type: string;
  message: string;
  post_id?: string | null;
  comment_id?: string | null;
  actor_id?: string | null;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1) Bearer 토큰 추출
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized: Bearer 토큰 없음" }, { status: 401 });
  }

  // 2) JWT 검증 — getUser(token) 으로 명시적 전달 (서버에서 세션 없이도 동작)
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY || SUPABASE_ANON);
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
  if (authError || !user) {
    console.error("[/api/notifications/create] 인증 실패", authError?.message);
    return NextResponse.json({ ok: false, error: "unauthorized: JWT 무효" }, { status: 401 });
  }

  // 3) 본문 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const rawRows = (body as { rows?: unknown }).rows;
  const rows: NotifRow[] = Array.isArray(rawRows) ? (rawRows as NotifRow[]) : [];

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "no rows" }, { status: 400 });
  }

  // 4) actor_id impersonation 방지
  for (const row of rows) {
    if (row.actor_id && row.actor_id !== user.id) {
      return NextResponse.json({ ok: false, error: "actor_id mismatch" }, { status: 403 });
    }
  }

  // 5) service_role INSERT (RLS 우회, actor_id FK 없으므로 재시도 불필요)
  const { error: insertError } = await serviceClient.from("notifications").insert(rows);

  if (insertError) {
    console.error("[/api/notifications/create] INSERT 실패", insertError);
    return NextResponse.json({ ok: false, error: insertError.message, code: insertError.code }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
