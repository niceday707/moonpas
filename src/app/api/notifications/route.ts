// GET /api/notifications
//
//   로그인한 사용자의 알림 목록 반환 (최신 50개).
//   Authorization 헤더의 Bearer 토큰으로 사용자 인증.
//   RLS 정책(user_id = auth.uid())이 자동으로 다른 사용자 알림을 차단한다.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await client
    .from("notifications")
    .select(
      "id, type, message, post_id, comment_id, is_read, created_at, actor_id, actor:profiles!actor_id(nickname, avatar_url)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[GET /api/notifications] 조회 실패", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notifications: data ?? [] });
}
