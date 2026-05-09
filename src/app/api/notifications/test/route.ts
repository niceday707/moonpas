// POST /api/notifications/test
//
//   디버깅용 — 로그인한 사용자 자신에게 테스트 알림 1개를 INSERT 하고 결과를 반환.
//   service_role key 로 RLS 를 완전히 우회한다.
//
//   브라우저 콘솔에서 호출 예:
//     const { data: { session } } = await supabase.auth.getSession();
//     const res = await fetch('/api/notifications/test', {
//       method: 'POST',
//       headers: { Authorization: `Bearer ${session.access_token}` },
//     });
//     console.log(await res.json());
//
//   성공: { ok: true, data: { id, user_id, message, ... } }
//   실패: { ok: false, error: string, code?: string }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1) Bearer 토큰 추출
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Authorization 헤더가 없습니다. Bearer 토큰을 전달해 주세요." },
      { status: 401 },
    );
  }

  // 2) JWT 검증 — getUser(token) 으로 명시 전달
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY || SUPABASE_ANON);
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
  if (authError || !user) {
    console.error("[/api/notifications/test] 인증 실패", authError?.message);
    return NextResponse.json(
      { ok: false, error: "JWT 검증 실패: " + (authError?.message ?? "사용자 없음") },
      { status: 401 },
    );
  }

  // 3) 자신에게 테스트 알림 INSERT
  const { data, error } = await serviceClient
    .from("notifications")
    .insert({
      user_id:    user.id,
      actor_id:   user.id,
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

  return NextResponse.json({ ok: true, userId: user.id, data });
}
