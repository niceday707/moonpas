// POST /api/notifications/test
//
//   디버깅용 — 로그인한 사용자 자신에게 테스트 알림 1개를 INSERT 하고 결과를 반환.
//   service_role key 를 직접 사용해 RLS/FK 를 완전히 우회한다.
//
//   성공 시: { ok: true, data: { id, user_id, ... } }
//   실패 시: { ok: false, error: string, details: {...} }
//
//   호출 예:
//     fetch('/api/notifications/test', {
//       method: 'POST',
//       headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
//     })

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 인증
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

  // service_role 로 INSERT
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY || SUPABASE_ANON);

  const { data, error } = await serviceClient
    .from("notifications")
    .insert({
      user_id:    user.id,
      actor_id:   user.id,   // 자기 자신 → FK 확인용
      type:       "comment",
      message:    `[테스트] ${new Date().toISOString()} — 알림 시스템 정상 작동 확인`,
      post_id:    null,
      comment_id: null,
    })
    .select()
    .single();

  if (error) {
    console.error("[/api/notifications/test] INSERT 실패", error);
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code, details: error },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data });
}
