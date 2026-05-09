// PATCH /api/notifications/[id]
//
//   특정 알림을 읽음 처리 (is_read = true).
//   RLS 정책(USING + WITH CHECK: user_id = auth.uid())이 타인 알림 수정을 차단한다.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error } = await client
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) {
    console.error("[PATCH /api/notifications/:id] 실패", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
