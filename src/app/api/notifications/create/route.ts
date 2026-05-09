// POST /api/notifications/create
//
//   알림 INSERT 전용 서버 엔드포인트.
//   service_role key 를 사용해 RLS 를 완전히 우회하여 INSERT 한다.
//
//   클라이언트에서 직접 Supabase INSERT 하면:
//     - actor_id FK 제약 오류 (profiles row 미생성 엣지케이스)
//     - RLS INSERT 정책 변경 이력에 따른 불안정
//     - silent fail — 브라우저 콘솔 외 오류 추적 불가
//   이를 서버에서 처리함으로써 모두 해결.
//
//   요청 (JSON):
//     { rows: NotifRow[] }   — 단건/다건 통일 인터페이스
//
//   보안:
//     - Authorization: Bearer <JWT> 로 발신자 인증
//     - 각 row 의 actor_id 는 JWT uid 와 일치해야 함 (impersonation 방지)
//     - actor_id 가 없는 row 는 허용 (공지사항 fan-out 등)
//
//   FK 처리:
//     - actor_id 가 profiles 에 없어 FK 위반 시 actor_id=null 로 재시도

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type NotifRow = {
  user_id: string;
  type: string;
  message: string;
  post_id?: string | null;
  comment_id?: string | null;
  actor_id?: string | null;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1) JWT 인증
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) 본문 파싱
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

  // 3) actor_id impersonation 방지 — actor_id 가 있는 row 는 JWT uid 와 일치해야 함
  for (const row of rows) {
    if (row.actor_id && row.actor_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "actor_id mismatch" },
        { status: 403 },
      );
    }
  }

  // 4) service_role 로 INSERT (RLS 우회)
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY || SUPABASE_ANON);

  const { error } = await serviceClient.from("notifications").insert(rows);

  if (error) {
    // actor_id FK 위반 (profiles row 미존재 엣지케이스) → actor_id=null 로 재시도
    if (error.code === "23503" && rows.some((r) => r.actor_id)) {
      const safeRows = rows.map((r) => ({ ...r, actor_id: null }));
      const { error: retryErr } = await serviceClient
        .from("notifications")
        .insert(safeRows);
      if (retryErr) {
        console.error("[/api/notifications/create] 재시도 실패", retryErr);
        return NextResponse.json(
          { ok: false, error: retryErr.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, inserted: safeRows.length, actorCleared: true });
    }

    console.error("[/api/notifications/create] INSERT 실패", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
